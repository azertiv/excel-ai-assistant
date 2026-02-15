import { Caption1, Spinner, Text } from "@fluentui/react-components";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
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

function formatCompactEuro(value: number): string {
  return `${value.toFixed(2).replace(".", ",")}€`;
}

export default function App(): JSX.Element {
  const settingsState = useSettingsStore();
  const sessionState = useSessionStore();

  const [viewMode, setViewMode] = useState<"workspace" | "settings">("workspace");
  const [statsOpen, setStatsOpen] = useState(false);
  const [composerOffset, setComposerOffset] = useState(0);

  const composerRef = useRef<HTMLDivElement | null>(null);
  const loadSettings = settingsState.loadSettings;

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (viewMode !== "workspace") {
      setComposerOffset(0);
      return;
    }

    const node = composerRef.current;
    if (!node) {
      return;
    }

    const measure = (): void => {
      const next = Math.ceil(node.getBoundingClientRect().height + 16);
      setComposerOffset((prev) => (Math.abs(prev - next) > 1 ? next : prev));
    };

    measure();

    const resizeObserver = new ResizeObserver(() => {
      measure();
    });

    resizeObserver.observe(node);
    window.addEventListener("resize", measure);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [viewMode]);

  const geminiCostSummary = useMemo(
    () =>
      estimateGeminiCostSummary(sessionState.turnRecords, {
        reasoningTokenShare: 0.25,
        cacheReadTokenShare: 0,
        cacheWriteTokenShare: 0
      }),
    [sessionState.turnRecords]
  );

  const compactTotalLabel = useMemo(
    () => formatCompactEuro(geminiCostSummary.totalBillableUsd),
    [geminiCostSummary.totalBillableUsd]
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

  const shellStyle = {
    "--composer-offset": `${composerOffset}px`
  } as CSSProperties;

  return (
    <div className="app-shell compact-shell" style={shellStyle}>
      <header className="topbar">
        <button
          type="button"
          className="stats-btn"
          onClick={() => {
            setStatsOpen((open) => !open);
          }}
          aria-expanded={statsOpen}
        >
          {compactTotalLabel}
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
        <div ref={composerRef} className="floating-composer-wrap">
          <MessageComposer disabled={sessionState.busy || !settingsState.hydrated} onSend={runPrompt} />
        </div>
      ) : null}

      {sessionState.busy ? <Spinner label="Assistant is working..." className="busy-indicator" /> : null}
    </div>
  );
}
