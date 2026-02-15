import type { RangeChange, RangeSnapshot } from "@/state/types";
import type { WorkbookContextPack, SnapshotWithRisk, WriteOperationRisk } from "./types";
import { createId } from "@/utils/ids";

interface AddressTarget {
  sheetName?: string;
  rangeAddress: string;
}

interface ContextBuildOptions {
  includeWorkbookMap: boolean;
  includeTables: boolean;
  includeCharts: boolean;
  includePivots: boolean;
  maxRows: number;
  maxColumns: number;
}

const DEFAULT_CONTEXT_OPTIONS: ContextBuildOptions = {
  includeWorkbookMap: true,
  includeTables: true,
  includeCharts: true,
  includePivots: true,
  maxRows: 20,
  maxColumns: 20
};

function parseAddress(address: string): AddressTarget {
  const trimmed = address.trim();
  const quoted = trimmed.match(/^'(.+)'!(.+)$/);
  if (quoted) {
    return {
      sheetName: quoted[1] ?? "",
      rangeAddress: quoted[2] ?? "A1"
    };
  }

  const simple = trimmed.match(/^([^!]+)!(.+)$/);
  if (simple) {
    return {
      sheetName: simple[1] ?? "",
      rangeAddress: simple[2] ?? "A1"
    };
  }

  return {
    rangeAddress: trimmed
  };
}

function to2dStrings(matrix: unknown[][]): string[][] {
  return matrix.map((row) => row.map((cell) => (cell ?? "").toString()));
}

async function runExcel<T>(executor: (context: Excel.RequestContext) => Promise<T>): Promise<T> {
  try {
    return await Excel.run(async (context) => executor(context));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Office.js error: ${message}`);
  }
}

async function resolveRange(context: Excel.RequestContext, address: string): Promise<{ worksheet: Excel.Worksheet; range: Excel.Range; resolvedAddress: string }> {
  const target = parseAddress(address);
  const worksheet = target.sheetName
    ? context.workbook.worksheets.getItem(target.sheetName)
    : context.workbook.worksheets.getActiveWorksheet();
  worksheet.load("name");
  const range = worksheet.getRange(target.rangeAddress);
  range.load("address");
  await context.sync();

  return {
    worksheet,
    range,
    resolvedAddress: `${worksheet.name}!${target.rangeAddress}`
  };
}

function computeWriteRisk(snapshot: RangeSnapshot): WriteOperationRisk {
  const totalCells = snapshot.values.reduce((sum, row) => sum + row.length, 0);
  let nonEmptyCells = 0;
  let formulaCells = 0;

  snapshot.values.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      const formula = snapshot.formulas[rowIndex]?.[colIndex] ?? "";
      const hasFormula = formula.startsWith("=");
      const hasValue = value !== null && value !== "";
      if (hasFormula) {
        formulaCells += 1;
      }
      if (hasValue) {
        nonEmptyCells += 1;
      }
    });
  });

  return {
    totalCells,
    nonEmptyCells,
    formulaCells,
    hasFormulaOverwrite: formulaCells > 0,
    hasNonEmptyOverwrite: nonEmptyCells > 0
  };
}

function countChangedCells(before: RangeSnapshot, after: RangeSnapshot): number {
  const rowCount = Math.max(before.values.length, after.values.length);
  let changed = 0;

  for (let row = 0; row < rowCount; row += 1) {
    const beforeRow = before.values[row] ?? [];
    const afterRow = after.values[row] ?? [];
    const beforeFormulaRow = before.formulas[row] ?? [];
    const afterFormulaRow = after.formulas[row] ?? [];
    const colCount = Math.max(beforeRow.length, afterRow.length);

    for (let col = 0; col < colCount; col += 1) {
      if (beforeRow[col] !== afterRow[col] || beforeFormulaRow[col] !== afterFormulaRow[col]) {
        changed += 1;
      }
    }
  }

  return changed;
}

async function highlightRange(address: string, fillColor = "#FFE599"): Promise<void> {
  await runExcel(async (context) => {
    const { range } = await resolveRange(context, address);
    range.format.fill.color = fillColor;
    range.format.borders.getItem(Excel.BorderIndex.edgeBottom).color = "#C8A200";
    range.format.borders.getItem(Excel.BorderIndex.edgeTop).color = "#C8A200";
    range.format.borders.getItem(Excel.BorderIndex.edgeLeft).color = "#C8A200";
    range.format.borders.getItem(Excel.BorderIndex.edgeRight).color = "#C8A200";
    await context.sync();
  });
}

export async function getContextPack(options?: Partial<ContextBuildOptions>): Promise<WorkbookContextPack> {
  const merged = {
    ...DEFAULT_CONTEXT_OPTIONS,
    ...options
  };

  return runExcel(async (context) => {
    const workbook = context.workbook;
    const activeSheet = workbook.worksheets.getActiveWorksheet();
    const selection = workbook.getSelectedRange();
    const worksheets = workbook.worksheets;

    activeSheet.load("name");
    selection.load(["address", "values", "formulas", "numberFormat", "rowCount", "columnCount"]);
    worksheets.load("items/name");
    await context.sync();

    const selectionRows = Math.max(1, Math.min(selection.rowCount, merged.maxRows));
    const selectionCols = Math.max(1, Math.min(selection.columnCount, merged.maxColumns));
    const compactSelection = selection.getResizedRange(selectionRows - 1, selectionCols - 1);
    compactSelection.load(["address", "values", "formulas", "numberFormat"]);
    await context.sync();

    const workbookMap = {
      sheets: [] as Array<{ name: string; usedRows: number; usedColumns: number }>,
      tables: [] as string[],
      pivotTables: [] as string[],
      charts: [] as string[]
    };

    if (merged.includeWorkbookMap) {
      const usedRanges = worksheets.items.map((sheet) => {
        const used = sheet.getUsedRangeOrNullObject(true);
        used.load(["isNullObject", "rowCount", "columnCount"]);
        return { sheet, used };
      });
      await context.sync();

      workbookMap.sheets = usedRanges.map(({ sheet, used }) => ({
        name: sheet.name,
        usedRows: used.isNullObject ? 0 : used.rowCount,
        usedColumns: used.isNullObject ? 0 : used.columnCount
      }));

      if (merged.includeTables) {
        worksheets.items.forEach((sheet) => sheet.tables.load("items/name"));
      }
      if (merged.includeCharts) {
        worksheets.items.forEach((sheet) => sheet.charts.load("items/name"));
      }
      if (merged.includePivots) {
        worksheets.items.forEach((sheet) => {
          const pivots = (sheet as unknown as { pivotTables?: Excel.PivotTableCollection }).pivotTables;
          pivots?.load("items/name");
        });
      }
      await context.sync();

      if (merged.includeTables) {
        workbookMap.tables = worksheets.items.flatMap((sheet) => sheet.tables.items.map((table) => `${sheet.name}.${table.name}`));
      }
      if (merged.includeCharts) {
        workbookMap.charts = worksheets.items.flatMap((sheet) => sheet.charts.items.map((chart) => `${sheet.name}.${chart.name}`));
      }
      if (merged.includePivots) {
        workbookMap.pivotTables = worksheets.items.flatMap((sheet) => {
          const pivots = (sheet as unknown as { pivotTables?: { items: Array<{ name: string }> } }).pivotTables;
          return pivots?.items.map((pivot) => `${sheet.name}.${pivot.name}`) ?? [];
        });
      }
    }

    return {
      activeSheet: activeSheet.name,
      selection: {
        address: compactSelection.address,
        values: compactSelection.values as unknown[][],
        formulas: to2dStrings(compactSelection.formulas as unknown[][]),
        numberFormats: to2dStrings(compactSelection.numberFormat as unknown[][])
      },
      workbookMap
    };
  });
}

export async function readRange(address: string): Promise<RangeSnapshot> {
  return runExcel(async (context) => {
    const { range, resolvedAddress } = await resolveRange(context, address);
    range.load(["values", "formulas", "numberFormat"]);
    await context.sync();
    return {
      address: resolvedAddress,
      values: range.values as unknown[][],
      formulas: to2dStrings(range.formulas as unknown[][]),
      numberFormats: to2dStrings(range.numberFormat as unknown[][])
    };
  });
}

export async function getUsedRange(sheetName: string): Promise<RangeSnapshot> {
  return runExcel(async (context) => {
    const worksheet = context.workbook.worksheets.getItem(sheetName);
    const range = worksheet.getUsedRangeOrNullObject(true);
    range.load(["isNullObject", "address", "values", "formulas", "numberFormat"]);
    await context.sync();

    if (range.isNullObject) {
      return {
        address: `${sheetName}!A1`,
        values: [[""]],
        formulas: [[""]],
        numberFormats: [[""]]
      };
    }

    return {
      address: range.address,
      values: range.values as unknown[][],
      formulas: to2dStrings(range.formulas as unknown[][]),
      numberFormats: to2dStrings(range.numberFormat as unknown[][])
    };
  });
}

export async function snapshotRangeWithRisk(address: string): Promise<SnapshotWithRisk> {
  const snapshot = await readRange(address);
  return {
    snapshot,
    risk: computeWriteRisk(snapshot)
  };
}

export async function writeValues(address: string, values: unknown[][], turnId: string, reason: string): Promise<RangeChange> {
  const before = await readRange(address);

  await runExcel(async (context) => {
    const { range } = await resolveRange(context, address);
    range.values = values as (string | number | boolean | Date)[][];
    await context.sync();
  });

  const after = await readRange(address);
  await highlightRange(address);

  return {
    id: createId("change"),
    turnId,
    reason,
    address: after.address,
    before,
    after,
    changedCellCount: countChangedCells(before, after),
    createdAt: new Date().toISOString()
  };
}

export async function writeFormulas(address: string, formulas: string[][], turnId: string, reason: string): Promise<RangeChange> {
  const before = await readRange(address);

  await runExcel(async (context) => {
    const { range } = await resolveRange(context, address);
    range.formulas = formulas;
    await context.sync();
  });

  const after = await readRange(address);
  await highlightRange(address);

  return {
    id: createId("change"),
    turnId,
    reason,
    address: after.address,
    before,
    after,
    changedCellCount: countChangedCells(before, after),
    createdAt: new Date().toISOString()
  };
}

export async function applySnapshot(snapshot: RangeSnapshot): Promise<void> {
  await runExcel(async (context) => {
    const { range } = await resolveRange(context, snapshot.address);
    range.formulas = snapshot.formulas;
    range.numberFormat = snapshot.numberFormats;
    await context.sync();
  });
}

export async function formatRange(
  address: string,
  options: {
    numberFormat?: string;
    bold?: boolean;
    fillColor?: string;
    borderColor?: string;
  }
): Promise<void> {
  await runExcel(async (context) => {
    const { range } = await resolveRange(context, address);
    range.load(["rowCount", "columnCount"]);
    await context.sync();

    if (options.numberFormat) {
      range.numberFormat = Array.from({ length: range.rowCount }, () =>
        Array.from({ length: range.columnCount }, () => options.numberFormat as string)
      );
    }

    if (typeof options.bold === "boolean") {
      range.format.font.bold = options.bold;
    }

    if (options.fillColor) {
      range.format.fill.color = options.fillColor;
    }

    if (options.borderColor) {
      range.format.borders.getItem(Excel.BorderIndex.edgeBottom).color = options.borderColor;
      range.format.borders.getItem(Excel.BorderIndex.edgeTop).color = options.borderColor;
      range.format.borders.getItem(Excel.BorderIndex.edgeLeft).color = options.borderColor;
      range.format.borders.getItem(Excel.BorderIndex.edgeRight).color = options.borderColor;
    }

    await context.sync();
  });
}

export async function sortRange(address: string, keyColumn: number, ascending = true): Promise<void> {
  await runExcel(async (context) => {
    const { range } = await resolveRange(context, address);
    range.sort.apply([{ key: keyColumn, ascending }], true);
    await context.sync();
  });
}

export async function filterTable(tableName: string, columnName: string, criteria: string): Promise<void> {
  await runExcel(async (context) => {
    const table = context.workbook.tables.getItem(tableName);
    const column = table.columns.getItem(columnName);
    column.filter.applyValuesFilter([criteria]);
    await context.sync();
  });
}

export async function addSheet(name: string): Promise<void> {
  await runExcel(async (context) => {
    context.workbook.worksheets.add(name);
    await context.sync();
  });
}

export async function renameSheet(currentName: string, newName: string): Promise<void> {
  await runExcel(async (context) => {
    const sheet = context.workbook.worksheets.getItem(currentName);
    sheet.name = newName;
    await context.sync();
  });
}

export async function addConditionalFormat(
  address: string,
  options: {
    ruleType: "cellValue" | "containsText";
    operator?: string;
    formula1?: string;
    text?: string;
    fillColor?: string;
  }
): Promise<void> {
  await runExcel(async (context) => {
    const { range } = await resolveRange(context, address);

    if (options.ruleType === "containsText") {
      const conditional = range.conditionalFormats.add(Excel.ConditionalFormatType.containsText);
      conditional.textComparison.rule = {
        operator: Excel.ConditionalTextOperator.contains,
        text: options.text ?? ""
      };
      if (options.fillColor) {
        conditional.textComparison.format.fill.color = options.fillColor;
      }
    } else {
      const conditional = range.conditionalFormats.add(Excel.ConditionalFormatType.cellValue);
      conditional.cellValue.rule = {
        formula1: options.formula1 ?? "0",
        operator: (options.operator as Excel.ConditionalCellValueOperator) ?? Excel.ConditionalCellValueOperator.greaterThan
      };
      if (options.fillColor) {
        conditional.cellValue.format.fill.color = options.fillColor;
      }
    }

    await context.sync();
  });
}

export async function clearConditionalFormats(address: string): Promise<void> {
  await runExcel(async (context) => {
    const { range } = await resolveRange(context, address);
    range.conditionalFormats.clearAll();
    await context.sync();
  });
}

export async function setDataValidationDropdown(address: string, values: string[]): Promise<void> {
  await runExcel(async (context) => {
    const { range } = await resolveRange(context, address);
    range.dataValidation.rule = {
      list: {
        inCellDropDown: true,
        source: values.join(",")
      }
    };
    await context.sync();
  });
}

export async function createChart(options: {
  sourceAddress: string;
  chartType: Excel.ChartType;
  targetSheet?: string;
  title?: string;
}): Promise<string> {
  return runExcel(async (context) => {
    const { range, worksheet } = await resolveRange(context, options.sourceAddress);
    const targetSheet = options.targetSheet
      ? context.workbook.worksheets.getItem(options.targetSheet)
      : worksheet;

    const chart = targetSheet.charts.add(options.chartType, range, Excel.ChartSeriesBy.auto);
    if (options.title) {
      chart.title.text = options.title;
      chart.title.visible = true;
    }

    targetSheet.load("name");
    chart.load("name");
    await context.sync();

    return `${targetSheet.name}.${chart.name}`;
  });
}

export async function updateChart(options: {
  chartName: string;
  sheetName: string;
  title?: string;
  setLegendVisible?: boolean;
}): Promise<void> {
  await runExcel(async (context) => {
    const chart = context.workbook.worksheets.getItem(options.sheetName).charts.getItem(options.chartName);
    if (options.title) {
      chart.title.text = options.title;
      chart.title.visible = true;
    }
    if (typeof options.setLegendVisible === "boolean") {
      chart.legend.visible = options.setLegendVisible;
    }
    await context.sync();
  });
}

export async function createPivot(options: {
  sourceAddress: string;
  destinationAddress: string;
  name: string;
}): Promise<void> {
  await runExcel(async (context) => {
    const source = context.workbook.worksheets.getActiveWorksheet().getRange(options.sourceAddress);
    const destination = context.workbook.worksheets.getActiveWorksheet().getRange(options.destinationAddress);
    const pivotTables = (context.workbook as unknown as { pivotTables: Excel.PivotTableCollection }).pivotTables;
    pivotTables.add(options.name, source, destination);
    await context.sync();
  });
}

export async function updatePivotFilters(options: {
  sheetName: string;
  pivotName: string;
  fieldName: string;
  visibleItems: string[];
}): Promise<void> {
  await runExcel(async (context) => {
    const pivots = (context.workbook.worksheets.getItem(options.sheetName) as unknown as { pivotTables: Excel.PivotTableCollection }).pivotTables;
    const pivot = pivots.getItem(options.pivotName);
    const hierarchy = pivot.hierarchies.getItem(options.fieldName);
    const hierarchyWithFilter = hierarchy as unknown as {
      filter?: {
        applyManualFilter: (input: { selectedItems: string[] }) => void;
      };
    };

    hierarchyWithFilter.filter?.applyManualFilter({ selectedItems: options.visibleItems });
    await context.sync();
  });
}

export async function addCommentOrNote(address: string, text: string): Promise<void> {
  await runExcel(async (context) => {
    const { range } = await resolveRange(context, address);
    context.workbook.comments.add(range, text, Excel.ContentType.plain);
    await context.sync();
  });
}

export async function getPrecedents(address: string, depth = 1): Promise<string[]> {
  return runExcel(async (context) => {
    const { range } = await resolveRange(context, address);
    const anyRange = range as unknown as {
      getPrecedents?: () => Excel.WorkbookRangeAreas;
    };

    if (!anyRange.getPrecedents) {
      return [];
    }

    const precedents = anyRange.getPrecedents();
    precedents.areas.load("items/address");
    await context.sync();
    return precedents.areas.items.slice(0, Math.max(1, depth * 10)).map((area) => area.address);
  });
}

export async function getDependents(address: string, depth = 1): Promise<string[]> {
  return runExcel(async (context) => {
    const { range } = await resolveRange(context, address);
    const anyRange = range as unknown as {
      getDependents?: () => Excel.WorkbookRangeAreas;
    };

    if (!anyRange.getDependents) {
      return [];
    }

    const dependents = anyRange.getDependents();
    dependents.areas.load("items/address");
    await context.sync();
    return dependents.areas.items.slice(0, Math.max(1, depth * 10)).map((area) => area.address);
  });
}

export async function findErrors(scope?: { sheetName?: string }): Promise<Array<{ address: string; value: string }>> {
  return runExcel(async (context) => {
    const sheets: Excel.Worksheet[] = [];

    if (scope?.sheetName) {
      const sheet = context.workbook.worksheets.getItem(scope.sheetName);
      sheet.load("name");
      await context.sync();
      sheets.push(sheet);
    } else {
      const collection = context.workbook.worksheets;
      collection.load("items/name");
      await context.sync();
      sheets.push(...collection.items);
    }

    const errors: Array<{ address: string; value: string }> = [];

    for (const sheet of sheets) {
      const used = sheet.getUsedRangeOrNullObject(true);
      used.load(["isNullObject", "values"]);
      await context.sync();

      if (used.isNullObject) {
        continue;
      }

      const values = used.values as unknown[][];
      values.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          if (typeof cell === "string" && cell.startsWith("#")) {
            const rowNumber = rowIndex + 1;
            const col = String.fromCharCode(65 + (colIndex % 26));
            errors.push({
              address: `${sheet.name}!${col}${rowNumber}`,
              value: cell
            });
          }
        });
      });
    }

    return errors;
  });
}

export async function getTable(name: string): Promise<{ name: string; address: string }> {
  return runExcel(async (context) => {
    const table = context.workbook.tables.getItem(name);
    table.load("name");
    const range = table.getRange();
    range.load("address");
    await context.sync();

    return {
      name: table.name,
      address: range.address
    };
  });
}

export async function listPivots(): Promise<string[]> {
  return runExcel(async (context) => {
    const collection = context.workbook.worksheets;
    collection.load("items/name");
    await context.sync();

    const all: string[] = [];
    collection.items.forEach((sheet) => {
      const pivots = (sheet as unknown as { pivotTables?: Excel.PivotTableCollection }).pivotTables;
      pivots?.load("items/name");
    });
    await context.sync();

    collection.items.forEach((sheet) => {
      const pivots = (sheet as unknown as { pivotTables?: { items: Array<{ name: string }> } }).pivotTables;
      pivots?.items.forEach((pivot) => all.push(`${sheet.name}.${pivot.name}`));
    });

    return all;
  });
}

export async function listCharts(): Promise<string[]> {
  return runExcel(async (context) => {
    const collection = context.workbook.worksheets;
    collection.load("items/name");
    await context.sync();

    collection.items.forEach((sheet) => sheet.charts.load("items/name"));
    await context.sync();

    return collection.items.flatMap((sheet) => sheet.charts.items.map((chart) => `${sheet.name}.${chart.name}`));
  });
}

export async function selectAndFlashRange(address: string): Promise<void> {
  await runExcel(async (context) => {
    const { range } = await resolveRange(context, address);
    range.select();
    range.format.fill.color = "#FFF2CC";
    await context.sync();

    await new Promise<void>((resolve) => setTimeout(() => resolve(), 300));
    range.format.fill.clear();
    await context.sync();
  });
}

export async function revertChange(change: RangeChange): Promise<void> {
  await applySnapshot(change.before);
  await highlightRange(change.address, "#F4CCCC");
}

export async function undoTurnChanges(turnId: string, changes: RangeChange[]): Promise<void> {
  const relevant = changes.filter((change) => change.turnId === turnId && !change.reverted);
  for (const change of relevant) {
    await revertChange(change);
  }
}

export async function createDocumentationSheet(contextPack: WorkbookContextPack): Promise<string> {
  return runExcel(async (context) => {
    const existing = context.workbook.worksheets.getItemOrNullObject("Workbook Documentation");
    existing.load("isNullObject");
    await context.sync();

    const sheet = existing.isNullObject ? context.workbook.worksheets.add("Workbook Documentation") : existing;

    const rows: Array<Array<string | number>> = [
      ["Workbook Documentation", new Date().toISOString(), ""],
      ["Active sheet", contextPack.activeSheet, ""],
      ["Selection", contextPack.selection.address, ""],
      ["", "", ""],
      ["Sheet", "Used rows", "Used columns"],
      ...contextPack.workbookMap.sheets.map((item) => [item.name, item.usedRows, item.usedColumns])
    ];

    rows.push(["", "", ""]);
    rows.push(["Tables", contextPack.workbookMap.tables.join(", ") || "None", ""]);
    rows.push(["Pivot tables", contextPack.workbookMap.pivotTables.join(", ") || "None", ""]);
    rows.push(["Charts", contextPack.workbookMap.charts.join(", ") || "None", ""]);

    const range = sheet.getRangeByIndexes(0, 0, rows.length, 3);
    range.values = rows;
    range.format.autofitColumns();
    sheet.activate();
    await context.sync();

    return sheet.name;
  });
}
