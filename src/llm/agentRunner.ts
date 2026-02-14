import { appendMemoryCompactionLog, appendTurnToAiLog } from "@/office/aiLog";
import { executeToolCall, isEditingTool, isRiskyTool, preflightToolRisk } from "@/office/tools";
import type { ToolExecutionResult } from "@/office/types";
import { useSessionStore } from "@/state/sessionStore";
import { useSettingsStore } from "@/state/settingsStore";
import type { ChatMessage, TurnRecord } from "@/state/types";
import { extractCitations } from "@/utils/citations";
import { getProviderAdapter } from "./providerFactory";
import {
  buildWorkbookContext,
  compactWorkbookContext,
  serializeWorkbookContext,
  type ContextReductionLevel
} from "./contextPack";
import { compactConversationWithModel } from "./memoryCompactor";
import { SYSTEM_PROMPT } from "./systemPrompt";
import { estimateRequestTokens, estimateToolResultTokens } from "./tokenEstimator";
import { TOOL_SCHEMAS } from "./toolSchemas";
import type { LlmMessage, ToolCall } from "./types";

const MAX_TOOL_ITERATIONS = 8;
const MAX_HISTORY_MESSAGES = 16;

interface ApprovalRequest {
  toolName: string;
  reason: string;
  args: Record<string, unknown>;
  risk?: ToolExecutionResult["requiresConfirmation"];
}

interface RunTurnOptions {
  prompt: string;
  askApproval: (request: ApprovalRequest) => Promise<boolean>;
  webSearchOverride?: (query: string, maxResults: number) => Promise<Array<{ title: string; url: string; snippet: string }>>;
}

function toLlmRole(role: ChatMessage["role"]): LlmMessage["role"] {
  if (role === "memory") {
    return "system";
  }
  if (role === "tool") {
    return "tool";
  }
  return role;
}

function buildConversationMessages(history: ChatMessage[]): LlmMessage[] {
  return history.map((message) => ({
    role: toLlmRole(message.role),
    content: message.content
  }));
}

function trimHistory(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((message) => message.role !== "system").slice(-MAX_HISTORY_MESSAGES);
}

function buildToolResultMessage(call: ToolCall, result: ToolExecutionResult): LlmMessage {
  return {
    role: "tool",
    name: call.name,
    content: JSON.stringify({
      status: result.status,
      summary: result.summary,
      error: result.error,
      data: result.data,
      citedRanges: result.citedRanges,
      editedRanges: result.editedRanges
    })
  };
}

function looksLikeInvalidJsonToolResponse(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("{") && !trimmed.endsWith("}");
}

function valueMatchesSchemaType(value: unknown, schemaType?: string): boolean {
  if (!schemaType) {
    return true;
  }

  switch (schemaType) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    default:
      return true;
  }
}

function validateToolCallAgainstSchema(call: ToolCall): string | null {
  const schema = TOOL_SCHEMAS.find((tool) => tool.name === call.name);
  if (!schema) {
    return `Unknown tool ${call.name}.`;
  }

  const inputSchema = schema.inputSchema as {
    properties?: Record<string, { type?: string }>;
    required?: string[];
    additionalProperties?: boolean;
  };

  const properties = inputSchema.properties ?? {};
  const required = inputSchema.required ?? [];

  for (const key of required) {
    if (!(key in call.args)) {
      return `Missing required argument: ${key}`;
    }
  }

  if (inputSchema.additionalProperties === false) {
    for (const key of Object.keys(call.args)) {
      if (!(key in properties)) {
        return `Unexpected argument: ${key}`;
      }
    }
  }

  for (const [key, propertySchema] of Object.entries(properties)) {
    if (!(key in call.args)) {
      continue;
    }
    if (!valueMatchesSchemaType(call.args[key], propertySchema.type)) {
      return `Invalid type for ${key}. Expected ${propertySchema.type}.`;
    }
  }

  return null;
}

function mergeWebSourcesIntoText(text: string, urls: string[]): string {
  if (urls.length === 0) {
    return text;
  }
  const sourceLines = urls.map((url) => `- ${url}`).join("\n");
  return `${text}\n\nWeb Sources:\n${sourceLines}`;
}

export class AgentRunner {
  async runTurn(options: RunTurnOptions): Promise<void> {
    const session = useSessionStore.getState();
    const settings = useSettingsStore.getState().settings;
    const provider = getProviderAdapter(settings.provider);

    let turnId: string | null = null;

    session.setBusy(true);

    try {
      turnId = session.startTurn(options.prompt);
      session.setTimelineStep("understanding", "running", "Interpreting user intent and constraints.");
      session.setTimelineStep("understanding", "success", "Intent captured.");

      const history = trimHistory(
        useSessionStore
          .getState()
          .messages.filter((message) => message.role !== "memory")
      );

      let contextLevel: ContextReductionLevel = "full";
      session.setTimelineStep("context", "running", "Collecting active sheet and selection context.");
      let contextPack = await buildWorkbookContext(contextLevel);
      let compactedHistory = history;

      const model = settings.models[settings.provider];

      const buildLlmMessages = (): LlmMessage[] => {
        const baseMessages: LlmMessage[] = [
          {
            role: "system",
            content: SYSTEM_PROMPT
          },
          {
            role: "system",
            content: `Workbook context:\n${serializeWorkbookContext(contextPack)}`
          }
        ];

        const memory = useSessionStore.getState().memory;
        if (memory?.summary) {
          baseMessages.push({
            role: "system",
            content: `Memory summary:\n${memory.summary}`
          });
        }

        return [...baseMessages, ...buildConversationMessages(compactedHistory)];
      };

      const estimateForCurrentState = () =>
        estimateRequestTokens({
          systemPrompt: SYSTEM_PROMPT,
          memorySummary: useSessionStore.getState().memory?.summary,
          contextPackJson: serializeWorkbookContext(contextPack),
          messages: buildConversationMessages(compactedHistory),
          tools: TOOL_SCHEMAS
        });

      let estimate = estimateForCurrentState();

      if (estimate.total > settings.maxTokenBudget) {
        contextLevel = "selection_only";
        contextPack = compactWorkbookContext(await buildWorkbookContext(contextLevel), contextLevel);
        estimate = estimateForCurrentState();
        session.setTimelineStep(
          "context",
          "running",
          "Budget pressure detected; trimmed workbook context to selection focus."
        );
      }

      if (estimate.total > settings.maxTokenBudget && compactedHistory.length > 8) {
        const compaction = await compactConversationWithModel({
          provider,
          model,
          apiKey: settings.apiKeys[settings.provider],
          proxyBaseUrl: settings.proxyBaseUrl,
          proxyEnabled: settings.proxyEnabled,
          messages: compactedHistory
        });

        useSessionStore.getState().setMemory(compaction.memory);
        useSessionStore.getState().replaceMessages(compaction.compactedMessages);
        compactedHistory = trimHistory(compaction.compactedMessages);
        estimate = estimateForCurrentState();
        session.setTimelineStep("context", "running", "Auto-compaction applied to older turns.");

        if (settings.loggingEnabled) {
          await appendMemoryCompactionLog(compaction.memory.summary, estimate.inputTokens);
        }
      }

      if (estimate.total > settings.maxTokenBudget) {
        contextLevel = "minimal";
        contextPack = compactWorkbookContext(await buildWorkbookContext(contextLevel), contextLevel);
        estimate = estimateForCurrentState();
        session.setTimelineStep("context", "running", "Dropped non-essential workbook map fields.");
      }

      while (estimate.total > settings.maxTokenBudget && compactedHistory.length > 4) {
        compactedHistory = compactedHistory.slice(1);
        estimate = estimateForCurrentState();
      }

      if (estimate.total > settings.maxTokenBudget) {
        session.setTimelineStep("context", "error", `Request exceeds max token budget (${settings.maxTokenBudget}).`);
        session.addMessage({
          role: "assistant",
          content: `I couldn't fit the request into the current token budget (${settings.maxTokenBudget}). Reduce context or increase the budget slider.`,
          citations: []
        });
        return;
      }

      session.setTimelineStep(
        "context",
        "success",
        `Prepared ${contextLevel} context with estimated ${estimate.inputTokens} input tokens.`
      );

      const llmMessages = buildLlmMessages();
      const toolHistory: TurnRecord["toolCalls"] = [];
      const editedRanges = new Set<string>();
      const webSources = new Set<string>();
      let estimatedOutputTokens = 0;
      let invalidJsonRetry = false;
      let invalidToolRetry = false;

      session.setTimelineStep("planning", "running", "Generating action plan and deciding whether tools are needed.");

      for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
        const response = await provider.createCompletion({
          provider: settings.provider,
          model,
          apiKey: settings.apiKeys[settings.provider],
          proxyBaseUrl: settings.proxyBaseUrl,
          proxyEnabled: settings.proxyEnabled,
          maxOutputTokens: Math.min(4096, Math.max(512, settings.maxTokenBudget - estimate.inputTokens)),
          messages: llmMessages,
          tools: TOOL_SCHEMAS,
          onTextDelta: (delta) => {
            if (!turnId) {
              return;
            }
            const streamingId = `${turnId}_streaming`;
            const existing = useSessionStore
              .getState()
              .messages.find((message) => message.id === streamingId);

            if (!existing) {
              useSessionStore.getState().addMessage({
                id: streamingId,
                role: "assistant",
                content: delta,
                citations: [],
                streaming: true
              });
              return;
            }

            useSessionStore.getState().appendToMessage(streamingId, delta);
          }
        });

        estimatedOutputTokens += response.estimatedOutputTokens;

        if (response.kind === "final") {
          if (looksLikeInvalidJsonToolResponse(response.text) && !invalidJsonRetry) {
            invalidJsonRetry = true;
            llmMessages.push({
              role: "user",
              content:
                "Your previous response looked like an invalid JSON tool call. Return either valid JSON {\"tool\":\"...\",\"args\":{...},\"reason\":\"...\"} OR final plain text answer with citations."
            });
            continue;
          }

          if (!turnId) {
            throw new Error("Turn ID missing during finalization.");
          }

          const streamingId = `${turnId}_streaming`;
          let finalText = response.text;
          let citations = extractCitations(finalText).map((citation) => ({
            address: citation.address,
            label: citation.label
          }));

          if (citations.length === 0) {
            const fallbackCitation = contextPack.selection.address;
            finalText = `${finalText}\n\nSources: [[${fallbackCitation}]]`;
            citations = [{ address: fallbackCitation, label: fallbackCitation }];
          }

          finalText = mergeWebSourcesIntoText(finalText, [...webSources]);

          useSessionStore.getState().updateMessage(streamingId, {
            content: finalText,
            citations,
            streaming: false
          });

          if (!useSessionStore.getState().messages.some((message) => message.id === streamingId)) {
            useSessionStore.getState().addMessage({
              id: streamingId,
              role: "assistant",
              content: finalText,
              citations,
              streaming: false
            });
          }

          session.setTimelineStep("planning", "success", "Plan complete.");
          session.setTimelineStep("execution", "success", "No further tool calls.");
          session.setTimelineStep("summary", "running", "Preparing cited response and audit logs.");

          const turnRecord: TurnRecord = {
            id: turnId,
            timestamp: new Date().toISOString(),
            prompt: options.prompt,
            provider: settings.provider,
            model,
            estimatedInputTokens: estimate.inputTokens,
            estimatedOutputTokens,
            toolCalls: toolHistory,
            editedRanges: [...editedRanges],
            summary: finalText.slice(0, 400)
          };

          useSessionStore.getState().addTurnRecord(turnRecord);
          if (settings.loggingEnabled) {
            await appendTurnToAiLog(turnRecord);
          }

          session.setTimelineStep("summary", "success", "Turn complete.");
          return;
        }

        const validationError = validateToolCallAgainstSchema(response.call);
        if (validationError) {
          if (!invalidToolRetry) {
            invalidToolRetry = true;
            llmMessages.push({
              role: "user",
              content: `Tool call validation failed: ${validationError}. Return a corrected JSON tool call that exactly matches the schema.`
            });
            continue;
          }

          llmMessages.push({
            role: "user",
            content: `Tool call rejected after retry: ${validationError}. Provide a final answer without tool execution.`
          });
          continue;
        }

        invalidToolRetry = false;

        session.setTimelineStep("planning", "success", `Planned tool call: ${response.call.name}`);
        session.setTimelineStep("execution", "running", `Executing ${response.call.name}`);

        const cardId = session.addToolCard({
          toolName: response.call.name,
          targetRanges: [String(response.call.args.address ?? response.call.args.sourceAddress ?? "")].filter(Boolean),
          reason: response.call.reason,
          argsPreview: JSON.stringify(response.call.args).slice(0, 2000),
          resultPreview: "",
          status: "running",
          startedAt: Date.now()
        });

        const risk = await preflightToolRisk(response.call, settings);
        const requiresApproval =
          (settings.approvalMode && isEditingTool(response.call.name)) ||
          !!risk ||
          (isRiskyTool(response.call.name) && settings.approvalMode);

        if (requiresApproval) {
          const approved = await options.askApproval({
            toolName: response.call.name,
            reason: response.call.reason,
            args: response.call.args,
            risk: risk ?? undefined
          });

          if (!approved) {
            const endedAt = Date.now();
            session.updateToolCard(cardId, {
              status: "cancelled",
              endedAt,
              durationMs:
                endedAt -
                (useSessionStore.getState().toolCards.find((card) => card.id === cardId)?.startedAt ?? endedAt),
              resultPreview: "User rejected this action."
            });

            toolHistory.push({
              name: response.call.name,
              args: JSON.stringify(response.call.args).slice(0, 800),
              status: "cancelled"
            });

            llmMessages.push({
              role: "tool",
              name: response.call.name,
              content: JSON.stringify({
                status: "cancelled",
                reason: "User rejected action."
              })
            });
            continue;
          }
        }

        const result = await executeToolCall(response.call, {
          turnId: turnId ?? "turn_unknown",
          settings,
          webSearchOverride: options.webSearchOverride
        });

        const endedAt = Date.now();
        session.updateToolCard(cardId, {
          status: result.status === "success" ? "success" : "error",
          endedAt,
          durationMs:
            endedAt -
            (useSessionStore.getState().toolCards.find((card) => card.id === cardId)?.startedAt ?? endedAt),
          resultPreview: result.error
            ? result.error.slice(0, 800)
            : JSON.stringify(result.data ?? result.summary).slice(0, 800),
          error: result.error
        });

        toolHistory.push({
          name: response.call.name,
          args: JSON.stringify(response.call.args).slice(0, 800),
          status: result.status
        });

        result.editedRanges?.forEach((address) => editedRanges.add(address));
        result.changes?.forEach((change) => useSessionStore.getState().addRangeChange(change));

        if (response.call.name === "web_search") {
          const results = (result.data as { results?: Array<{ url?: string }> } | undefined)?.results ?? [];
          results.forEach((item) => {
            if (item.url) {
              webSources.add(item.url);
            }
          });
        }

        llmMessages.push({
          role: "assistant",
          content: `Tool call result for ${response.call.name}: ${result.summary}`
        });
        llmMessages.push(buildToolResultMessage(response.call, result));
        estimatedOutputTokens += estimateToolResultTokens(result);

        if (result.status !== "success") {
          llmMessages.push({
            role: "user",
            content: `Tool ${response.call.name} failed: ${result.error ?? result.summary}. Provide a safe fallback or a revised tool call.`
          });
        }
      }

      session.addMessage({
        role: "assistant",
        content: "I reached the tool iteration limit before producing a final answer. Please refine the request.",
        citations: []
      });
      session.setTimelineStep("execution", "error", "Reached max tool iterations.");
      session.setTimelineStep("summary", "error", "Turn incomplete.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      session.addMessage({
        role: "assistant",
        content: `The turn failed before completion: ${message}`,
        citations: []
      });
      session.setTimelineStep("summary", "error", "Turn failed.");
    } finally {
      useSessionStore.getState().finishTurn();
      useSessionStore.getState().setBusy(false);
    }
  }
}

export const agentRunner = new AgentRunner();
