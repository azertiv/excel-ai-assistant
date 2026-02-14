import type { RangeChange, RangeSnapshot } from "@/state/types";

export interface WorksheetMapItem {
  name: string;
  usedRows: number;
  usedColumns: number;
}

export interface WorkbookMap {
  sheets: WorksheetMapItem[];
  tables: string[];
  pivotTables: string[];
  charts: string[];
}

export interface SelectionContext {
  address: string;
  values: unknown[][];
  formulas: string[][];
  numberFormats: string[][];
}

export interface WorkbookContextPack {
  activeSheet: string;
  selection: SelectionContext;
  workbookMap: WorkbookMap;
}

export type ToolExecutionStatus = "success" | "error" | "needs_confirmation";

export interface ToolExecutionResult {
  status: ToolExecutionStatus;
  summary: string;
  data?: unknown;
  error?: string;
  citedRanges?: string[];
  editedRanges?: string[];
  changes?: RangeChange[];
  requiresConfirmation?: {
    reason: string;
    risky: boolean;
    overwrittenCells?: number;
    totalCells?: number;
  };
}

export interface WriteOperationRisk {
  totalCells: number;
  nonEmptyCells: number;
  formulaCells: number;
  hasFormulaOverwrite: boolean;
  hasNonEmptyOverwrite: boolean;
}

export interface SnapshotWithRisk {
  snapshot: RangeSnapshot;
  risk: WriteOperationRisk;
}
