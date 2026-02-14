import { estimateTokensFromText } from "@/utils/token";
import type { LlmMessage, ToolSchema } from "./types";

export interface TokenEstimateInput {
  systemPrompt: string;
  memorySummary?: string;
  contextPackJson?: string;
  messages: LlmMessage[];
  tools: ToolSchema[];
}

export interface TokenEstimate {
  inputTokens: number;
  outputTokens: number;
  total: number;
}

export function estimateRequestTokens(input: TokenEstimateInput): TokenEstimate {
  const systemTokens = estimateTokensFromText(input.systemPrompt);
  const memoryTokens = estimateTokensFromText(input.memorySummary ?? "");
  const contextTokens = estimateTokensFromText(input.contextPackJson ?? "");
  const messageTokens = input.messages.reduce((acc, message) => acc + estimateTokensFromText(message.content) + 6, 0);
  const toolSchemaTokens = estimateTokensFromText(JSON.stringify(input.tools));

  const inputTokens = systemTokens + memoryTokens + contextTokens + messageTokens + toolSchemaTokens;
  const outputTokens = Math.ceil(inputTokens * 0.25);

  return {
    inputTokens,
    outputTokens,
    total: inputTokens + outputTokens
  };
}

export function estimateToolResultTokens(payload: unknown): number {
  return estimateTokensFromText(JSON.stringify(payload));
}
