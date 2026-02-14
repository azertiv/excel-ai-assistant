import type { ToolSchema } from "./types";

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: "read_range",
    description: "Read values, formulas, and number formats from a range.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string" }
      },
      required: ["address"],
      additionalProperties: false
    }
  },
  {
    name: "getRange",
    description: "Alias for read_range. Reads a specific range.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string" }
      },
      required: ["address"],
      additionalProperties: false
    }
  },
  {
    name: "getUsedRange",
    description: "Read used range of a given sheet.",
    inputSchema: {
      type: "object",
      properties: {
        sheet: { type: "string" }
      },
      required: ["sheet"],
      additionalProperties: false
    }
  },
  {
    name: "getPrecedents",
    description: "List precedent ranges for a cell/range.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string" },
        depth: { type: "number", minimum: 1, maximum: 5 }
      },
      required: ["address"],
      additionalProperties: false
    }
  },
  {
    name: "getDependents",
    description: "List dependent ranges for a cell/range.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string" },
        depth: { type: "number", minimum: 1, maximum: 5 }
      },
      required: ["address"],
      additionalProperties: false
    }
  },
  {
    name: "findErrors",
    description: "Find workbook or sheet formula/value errors.",
    inputSchema: {
      type: "object",
      properties: {
        sheet: { type: "string" }
      },
      additionalProperties: false
    }
  },
  {
    name: "getTable",
    description: "Get table details by table name.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" }
      },
      required: ["name"],
      additionalProperties: false
    }
  },
  {
    name: "listPivots",
    description: "List pivot tables in the workbook.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "listCharts",
    description: "List charts in the workbook.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "write_values",
    description: "Write cell values to a range.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string" },
        values: {
          type: "array",
          items: {
            type: "array",
            items: {}
          }
        },
        reason: { type: "string" }
      },
      required: ["address", "values"],
      additionalProperties: false
    }
  },
  {
    name: "write_formulas",
    description: "Write formulas to a range.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string" },
        formulas: {
          type: "array",
          items: {
            type: "array",
            items: { type: "string" }
          }
        },
        reason: { type: "string" }
      },
      required: ["address", "formulas"],
      additionalProperties: false
    }
  },
  {
    name: "format_range",
    description: "Format a range (number format, bold, fill, borders).",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string" },
        numberFormat: { type: "string" },
        bold: { type: "boolean" },
        fillColor: { type: "string" },
        borderColor: { type: "string" }
      },
      required: ["address"],
      additionalProperties: false
    }
  },
  {
    name: "sort_range",
    description: "Sort a range using a 0-based key column index.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string" },
        keyColumn: { type: "number", minimum: 0 },
        ascending: { type: "boolean" }
      },
      required: ["address", "keyColumn"],
      additionalProperties: false
    }
  },
  {
    name: "filter_table",
    description: "Apply a filter to a table column.",
    inputSchema: {
      type: "object",
      properties: {
        tableName: { type: "string" },
        columnName: { type: "string" },
        criteria: { type: "string" }
      },
      required: ["tableName", "columnName", "criteria"],
      additionalProperties: false
    }
  },
  {
    name: "add_sheet",
    description: "Add a worksheet.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" }
      },
      required: ["name"],
      additionalProperties: false
    }
  },
  {
    name: "rename_sheet",
    description: "Rename a worksheet.",
    inputSchema: {
      type: "object",
      properties: {
        currentName: { type: "string" },
        newName: { type: "string" }
      },
      required: ["currentName", "newName"],
      additionalProperties: false
    }
  },
  {
    name: "add_conditional_format",
    description: "Add conditional format to range.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string" },
        formula1: { type: "string" },
        operator: { type: "string" },
        fillColor: { type: "string" }
      },
      required: ["address"],
      additionalProperties: false
    }
  },
  {
    name: "clear_conditional_formats",
    description: "Clear conditional formats in range.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string" }
      },
      required: ["address"],
      additionalProperties: false
    }
  },
  {
    name: "set_data_validation_dropdown",
    description: "Set data validation dropdown list for range.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string" },
        values: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["address", "values"],
      additionalProperties: false
    }
  },
  {
    name: "create_chart",
    description: "Create chart from source range.",
    inputSchema: {
      type: "object",
      properties: {
        sourceAddress: { type: "string" },
        chartType: { type: "string" },
        targetSheet: { type: "string" },
        title: { type: "string" }
      },
      required: ["sourceAddress", "chartType"],
      additionalProperties: false
    }
  },
  {
    name: "update_chart",
    description: "Update chart metadata (title, legend).",
    inputSchema: {
      type: "object",
      properties: {
        chartName: { type: "string" },
        sheetName: { type: "string" },
        title: { type: "string" },
        setLegendVisible: { type: "boolean" }
      },
      required: ["chartName", "sheetName"],
      additionalProperties: false
    }
  },
  {
    name: "create_pivot",
    description: "Create a pivot table.",
    inputSchema: {
      type: "object",
      properties: {
        sourceAddress: { type: "string" },
        destinationAddress: { type: "string" },
        name: { type: "string" }
      },
      required: ["sourceAddress", "destinationAddress", "name"],
      additionalProperties: false
    }
  },
  {
    name: "update_pivot_filters",
    description: "Update pivot filter selected items.",
    inputSchema: {
      type: "object",
      properties: {
        sheetName: { type: "string" },
        pivotName: { type: "string" },
        fieldName: { type: "string" },
        visibleItems: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["sheetName", "pivotName", "fieldName", "visibleItems"],
      additionalProperties: false
    }
  },
  {
    name: "add_comment_or_note",
    description: "Add a plain text comment to a range.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string" },
        text: { type: "string" }
      },
      required: ["address", "text"],
      additionalProperties: false
    }
  },
  {
    name: "web_search",
    description: "Run external web search when enabled by user.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        maxResults: { type: "number", minimum: 1, maximum: 10 }
      },
      required: ["query"],
      additionalProperties: false
    }
  }
];

export const TOOL_NAMES = new Set(TOOL_SCHEMAS.map((tool) => tool.name));
