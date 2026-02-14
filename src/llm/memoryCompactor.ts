import type { ChatMessage, MemoryState } from "@/state/types";
import type { ProviderAdapter } from "./types";
import { buildCompactionPrompt } from "./systemPrompt";
import { createId } from "@/utils/ids";

export interface CompactionResult {
  memory: MemoryState;
  compactedMessages: ChatMessage[];
}

function localSummary(messages: ChatMessage[]): string {
  const bullets = messages
    .slice(0, 10)
    .map((message) => `- ${message.role}: ${message.content.replace(/\s+/g, " ").slice(0, 160)}`)
    .join("\n");
  return bullets || "- No durable memory yet.";
}

export async function compactConversationWithModel(options: {
  provider: ProviderAdapter;
  model: string;
  apiKey?: string;
  proxyBaseUrl?: string;
  proxyEnabled: boolean;
  messages: ChatMessage[];
}): Promise<CompactionResult> {
  const cutoff = Math.max(0, options.messages.length - 6);
  const toCompact = options.messages.slice(0, cutoff);
  const recent = options.messages.slice(cutoff);

  if (toCompact.length === 0) {
    const memory: MemoryState = {
      summary: "",
      sourceMessageIds: [],
      updatedAt: new Date().toISOString()
    };
    return {
      memory,
      compactedMessages: recent
    };
  }

  let summary = localSummary(toCompact);

  try {
    const response = await options.provider.createCompletion({
      provider: options.provider.id,
      model: options.model,
      apiKey: options.apiKey,
      proxyBaseUrl: options.proxyBaseUrl,
      proxyEnabled: options.proxyEnabled,
      maxOutputTokens: 400,
      messages: [
        {
          role: "system",
          content: "You summarize conversations for a spreadsheet AI assistant. Output concise bullets only."
        },
        {
          role: "user",
          content: buildCompactionPrompt(
            toCompact.map((message) => ({
              role: message.role,
              content: message.content
            }))
          )
        }
      ],
      tools: []
    });

    if (response.kind === "final" && response.text.trim()) {
      summary = response.text.trim();
    }
  } catch {
    summary = localSummary(toCompact);
  }

  const memory: MemoryState = {
    summary,
    sourceMessageIds: toCompact.map((message) => message.id),
    updatedAt: new Date().toISOString()
  };

  const memoryMessage: ChatMessage = {
    id: createId("memory"),
    role: "memory",
    content: `Conversation memory:\n${summary}`,
    createdAt: new Date().toISOString()
  };

  return {
    memory,
    compactedMessages: [memoryMessage, ...recent]
  };
}
