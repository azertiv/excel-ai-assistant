import { Caption1, Spinner, Text } from "@fluentui/react-components";
import { useEffect, useMemo, useState } from "react";
import { estimateGeminiCostSummary, formatUsd, GEMINI_PRICING_SOURCE_URL, GEMINI_PRICING_UPDATED } from "@/llm/geminiPricing";
import { agentRunner } from "@/llm/agentRunner";
import { revertRangeChange } from "@/office/tools";
import { useSessionStore } from "@/state/sessionStore";
import { useSettingsStore } from "@/state/settingsStore";
import type { RangeChange } from "@/state/types";
import { ActivityFeed } from "@/ui/components/ActivityFeed";
import { MessageComposer } from "@/ui/components/MessageComposer";
import { SettingsPanel } from "@/ui/components/SettingsPanel";

function askApprovalDialog(request: {
  toolName: string;
  reason: string;
  args: Record<string, unknown>;
  risk?: { reason: string; risky: boolean; overwrittenCells?: number; totalCells?: number };
}): Promise<boolean> {
  const riskLabel = request.risk
    ? `\nRisk: ${request.risk.reason}${
        request.risk.overwrittenCells !== undefined ? `\nOverwrites: ${request.risk.overwrittenCells}` : ""
      }${request.risk.totalCells !== undefined ? `\nCells: ${request.risk.totalCells}` : ""}`
    : "";

  const message = `Approve tool call?\n\nTool: ${request.toolName}\nReason: ${request.reason}${riskLabel}\n\nArgs:\n${JSON.stringify(
    request.args,
    null,
    2
  )}`;

  return Promise.resolve(window.confirm(message));
}

export default function App(): JSX.Element {
  const settingsState = useSettingsStore();
  const sessionState = useSessionStore();

  const [viewMode, setViewMode] = useState<"workspace" | "settings">("workspace");
  const [statsOpen, setStatsOpen] = useState(false);

  const loadSettings = settingsState.loadSettings;

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const geminiCostSummary = useMemo(
    () =>
      estimateGeminiCostSummary(sessionState.turnRecords, {
        reasoningTokenShare: 0.25,
        cacheReadTokenShare: 0,
        cacheWriteTokenShare: 0
      }),
    [sessionState.turnRecords]
  );

  const runPrompt = async (prompt: string): Promise<void> => {
    await agentRunner.runTurn({
      prompt,
      askApproval: askApprovalDialog
    });
  };

  const onRevertChange = async (change: RangeChange): Promise<void> => {
    await revertRangeChange(change);
    sessionState.markRangeChangeReverted(change.id);
  };

  const toggleSettings = (): void => {
    setViewMode((state) => (state === "workspace" ? "settings" : "workspace"));
    setStatsOpen(false);
  };

  return (
    <div className="app-shell compact-shell">
      <header className="topbar">
        <div className="topbar-title">
          <Text weight="semibold">Excel AI Assistant</Text>
          <Caption1>{sessionState.busy ? "Assistant is working" : "Ready"}</Caption1>
        </div>

        <button
          type="button"
          className="stats-btn"
          onClick={() => {
            setStatsOpen((open) => !open);
          }}
          aria-expanded={statsOpen}
        >
          Estimated total: {formatUsd(geminiCostSummary.totalBillableUsd)}
        </button>

        <button type="button" className="settings-btn" onClick={toggleSettings} aria-label="Open settings">
          ⚙
        </button>

        {statsOpen ? (
          <div className="stats-panel">
            <Text weight="semibold">Request Cost Estimate</Text>
            <Caption1>{geminiCostSummary.turnCount} Gemini turn(s)</Caption1>
            <div className="stats-grid">
              <span>Input</span>
              <span>{geminiCostSummary.inputTokens.toLocaleString()} tokens</span>
              <span>{formatUsd(geminiCostSummary.inputCostUsd)}</span>

              <span>Output</span>
              <span>{geminiCostSummary.outputTokens.toLocaleString()} tokens</span>
              <span>{formatUsd(geminiCostSummary.outputCostUsd)}</span>

              <span>Reasoning</span>
              <span>{geminiCostSummary.reasoningTokens.toLocaleString()} tokens</span>
              <span>{formatUsd(geminiCostSummary.reasoningCostUsd)} (incl. output)</span>

              <span>Cache read</span>
              <span>{geminiCostSummary.cacheReadTokens.toLocaleString()} tokens</span>
              <span>{formatUsd(geminiCostSummary.cacheReadCostUsd)}</span>

              <span>Cache write</span>
              <span>{geminiCostSummary.cacheWriteTokens.toLocaleString()} tokens</span>
              <span>{formatUsd(geminiCostSummary.cacheWriteCostUsd)}</span>
            </div>
            <div className="stats-total">Billable total: {formatUsd(geminiCostSummary.totalBillableUsd)}</div>
            <Caption1>Reasoning tokens are estimated at 25% of output when usage metadata is unavailable.</Caption1>
            <Caption1>
              Pricing source: Gemini API pricing ({GEMINI_PRICING_UPDATED}) ·{" "}
              <a href={GEMINI_PRICING_SOURCE_URL} target="_blank" rel="noreferrer">
                Official page
              </a>
            </Caption1>
          </div>
        ) : null}
      </header>

      {viewMode === "workspace" ? (
        <main className="workspace-main">
          <ActivityFeed
            messages={sessionState.messages}
            timelineEvents={sessionState.timelineEvents}
            rangeChanges={sessionState.rangeChanges}
            onRevertChange={onRevertChange}
          />
        </main>
      ) : (
        <main className="settings-main">
          <SettingsPanel />
        </main>
      )}

      {viewMode === "workspace" ? (
        <div className="floating-composer-wrap">
          <MessageComposer disabled={sessionState.busy || !settingsState.hydrated} onSend={runPrompt} />
        </div>
      ) : null}

      {sessionState.busy ? <Spinner label="Assistant is working..." className="busy-indicator" /> : null}
    </div>
  );
}
