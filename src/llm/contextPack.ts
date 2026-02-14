import { getContextPack } from "@/office/excelClient";
import type { WorkbookContextPack } from "@/office/types";

export type ContextReductionLevel = "full" | "selection_only" | "minimal";

export async function buildWorkbookContext(level: ContextReductionLevel): Promise<WorkbookContextPack> {
  if (level === "full") {
    return getContextPack({
      includeWorkbookMap: true,
      includeTables: true,
      includeCharts: true,
      includePivots: true,
      maxRows: 20,
      maxColumns: 20
    });
  }

  if (level === "selection_only") {
    return getContextPack({
      includeWorkbookMap: true,
      includeTables: false,
      includeCharts: false,
      includePivots: false,
      maxRows: 12,
      maxColumns: 12
    });
  }

  return getContextPack({
    includeWorkbookMap: true,
    includeTables: false,
    includeCharts: false,
    includePivots: false,
    maxRows: 8,
    maxColumns: 8
  });
}

export function compactWorkbookContext(pack: WorkbookContextPack, level: ContextReductionLevel): WorkbookContextPack {
  if (level === "full") {
    return pack;
  }

  if (level === "selection_only") {
    return {
      ...pack,
      workbookMap: {
        ...pack.workbookMap,
        charts: [],
        pivotTables: []
      }
    };
  }

  return {
    ...pack,
    workbookMap: {
      sheets: pack.workbookMap.sheets,
      tables: [],
      charts: [],
      pivotTables: []
    }
  };
}

export function serializeWorkbookContext(pack: WorkbookContextPack): string {
  return JSON.stringify(pack);
}
