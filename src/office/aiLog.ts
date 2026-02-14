import type { TurnRecord } from "@/state/types";

const AI_LOG_SHEET_NAME = "AI Log";

const HEADERS = [
  "Timestamp",
  "Type",
  "Prompt",
  "Provider",
  "Model",
  "Estimated Input Tokens",
  "Estimated Output Tokens",
  "Tool Calls",
  "Edited Ranges",
  "Summary"
];

async function ensureLogSheet(context: Excel.RequestContext): Promise<Excel.Worksheet> {
  const worksheet = context.workbook.worksheets.getItemOrNullObject(AI_LOG_SHEET_NAME);
  worksheet.load(["name", "isNullObject"]);
  await context.sync();

  if (!worksheet.isNullObject) {
    return worksheet;
  }

  const created = context.workbook.worksheets.add(AI_LOG_SHEET_NAME);
  const headerRange = created.getRange("A1:J1");
  headerRange.values = [HEADERS];
  headerRange.format.font.bold = true;
  headerRange.format.fill.color = "#D9EAD3";
  await context.sync();

  return created;
}

function serializeToolCalls(toolCalls: TurnRecord["toolCalls"]): string {
  return toolCalls
    .map((toolCall) => `${toolCall.name}(${toolCall.args}) => ${toolCall.status}`)
    .join(" | ")
    .slice(0, 30000);
}

export async function appendTurnToAiLog(record: TurnRecord): Promise<void> {
  await Excel.run(async (context) => {
    const worksheet = await ensureLogSheet(context);
    const usedRange = worksheet.getUsedRangeOrNullObject(true);
    usedRange.load(["isNullObject", "rowCount"]);
    await context.sync();

    const targetRow = usedRange.isNullObject ? 2 : usedRange.rowCount + 1;
    const writeRange = worksheet.getRange(`A${targetRow}:J${targetRow}`);
    writeRange.values = [
      [
        record.timestamp,
        "turn",
        record.prompt,
        record.provider,
        record.model,
        record.estimatedInputTokens,
        record.estimatedOutputTokens,
        serializeToolCalls(record.toolCalls),
        record.editedRanges.join(", "),
        record.summary
      ]
    ];

    await context.sync();
  });
}

export async function appendMemoryCompactionLog(summary: string, inputTokens: number): Promise<void> {
  await Excel.run(async (context) => {
    const worksheet = await ensureLogSheet(context);
    const usedRange = worksheet.getUsedRangeOrNullObject(true);
    usedRange.load(["isNullObject", "rowCount"]);
    await context.sync();

    const targetRow = usedRange.isNullObject ? 2 : usedRange.rowCount + 1;
    const writeRange = worksheet.getRange(`A${targetRow}:J${targetRow}`);
    writeRange.values = [
      [new Date().toISOString(), "memory", "", "", "", inputTokens, "", "", "", summary]
    ];

    await context.sync();
  });
}

export { AI_LOG_SHEET_NAME };
