import type { LlmRequest, LlmResponse, ProviderAdapter } from "@/llm/types";
import { estimateTokensFromText } from "@/utils/token";
import { maybeProxyRequest, parseJsonToolCall, simulateStreaming } from "./base";

interface OpenAiResponse {
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: Array<{
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
}

export const openAiProvider: ProviderAdapter = {
  id: "openai",
  createCompletion: async (request: LlmRequest): Promise<LlmResponse> => {
    if (!request.apiKey && !request.proxyEnabled) {
      throw new Error("OpenAI API key is missing. Add it in Settings.");
    }

    const payload = {
      model: request.model,
      messages: request.messages,
      tools: request.tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema
        }
      })),
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxOutputTokens
    };

    const performDirect = async (): Promise<OpenAiResponse> => {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${request.apiKey ?? ""}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenAI request failed (${response.status}): ${text.slice(0, 500)}`);
      }

      return (await response.json()) as OpenAiResponse;
    };

    const json = await maybeProxyRequest<OpenAiResponse>({
      proxyEnabled: request.proxyEnabled,
      proxyBaseUrl: request.proxyBaseUrl,
      provider: "openai",
      payload,
      directRequest: performDirect
    });

    const message = json.choices?.[0]?.message;
    const toolCall = message?.tool_calls?.[0]?.function;

    if (toolCall?.name) {
      let args: Record<string, unknown> = {};
      if (toolCall.arguments) {
        try {
          args = JSON.parse(toolCall.arguments) as Record<string, unknown>;
        } catch {
          args = {};
        }
      }

      return {
        kind: "tool_call",
        call: {
          name: toolCall.name,
          args,
          reason: "Model requested a tool call"
        },
        estimatedOutputTokens: 50
      };
    }

    const text = message?.content?.trim() ?? "";
    const parsedJsonToolCall = parseJsonToolCall(text, request.tools);
    if (parsedJsonToolCall) {
      return parsedJsonToolCall;
    }

    await simulateStreaming(text, request.onTextDelta);

    return {
      kind: "final",
      text,
      estimatedOutputTokens: estimateTokensFromText(text)
    };
  }
};
