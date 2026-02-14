import type { LlmMessage, LlmRequest, LlmResponse, ProviderAdapter, ToolSchema } from "@/llm/types";
import { estimateTokensFromText } from "@/utils/token";
import { maybeProxyRequest, parseJsonToolCall, simulateStreaming } from "./base";

interface GeminiPart {
  text?: string;
  functionCall?: {
    name: string;
    args?: Record<string, unknown>;
  };
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiPart[];
  };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

function toGeminiRole(role: LlmMessage["role"]): "user" | "model" {
  return role === "assistant" ? "model" : "user";
}

function buildGeminiContents(messages: LlmMessage[]): Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> {
  return messages.map((message) => ({
    role: toGeminiRole(message.role),
    parts: [{ text: message.content }]
  }));
}

function stripUnsupportedGeminiSchemaFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripUnsupportedGeminiSchemaFields(item));
  }

  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    Object.entries(input).forEach(([key, fieldValue]) => {
      if (key === "additionalProperties") {
        return;
      }
      output[key] = stripUnsupportedGeminiSchemaFields(fieldValue);
    });

    return output;
  }

  return value;
}

function buildGeminiTools(tools: ToolSchema[]): Array<{ functionDeclarations: Array<{ name: string; description: string; parameters: Record<string, unknown> }> }> {
  if (!tools.length) {
    return [];
  }

  return [
    {
      functionDeclarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: stripUnsupportedGeminiSchemaFields(tool.inputSchema) as Record<string, unknown>
      }))
    }
  ];
}

function parseGeminiOutput(response: GeminiResponse, tools: ToolSchema[]): LlmResponse {
  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const functionCallPart = parts.find((part) => part.functionCall);

  if (functionCallPart?.functionCall?.name) {
    return {
      kind: "tool_call",
      call: {
        name: functionCallPart.functionCall.name,
        args: functionCallPart.functionCall.args ?? {},
        reason: "Model requested a tool call"
      },
      estimatedOutputTokens: 50
    };
  }

  const text = parts
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();

  const parsedJsonToolCall = parseJsonToolCall(text, tools);
  if (parsedJsonToolCall) {
    return parsedJsonToolCall;
  }

  return {
    kind: "final",
    text,
    estimatedOutputTokens: estimateTokensFromText(text)
  };
}

export const geminiProvider: ProviderAdapter = {
  id: "gemini",
  createCompletion: async (request: LlmRequest): Promise<LlmResponse> => {
    if (!request.apiKey && !request.proxyEnabled) {
      throw new Error("Gemini API key is missing. Add it in Settings.");
    }

    const payload = {
      systemInstruction: {
        parts: [{ text: request.messages[0]?.content ?? "" }]
      },
      contents: buildGeminiContents(request.messages.slice(1)),
      tools: buildGeminiTools(request.tools),
      toolConfig: {
        functionCallingConfig: {
          mode: "AUTO"
        }
      },
      generationConfig: {
        maxOutputTokens: request.maxOutputTokens,
        temperature: request.temperature ?? 0.2
      }
    };

    const performDirect = async (): Promise<GeminiResponse> => {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent?key=${encodeURIComponent(request.apiKey ?? "")}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Gemini request failed (${response.status}): ${text.slice(0, 500)}`);
      }

      return (await response.json()) as GeminiResponse;
    };

    const json = await maybeProxyRequest<GeminiResponse>({
      proxyEnabled: request.proxyEnabled,
      proxyBaseUrl: request.proxyBaseUrl,
      provider: "gemini",
      payload,
      directRequest: performDirect
    });

    const parsed = parseGeminiOutput(json, request.tools);
    if (parsed.kind === "final") {
      await simulateStreaming(parsed.text, request.onTextDelta);
    }
    return parsed;
  }
};
