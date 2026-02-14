import type { ProviderId } from "@/state/types";

export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
}

export interface LlmRequest {
  provider: ProviderId;
  model: string;
  apiKey?: string;
  proxyBaseUrl?: string;
  proxyEnabled: boolean;
  maxOutputTokens: number;
  messages: LlmMessage[];
  tools: ToolSchema[];
  temperature?: number;
  onTextDelta?: (delta: string) => void;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  reason: string;
}

export type LlmResponse =
  | {
      kind: "final";
      text: string;
      estimatedOutputTokens: number;
    }
  | {
      kind: "tool_call";
      call: ToolCall;
      estimatedOutputTokens: number;
    };

export interface ProviderAdapter {
  id: ProviderId;
  createCompletion: (request: LlmRequest) => Promise<LlmResponse>;
}
