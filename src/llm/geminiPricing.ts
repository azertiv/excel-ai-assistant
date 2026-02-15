import type { TurnRecord } from "@/state/types";

export const GEMINI_PRICING_SOURCE_URL = "https://ai.google.dev/gemini-api/docs/pricing";
export const GEMINI_PRICING_UPDATED = "2026-02-15";

export interface GeminiModelPricing {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  reasoningUsdPerMillion: number;
  cacheReadUsdPerMillion: number;
  cacheWriteUsdPerMillion: number;
  reasoningIncludedInOutput: boolean;
  label: string;
}

const FLASH_LITE_PRICING: GeminiModelPricing = {
  label: "Gemini 2.5 Flash-Lite",
  inputUsdPerMillion: 0.1,
  outputUsdPerMillion: 0.4,
  reasoningUsdPerMillion: 0.4,
  cacheReadUsdPerMillion: 0.025,
  cacheWriteUsdPerMillion: 0.025,
  reasoningIncludedInOutput: true
};

const FLASH_PRICING: GeminiModelPricing = {
  label: "Gemini 2.5 Flash",
  inputUsdPerMillion: 0.3,
  outputUsdPerMillion: 2.5,
  reasoningUsdPerMillion: 2.5,
  cacheReadUsdPerMillion: 0.075,
  cacheWriteUsdPerMillion: 0.075,
  reasoningIncludedInOutput: true
};

function priceFromModel(model: string): GeminiModelPricing {
  const normalized = model.toLowerCase();

  if (normalized.includes("flash-lite")) {
    return FLASH_LITE_PRICING;
  }

  if (normalized.includes("flash")) {
    return FLASH_PRICING;
  }

  // Fallback for preview or unknown Gemini ids.
  return FLASH_PRICING;
}

export interface GeminiCostEstimateOptions {
  reasoningTokenShare?: number;
  cacheReadTokenShare?: number;
  cacheWriteTokenShare?: number;
}

export interface GeminiCostSummary {
  turnCount: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  reasoningCostUsd: number;
  cacheReadCostUsd: number;
  cacheWriteCostUsd: number;
  totalBillableUsd: number;
}

function toUsd(tokens: number, usdPerMillion: number): number {
  return (tokens / 1_000_000) * usdPerMillion;
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value > 0 && value < 0.01 ? 4 : 2,
    maximumFractionDigits: value > 0 && value < 0.01 ? 4 : 2
  }).format(value);
}

export function estimateGeminiCostSummary(
  turns: TurnRecord[],
  options: GeminiCostEstimateOptions = {}
): GeminiCostSummary {
  const reasoningShare = Math.max(0, Math.min(1, options.reasoningTokenShare ?? 0));
  const cacheReadShare = Math.max(0, Math.min(1, options.cacheReadTokenShare ?? 0));
  const cacheWriteShare = Math.max(0, Math.min(1, options.cacheWriteTokenShare ?? 0));

  return turns.reduce<GeminiCostSummary>(
    (acc, turn) => {
      if (turn.provider !== "gemini") {
        return acc;
      }

      const pricing = priceFromModel(turn.model);
      const inputTokens = Math.max(0, turn.estimatedInputTokens);
      const outputTokens = Math.max(0, turn.estimatedOutputTokens);
      const reasoningTokens = Math.round(outputTokens * reasoningShare);
      const cacheReadTokens = Math.round(inputTokens * cacheReadShare);
      const cacheWriteTokens = Math.round(inputTokens * cacheWriteShare);

      const inputCost = toUsd(inputTokens, pricing.inputUsdPerMillion);
      const outputCost = toUsd(outputTokens, pricing.outputUsdPerMillion);
      const reasoningCost = toUsd(reasoningTokens, pricing.reasoningUsdPerMillion);
      const cacheReadCost = toUsd(cacheReadTokens, pricing.cacheReadUsdPerMillion);
      const cacheWriteCost = toUsd(cacheWriteTokens, pricing.cacheWriteUsdPerMillion);

      return {
        turnCount: acc.turnCount + 1,
        inputTokens: acc.inputTokens + inputTokens,
        outputTokens: acc.outputTokens + outputTokens,
        reasoningTokens: acc.reasoningTokens + reasoningTokens,
        cacheReadTokens: acc.cacheReadTokens + cacheReadTokens,
        cacheWriteTokens: acc.cacheWriteTokens + cacheWriteTokens,
        inputCostUsd: acc.inputCostUsd + inputCost,
        outputCostUsd: acc.outputCostUsd + outputCost,
        reasoningCostUsd: acc.reasoningCostUsd + reasoningCost,
        cacheReadCostUsd: acc.cacheReadCostUsd + cacheReadCost,
        cacheWriteCostUsd: acc.cacheWriteCostUsd + cacheWriteCost,
        totalBillableUsd: acc.totalBillableUsd + inputCost + outputCost + cacheReadCost + cacheWriteCost
      };
    },
    {
      turnCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      inputCostUsd: 0,
      outputCostUsd: 0,
      reasoningCostUsd: 0,
      cacheReadCostUsd: 0,
      cacheWriteCostUsd: 0,
      totalBillableUsd: 0
    }
  );
}
