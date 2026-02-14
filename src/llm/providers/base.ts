import type { LlmResponse, ToolSchema } from "@/llm/types";
import { estimateTokensFromText } from "@/utils/token";

interface JsonToolPayload {
  tool: string;
  args: Record<string, unknown>;
  reason?: string;
}

export function parseJsonToolCall(text: string, tools: ToolSchema[]): LlmResponse | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as JsonToolPayload;
    if (!parsed || typeof parsed.tool !== "string" || typeof parsed.args !== "object" || parsed.args === null) {
      return null;
    }

    if (!tools.some((tool) => tool.name === parsed.tool)) {
      return null;
    }

    return {
      kind: "tool_call",
      call: {
        name: parsed.tool,
        args: parsed.args,
        reason: parsed.reason ?? "Tool call requested by model"
      },
      estimatedOutputTokens: estimateTokensFromText(text)
    };
  } catch {
    return null;
  }
}

export async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  return (await response.json()) as T;
}

export async function maybeProxyRequest<T>(options: {
  proxyEnabled: boolean;
  proxyBaseUrl?: string;
  provider: string;
  directRequest: () => Promise<T>;
  payload: unknown;
}): Promise<T> {
  const proxyBase = options.proxyBaseUrl?.trim();
  if (!options.proxyEnabled || !proxyBase) {
    return options.directRequest();
  }

  const proxyUrl = `${proxyBase.replace(/\/$/, "")}/chat`;
  return fetchJson<T>(proxyUrl, {
    method: "POST",
    body: JSON.stringify({
      provider: options.provider,
      payload: options.payload
    })
  });
}

export async function simulateStreaming(text: string, onDelta?: (delta: string) => void): Promise<void> {
  if (!onDelta) {
    return;
  }

  const chunks = text.match(/.{1,20}(\s|$)/g) ?? [text];
  for (const chunk of chunks) {
    onDelta(chunk);
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}
