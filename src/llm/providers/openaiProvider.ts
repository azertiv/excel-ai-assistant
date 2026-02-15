import type { LlmMessage, LlmRequest, LlmResponse, ProviderAdapter } from "@/llm/types";
import { estimateTokensFromText } from "@/utils/token";
import { maybeProxyRequest, parseJsonToolCall, simulateStreaming } from "./base";

type OpenAiChatRole = "system" | "user" | "assistant";

interface OpenAiMessagePart {
  type?: string;
  text?: string;
}

type OpenAiMessageContent = string | OpenAiMessagePart[] | null | undefined;

interface OpenAiResponse {
  choices?: Array<{
    message?: {
      content?: OpenAiMessageContent;
      tool_calls?: Array<{
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
}

function isGpt5Family(model: string): boolean {
  return model.toLowerCase().startsWith("gpt-5");
}

function toOpenAiMessages(messages: LlmMessage[]): Array<{ role: OpenAiChatRole; content: string }> {
  return messages.map((message) => {
    if (message.role === "system") {
      return {
        role: "system",
        content: message.content
      };
    }

    if (message.role === "assistant") {
      return {
        role: "assistant",
        content: message.content
      };
    }

    if (message.role === "tool") {
      const label = message.name ? `Tool result (${message.name})` : "Tool result";
      return {
        role: "user",
        content: `${label}:\n${message.content}`
      };
    }

    return {
      role: "user",
      content: message.content
    };
  });
}

function extractMessageText(content: OpenAiMessageContent): string {
  if (!content) {
    return "";
  }

  if (typeof content === "string") {
    return content.trim();
  }

  return content
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}

export const openAiProvider: ProviderAdapter = {
  id: "openai",
  createCompletion: async (request: LlmRequest): Promise<LlmResponse> => {
    if (!request.apiKey && !request.proxyEnabled) {
      throw new Error("OpenAI API key is missing. Add it in Settings.");
    }

    const isGpt5 = isGpt5Family(request.model);
    const payload: Record<string, unknown> = {
      model: request.model,
      messages: toOpenAiMessages(request.messages),
      tools: request.tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema
        }
      })),
      max_completion_tokens: request.maxOutputTokens
    };

    if (isGpt5) {
      payload.reasoning_effort = "medium";
    } else {
      payload.temperature = request.temperature ?? 0.2;
    }

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

    const text = extractMessageText(message?.content);
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
