import { create } from "zustand";
import { clampBudget } from "@/utils/token";
import type { ApiKeys, AppSettings, ProviderId, ProviderModelConfig } from "./types";

const SETTINGS_STORAGE_KEY = "excel-ai-assistant.settings.v1";
const MIN_TOKEN_BUDGET = 1000;
const MAX_TOKEN_BUDGET = 200000;

export const DEFAULT_SETTINGS: AppSettings = {
  provider: "gemini",
  models: {
    gemini: import.meta.env.VITE_DEFAULT_GEMINI_MODEL ?? "gemini-3-flash-preview",
    openai: "gpt-4o-mini",
    anthropic: "claude-3-5-sonnet-latest"
  },
  approvalMode: true,
  webSearchEnabled: false,
  riskyWriteCellThreshold: 500,
  maxTokenBudget: 24000,
  loggingEnabled: true,
  proxyBaseUrl: "",
  proxyEnabled: false,
  searchEndpoint: "",
  warnOnPromptInjection: true,
  apiKeys: {}
};

export interface SettingsStoreState {
  settings: AppSettings;
  hydrated: boolean;
  setProvider: (provider: ProviderId) => void;
  setModel: (provider: ProviderId, model: string) => void;
  setApiKey: (provider: ProviderId, apiKey: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

function tryParseSettings(raw: string | null): Partial<AppSettings> | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as Partial<AppSettings>;
  } catch {
    return null;
  }
}

async function saveToRoamingSettings(serialized: string): Promise<void> {
  if (typeof Office === "undefined" || !Office.context?.roamingSettings) {
    return;
  }

  Office.context.roamingSettings.set(SETTINGS_STORAGE_KEY, serialized);
  await new Promise<void>((resolve) => {
    Office.context.roamingSettings.saveAsync(() => resolve());
  });
}

function loadFromRoamingSettings(): Partial<AppSettings> | null {
  if (typeof Office === "undefined" || !Office.context?.roamingSettings) {
    return null;
  }

  const roaming = Office.context.roamingSettings.get(SETTINGS_STORAGE_KEY);
  if (typeof roaming !== "string") {
    return null;
  }

  return tryParseSettings(roaming);
}

function normalizeSettings(input: Partial<AppSettings>): AppSettings {
  const merged: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...input,
    models: {
      ...DEFAULT_SETTINGS.models,
      ...input.models
    },
    apiKeys: {
      ...DEFAULT_SETTINGS.apiKeys,
      ...input.apiKeys
    }
  };

  merged.maxTokenBudget = clampBudget(merged.maxTokenBudget, MIN_TOKEN_BUDGET, MAX_TOKEN_BUDGET);
  merged.riskyWriteCellThreshold = Math.max(1, Math.floor(merged.riskyWriteCellThreshold));
  return merged;
}

async function persistSettings(settings: AppSettings): Promise<void> {
  const serialized = JSON.stringify(settings);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(SETTINGS_STORAGE_KEY, serialized);
  }
  await saveToRoamingSettings(serialized);
}

function mergeModels(
  local: Partial<AppSettings> | null,
  roaming: Partial<AppSettings> | null
): ProviderModelConfig {
  return {
    ...DEFAULT_SETTINGS.models,
    ...(local?.models ?? {}),
    ...(roaming?.models ?? {})
  };
}

function mergeApiKeys(local: Partial<AppSettings> | null, roaming: Partial<AppSettings> | null): ApiKeys {
  return {
    ...DEFAULT_SETTINGS.apiKeys,
    ...(local?.apiKeys ?? {}),
    ...(roaming?.apiKeys ?? {})
  };
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  hydrated: false,
  setProvider: (provider) => {
    set((state) => ({
      settings: {
        ...state.settings,
        provider
      }
    }));
    void persistSettings(get().settings);
  },
  setModel: (provider, model) => {
    set((state) => ({
      settings: {
        ...state.settings,
        models: {
          ...state.settings.models,
          [provider]: model
        }
      }
    }));
    void persistSettings(get().settings);
  },
  setApiKey: (provider, apiKey) => {
    set((state) => ({
      settings: {
        ...state.settings,
        apiKeys: {
          ...state.settings.apiKeys,
          [provider]: apiKey.trim()
        }
      }
    }));
    void persistSettings(get().settings);
  },
  updateSettings: (patch) => {
    set((state) => ({
      settings: normalizeSettings({
        ...state.settings,
        ...patch,
        models: {
          ...state.settings.models,
          ...patch.models
        },
        apiKeys: {
          ...state.settings.apiKeys,
          ...patch.apiKeys
        }
      })
    }));
    void persistSettings(get().settings);
  },
  loadSettings: async () => {
    const local = tryParseSettings(
      typeof localStorage !== "undefined" ? localStorage.getItem(SETTINGS_STORAGE_KEY) : null
    );
    const roaming = loadFromRoamingSettings();

    const combined = normalizeSettings({
      ...local,
      ...roaming,
      models: mergeModels(local, roaming),
      apiKeys: mergeApiKeys(local, roaming)
    });

    set({ settings: combined, hydrated: true });
  },
  saveSettings: async () => {
    await persistSettings(get().settings);
  }
}));

export const tokenBudgetBounds = {
  min: MIN_TOKEN_BUDGET,
  max: MAX_TOKEN_BUDGET
};
