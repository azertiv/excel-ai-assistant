import type { AppSettings, RangeChange } from "@/state/types";
import type { ToolCall } from "@/llm/types";
import {
  addCommentOrNote,
  addConditionalFormat,
  addSheet,
  clearConditionalFormats,
  createChart,
  createPivot,
  filterTable,
  findErrors,
  formatRange,
  getDependents,
  getPrecedents,
  getTable,
  getUsedRange,
  listCharts,
  listPivots,
  readRange,
  renameSheet,
  revertChange,
  setDataValidationDropdown,
  snapshotRangeWithRisk,
  sortRange,
  updateChart,
  updatePivotFilters,
  writeFormulas,
  writeValues
} from "./excelClient";
import type { ToolExecutionResult } from "./types";

const EDITING_TOOLS = new Set([
  "write_values",
  "write_formulas",
  "format_range",
  "sort_range",
  "filter_table",
  "add_sheet",
  "rename_sheet",
  "add_conditional_format",
  "clear_conditional_formats",
  "set_data_validation_dropdown",
  "create_chart",
  "update_chart",
  "create_pivot",
  "update_pivot_filters",
  "add_comment_or_note"
]);

export interface ToolExecutorContext {
  turnId: string;
  settings: AppSettings;
  webSearchOverride?: (query: string, maxResults: number) => Promise<Array<{ title: string; url: string; snippet: string }>>;
}

export function isEditingTool(toolName: string): boolean {
  return EDITING_TOOLS.has(toolName);
}

export function isRiskyTool(toolName: string): boolean {
  return toolName === "web_search" || isEditingTool(toolName);
}

function truncate(value: unknown, maxChars = 5000): string {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  if (serialized.length <= maxChars) {
    return serialized;
  }
  return `${serialized.slice(0, maxChars)}...`;
}

async function runSearch(
  settings: AppSettings,
  query: string,
  maxResults: number,
  webSearchOverride?: ToolExecutorContext["webSearchOverride"]
): Promise<Array<{ title: string; url: string; snippet: string }>> {
  if (webSearchOverride) {
    return webSearchOverride(query, maxResults);
  }

  const endpoint = settings.searchEndpoint.trim();
  if (!endpoint) {
    throw new Error("Web search endpoint is not configured.");
  }

  const url = new URL(endpoint);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(maxResults));

  const response = await fetch(url.toString(), {
    method: "GET"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Search request failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; snippet?: string }>;
  };

  return (payload.results ?? []).map((result, index) => ({
    title: result.title ?? `Result ${index + 1}`,
    url: result.url ?? "",
    snippet: result.snippet ?? ""
  }));
}

export async function preflightToolRisk(call: ToolCall, settings: AppSettings): Promise<ToolExecutionResult["requiresConfirmation"] | null> {
  if (call.name === "web_search") {
    return {
      reason: "External web search may send data outside Excel.",
      risky: true
    };
  }

  if (!isEditingTool(call.name)) {
    return null;
  }

  if (call.name === "write_values" || call.name === "write_formulas") {
    const address = String(call.args.address ?? "");
    if (!address) {
      return {
        reason: "Missing target range address.",
        risky: true
      };
    }

    const { risk } = await snapshotRangeWithRisk(address);

    if (risk.totalCells > settings.riskyWriteCellThreshold) {
      return {
        reason: `This write targets ${risk.totalCells} cells, above the risky threshold (${settings.riskyWriteCellThreshold}).`,
        risky: true,
        totalCells: risk.totalCells,
        overwrittenCells: risk.nonEmptyCells
      };
    }

    if (risk.hasFormulaOverwrite || risk.hasNonEmptyOverwrite) {
      return {
        reason: `This write may overwrite ${risk.nonEmptyCells} non-empty cells and ${risk.formulaCells} formulas.`,
        risky: true,
        totalCells: risk.totalCells,
        overwrittenCells: risk.nonEmptyCells
      };
    }
  }

  return null;
}

export async function executeToolCall(call: ToolCall, context: ToolExecutorContext): Promise<ToolExecutionResult> {
  try {
    let changes: RangeChange[] = [];

    switch (call.name) {
      case "read_range":
      case "getRange": {
        const address = String(call.args.address ?? "");
        const snapshot = await readRange(address);
        return {
          status: "success",
          summary: `Read ${snapshot.address}`,
          data: snapshot,
          citedRanges: [snapshot.address]
        };
      }
      case "getUsedRange": {
        const sheet = String(call.args.sheet ?? "");
        const snapshot = await getUsedRange(sheet);
        return {
          status: "success",
          summary: `Read used range on ${sheet}`,
          data: snapshot,
          citedRanges: [snapshot.address]
        };
      }
      case "getPrecedents": {
        const address = String(call.args.address ?? "");
        const depth = Number(call.args.depth ?? 1);
        const precedents = await getPrecedents(address, depth);
        return {
          status: "success",
          summary: `Found ${precedents.length} precedent range(s).`,
          data: precedents,
          citedRanges: precedents
        };
      }
      case "getDependents": {
        const address = String(call.args.address ?? "");
        const depth = Number(call.args.depth ?? 1);
        const dependents = await getDependents(address, depth);
        return {
          status: "success",
          summary: `Found ${dependents.length} dependent range(s).`,
          data: dependents,
          citedRanges: dependents
        };
      }
      case "findErrors": {
        const sheet = call.args.sheet ? String(call.args.sheet) : undefined;
        const errors = await findErrors(sheet ? { sheetName: sheet } : undefined);
        return {
          status: "success",
          summary: `Found ${errors.length} error cell(s).`,
          data: errors,
          citedRanges: errors.map((error) => error.address)
        };
      }
      case "getTable": {
        const name = String(call.args.name ?? "");
        const table = await getTable(name);
        return {
          status: "success",
          summary: `Read table ${table.name}`,
          data: table,
          citedRanges: [table.address]
        };
      }
      case "listPivots": {
        const pivots = await listPivots();
        return {
          status: "success",
          summary: `Found ${pivots.length} pivot table(s).`,
          data: pivots
        };
      }
      case "listCharts": {
        const charts = await listCharts();
        return {
          status: "success",
          summary: `Found ${charts.length} chart(s).`,
          data: charts
        };
      }
      case "write_values": {
        const address = String(call.args.address ?? "");
        const values = (call.args.values ?? []) as unknown[][];
        const reason = String(call.args.reason ?? call.reason ?? "Updated by AI agent");
        const change = await writeValues(address, values, context.turnId, reason);
        changes = [change];
        return {
          status: "success",
          summary: `Updated values in ${change.address}`,
          data: { changedCellCount: change.changedCellCount },
          editedRanges: [change.address],
          citedRanges: [change.address],
          changes
        };
      }
      case "write_formulas": {
        const address = String(call.args.address ?? "");
        const formulas = (call.args.formulas ?? []) as string[][];
        const reason = String(call.args.reason ?? call.reason ?? "Updated formulas by AI agent");
        const change = await writeFormulas(address, formulas, context.turnId, reason);
        changes = [change];
        return {
          status: "success",
          summary: `Updated formulas in ${change.address}`,
          data: { changedCellCount: change.changedCellCount },
          editedRanges: [change.address],
          citedRanges: [change.address],
          changes
        };
      }
      case "format_range": {
        const address = String(call.args.address ?? "");
        await formatRange(address, {
          numberFormat: typeof call.args.numberFormat === "string" ? call.args.numberFormat : undefined,
          bold: typeof call.args.bold === "boolean" ? call.args.bold : undefined,
          fillColor: typeof call.args.fillColor === "string" ? call.args.fillColor : undefined,
          borderColor: typeof call.args.borderColor === "string" ? call.args.borderColor : undefined
        });
        return {
          status: "success",
          summary: `Formatted ${address}`,
          editedRanges: [address],
          citedRanges: [address]
        };
      }
      case "sort_range": {
        const address = String(call.args.address ?? "");
        const keyColumn = Number(call.args.keyColumn ?? 0);
        const ascending = call.args.ascending !== false;
        await sortRange(address, keyColumn, ascending);
        return {
          status: "success",
          summary: `Sorted ${address}`,
          editedRanges: [address],
          citedRanges: [address]
        };
      }
      case "filter_table": {
        const tableName = String(call.args.tableName ?? "");
        const columnName = String(call.args.columnName ?? "");
        const criteria = String(call.args.criteria ?? "");
        await filterTable(tableName, columnName, criteria);
        return {
          status: "success",
          summary: `Filtered ${tableName}.${columnName}`
        };
      }
      case "add_sheet": {
        const name = String(call.args.name ?? "");
        await addSheet(name);
        return {
          status: "success",
          summary: `Added sheet ${name}`
        };
      }
      case "rename_sheet": {
        const currentName = String(call.args.currentName ?? "");
        const newName = String(call.args.newName ?? "");
        await renameSheet(currentName, newName);
        return {
          status: "success",
          summary: `Renamed ${currentName} to ${newName}`
        };
      }
      case "add_conditional_format": {
        const address = String(call.args.address ?? "");
        await addConditionalFormat(address, {
          ruleType: "cellValue",
          formula1: typeof call.args.formula1 === "string" ? call.args.formula1 : undefined,
          operator: typeof call.args.operator === "string" ? call.args.operator : undefined,
          fillColor: typeof call.args.fillColor === "string" ? call.args.fillColor : undefined
        });
        return {
          status: "success",
          summary: `Added conditional format to ${address}`,
          editedRanges: [address],
          citedRanges: [address]
        };
      }
      case "clear_conditional_formats": {
        const address = String(call.args.address ?? "");
        await clearConditionalFormats(address);
        return {
          status: "success",
          summary: `Cleared conditional formats in ${address}`,
          editedRanges: [address],
          citedRanges: [address]
        };
      }
      case "set_data_validation_dropdown": {
        const address = String(call.args.address ?? "");
        const values = Array.isArray(call.args.values) ? call.args.values.map((item) => String(item)) : [];
        await setDataValidationDropdown(address, values);
        return {
          status: "success",
          summary: `Set dropdown validation for ${address}`,
          editedRanges: [address],
          citedRanges: [address]
        };
      }
      case "create_chart": {
        const sourceAddress = String(call.args.sourceAddress ?? "");
        const chartType = String(call.args.chartType ?? "ColumnClustered") as Excel.ChartType;
        const chartRef = await createChart({
          sourceAddress,
          chartType,
          targetSheet: typeof call.args.targetSheet === "string" ? call.args.targetSheet : undefined,
          title: typeof call.args.title === "string" ? call.args.title : undefined
        });
        return {
          status: "success",
          summary: `Created chart ${chartRef}`,
          editedRanges: [sourceAddress],
          citedRanges: [sourceAddress]
        };
      }
      case "update_chart": {
        const chartName = String(call.args.chartName ?? "");
        const sheetName = String(call.args.sheetName ?? "");
        await updateChart({
          chartName,
          sheetName,
          title: typeof call.args.title === "string" ? call.args.title : undefined,
          setLegendVisible: typeof call.args.setLegendVisible === "boolean" ? call.args.setLegendVisible : undefined
        });
        return {
          status: "success",
          summary: `Updated chart ${sheetName}.${chartName}`
        };
      }
      case "create_pivot": {
        const sourceAddress = String(call.args.sourceAddress ?? "");
        const destinationAddress = String(call.args.destinationAddress ?? "");
        const name = String(call.args.name ?? "");
        await createPivot({ sourceAddress, destinationAddress, name });
        return {
          status: "success",
          summary: `Created pivot ${name}`,
          editedRanges: [destinationAddress],
          citedRanges: [sourceAddress, destinationAddress]
        };
      }
      case "update_pivot_filters": {
        const sheetName = String(call.args.sheetName ?? "");
        const pivotName = String(call.args.pivotName ?? "");
        const fieldName = String(call.args.fieldName ?? "");
        const visibleItems = Array.isArray(call.args.visibleItems) ? call.args.visibleItems.map((item) => String(item)) : [];
        await updatePivotFilters({ sheetName, pivotName, fieldName, visibleItems });
        return {
          status: "success",
          summary: `Updated pivot filters for ${sheetName}.${pivotName}`
        };
      }
      case "add_comment_or_note": {
        const address = String(call.args.address ?? "");
        const text = String(call.args.text ?? "");
        await addCommentOrNote(address, text);
        return {
          status: "success",
          summary: `Added note/comment to ${address}`,
          editedRanges: [address],
          citedRanges: [address]
        };
      }
      case "web_search": {
        if (!context.settings.webSearchEnabled) {
          return {
            status: "error",
            summary: "Web search is disabled in Settings.",
            error: "Web search is disabled."
          };
        }

        const query = String(call.args.query ?? "");
        const maxResults = Number(call.args.maxResults ?? 5);
        const results = await runSearch(context.settings, query, maxResults, context.webSearchOverride);
        const sources = results
          .map((result) => `- ${result.title}: ${result.url}`)
          .join("\n");

        return {
          status: "success",
          summary: `Found ${results.length} web result(s).`,
          data: {
            results,
            sources
          }
        };
      }
      default:
        return {
          status: "error",
          summary: `Unsupported tool: ${call.name}`,
          error: `Unknown tool ${call.name}`
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: "error",
      summary: `Tool ${call.name} failed`,
      error: truncate(message)
    };
  }
}

export async function revertRangeChange(change: RangeChange): Promise<void> {
  await revertChange(change);
}
