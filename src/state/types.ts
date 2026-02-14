export type ProviderId = "gemini" | "openai" | "anthropic";

export interface ProviderModelConfig {
  gemini: string;
  openai: string;
  anthropic: string;
}

export interface ApiKeys {
  gemini?: string;
  openai?: string;
  anthropic?: string;
}

export interface AppSettings {
  provider: ProviderId;
  models: ProviderModelConfig;
  approvalMode: boolean;
  webSearchEnabled: boolean;
  riskyWriteCellThreshold: number;
  maxTokenBudget: number;
  loggingEnabled: boolean;
  proxyBaseUrl: string;
  proxyEnabled: boolean;
  searchEndpoint: string;
  warnOnPromptInjection: boolean;
  apiKeys: ApiKeys;
}

export type MessageRole = "system" | "user" | "assistant" | "tool" | "memory";

export interface Citation {
  address: string;
  label: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  citations?: Citation[];
  streaming?: boolean;
  meta?: {
    toolName?: string;
    toolStatus?: "pending" | "running" | "success" | "error";
  };
}

export type TimelineStepId =
  | "understanding"
  | "context"
  | "planning"
  | "execution"
  | "summary";

export interface TimelineStep {
  id: TimelineStepId;
  label: string;
  status: "pending" | "running" | "success" | "error";
  details: string[];
}

export interface ToolTimelineCard {
  id: string;
  toolName: string;
  targetRanges: string[];
  reason: string;
  argsPreview: string;
  resultPreview: string;
  status: "pending" | "running" | "success" | "error" | "cancelled";
  startedAt?: number;
  endedAt?: number;
  durationMs?: number;
  error?: string;
}

export interface RangeSnapshot {
  address: string;
  values: unknown[][];
  formulas: string[][];
  numberFormats: string[][];
}

export interface RangeChange {
  id: string;
  turnId: string;
  reason: string;
  address: string;
  before: RangeSnapshot;
  after: RangeSnapshot;
  changedCellCount: number;
  reverted?: boolean;
}

export interface TurnRecord {
  id: string;
  timestamp: string;
  prompt: string;
  provider: ProviderId;
  model: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  toolCalls: Array<{ name: string; args: string; status: string }>;
  editedRanges: string[];
  summary: string;
}

export interface MemoryState {
  summary: string;
  sourceMessageIds: string[];
  updatedAt: string;
}
