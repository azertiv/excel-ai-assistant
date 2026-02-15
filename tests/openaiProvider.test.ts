import { afterEach, describe, expect, it, vi } from "vitest";
import { openAiProvider } from "@/llm/providers/openaiProvider";
import type { LlmRequest } from "@/llm/types";

const TOOL_SCHEMA = {
  name: "read_range",
  description: "Read a range",
  inputSchema: {
    type: "object",
    properties: {
      address: { type: "string" }
    },
    required: ["address"],
    additionalProperties: false
  }
};

function buildRequest(overrides: Partial<LlmRequest> = {}): LlmRequest {
  return {
    provider: "openai",
    model: "gpt-5-mini",
    apiKey: "sk-test",
    proxyBaseUrl: "",
    proxyEnabled: false,
    maxOutputTokens: 1200,
    messages: [
      { role: "system", content: "System prompt" },
      { role: "user", content: "Do the thing" },
      { role: "tool", name: "read_range", content: '{"status":"success"}' }
    ],
    tools: [TOOL_SCHEMA],
    temperature: 0.2,
    ...overrides
  };
}

function requireCapturedPayload(payload: Record<string, unknown> | null): Record<string, unknown> {
  if (!payload) {
    throw new Error("Expected OpenAI payload to be captured in fetch stub.");
  }
  return payload;
}

describe("openAiProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses GPT-5 compatible chat payload and maps tool role messages", async () => {
    let payload: Record<string, unknown> | null = null;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: "All set"
                }
              }
            ]
          }),
          text: async () => ""
        } as unknown as Response;
      })
    );

    const response = await openAiProvider.createCompletion(buildRequest());

    expect(response.kind).toBe("final");
    const sentPayload = requireCapturedPayload(payload);
    expect(sentPayload.model).toBe("gpt-5-mini");
    expect(sentPayload.max_completion_tokens).toBe(1200);
    expect(sentPayload.reasoning_effort).toBe("medium");
    expect(sentPayload.temperature).toBeUndefined();

    const messages = (sentPayload.messages as Array<{ role: string; content: string }>) ?? [];
    expect(messages[2]?.role).toBe("user");
    expect(messages[2]?.content).toContain("Tool result (read_range)");
  });

  it("keeps temperature for non GPT-5 models", async () => {
    let payload: Record<string, unknown> | null = null;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: "Done"
                }
              }
            ]
          }),
          text: async () => ""
        } as unknown as Response;
      })
    );

    await openAiProvider.createCompletion(
      buildRequest({
        model: "gpt-4.1-mini"
      })
    );

    const sentPayload = requireCapturedPayload(payload);
    expect(sentPayload.temperature).toBe(0.2);
    expect(sentPayload.reasoning_effort).toBeUndefined();
  });

  it("parses function tool calls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      function: {
                        name: "read_range",
                        arguments: '{"address":"Sheet1!A1"}'
                      }
                    }
                  ]
                }
              }
            ]
          }),
          text: async () => ""
        } as unknown as Response;
      })
    );

    const response = await openAiProvider.createCompletion(buildRequest());

    expect(response.kind).toBe("tool_call");
    if (response.kind !== "tool_call") {
      throw new Error("Expected tool call response");
    }
    expect(response.call.name).toBe("read_range");
    expect(response.call.args).toEqual({ address: "Sheet1!A1" });
  });
});
