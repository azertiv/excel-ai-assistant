import type { LlmRequest, LlmResponse, ProviderAdapter } from "@/llm/types";
import { estimateTokensFromText } from "@/utils/token";
import { maybeProxyRequest, parseJsonToolCall, simulateStreaming } from "./base";

interface AnthropicResponse {
  content?: Array<
    | {
        type: "text";
        text: string;
      }
    | {
        type: "tool_use";
        name: string;
        input: Record<string, unknown>;
      }
  >;
}

export const anthropicProvider: ProviderAdapter = {
  id: "anthropic",
  createCompletion: async (request: LlmRequest): Promise<LlmResponse> => {
    if (!request.apiKey && !request.proxyEnabled) {
      throw new Error("Anthropic API key is missing. Add it in Settings.");
    }

    const payload = {
      model: request.model,
      max_tokens: request.maxOutputTokens,
      system: request.messages[0]?.content ?? "",
      messages: request.messages.slice(1).map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content
      })),
      tools: request.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema
      }))
    };

    const performDirect = async (): Promise<AnthropicResponse> => {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": request.apiKey ?? "",
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Anthropic request failed (${response.status}): ${text.slice(0, 500)}`);
      }

      return (await response.json()) as AnthropicResponse;
    };

    const json = await maybeProxyRequest<AnthropicResponse>({
      proxyEnabled: request.proxyEnabled,
      proxyBaseUrl: request.proxyBaseUrl,
      provider: "anthropic",
      payload,
      directRequest: performDirect
    });

    const toolUse = json.content?.find((part) => part.type === "tool_use");
    if (toolUse && toolUse.type === "tool_use") {
      return {
        kind: "tool_call",
        call: {
          name: toolUse.name,
          args: toolUse.input,
          reason: "Model requested a tool call"
        },
        estimatedOutputTokens: 50
      };
    }

    const text = json.content
      ?.filter((part) => part.type === "text")
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("\n")
      .trim() ?? "";

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
