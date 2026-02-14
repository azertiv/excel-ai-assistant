import type { ProviderId } from "@/state/types";
import type { ProviderAdapter } from "./types";
import { anthropicProvider } from "./providers/anthropicProvider";
import { geminiProvider } from "./providers/geminiProvider";
import { openAiProvider } from "./providers/openaiProvider";

const providers: Record<ProviderId, ProviderAdapter> = {
  gemini: geminiProvider,
  openai: openAiProvider,
  anthropic: anthropicProvider
};

export function getProviderAdapter(provider: ProviderId): ProviderAdapter {
  return providers[provider];
}
