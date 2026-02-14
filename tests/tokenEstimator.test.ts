import { describe, expect, it } from "vitest";
import { estimateRequestTokens } from "@/llm/tokenEstimator";

describe("estimateRequestTokens", () => {
  it("returns positive token values", () => {
    const estimate = estimateRequestTokens({
      systemPrompt: "System",
      memorySummary: "Memory",
      contextPackJson: "{\"a\":1}",
      messages: [{ role: "user", content: "Hello" }],
      tools: []
    });

    expect(estimate.inputTokens).toBeGreaterThan(0);
    expect(estimate.outputTokens).toBeGreaterThan(0);
    expect(estimate.total).toBe(estimate.inputTokens + estimate.outputTokens);
  });
});
