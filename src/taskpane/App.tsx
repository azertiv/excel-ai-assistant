import {
  Body1,
  Caption1,
  Select,
  Spinner,
  Switch,
  Tab,
  TabList,
  Text
} from "@fluentui/react-components";
import { useEffect, useMemo, useState } from "react";
import { agentRunner } from "@/llm/agentRunner";
import { createDocumentationSheet, getContextPack, undoTurnChanges } from "@/office/excelClient";
import { revertRangeChange } from "@/office/tools";
import { useSessionStore } from "@/state/sessionStore";
import { useSettingsStore } from "@/state/settingsStore";
import type { RangeChange } from "@/state/types";
import { ActionToolbar } from "@/ui/components/ActionToolbar";
import { AgentTimeline } from "@/ui/components/AgentTimeline";
import { ChatView } from "@/ui/components/ChatView";
import { DiffCard } from "@/ui/components/DiffCard";
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
  const [activeTab, setActiveTab] = useState<"chat" | "timeline" | "diffs" | "settings">("chat");

  const loadSettings = settingsState.loadSettings;

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const currentModel = settingsState.settings.models[settingsState.settings.provider];

  const pendingChanges = useMemo(
    () => sessionState.rangeChanges.filter((change) => !change.reverted),
    [sessionState.rangeChanges]
  );

  const stats = useMemo(
    () => [
      {
        label: "Turns",
        value: String(sessionState.turnRecords.length)
      },
      {
        label: "Pending",
        value: String(pendingChanges.length)
      },
      {
        label: "Messages",
        value: String(sessionState.messages.length)
      },
      {
        label: "Budget",
        value: settingsState.settings.maxTokenBudget.toLocaleString()
      }
    ],
    [sessionState.turnRecords.length, pendingChanges.length, sessionState.messages.length, settingsState.settings.maxTokenBudget]
  );

  const runPrompt = async (prompt: string): Promise<void> => {
    await agentRunner.runTurn({
      prompt,
      askApproval: askApprovalDialog
    });
  };

  const onCaptureSelectionContext = async (): Promise<void> => {
    try {
      const context = await getContextPack({
        includeWorkbookMap: true,
        includeCharts: false,
        includePivots: false,
        includeTables: true,
        maxRows: 10,
        maxColumns: 10
      });

      sessionState.addMessage({
        role: "assistant",
        content: `Captured selection context from [[${context.selection.address}]]. Active sheet is ${context.activeSheet}.`,
        citations: [{ address: context.selection.address, label: context.selection.address }]
      });
    } catch (error) {
      sessionState.addMessage({
        role: "assistant",
        content: `Failed to capture selection context: ${error instanceof Error ? error.message : String(error)}`,
        citations: []
      });
    }
  };

  const onSummarizeWorkbook = async (): Promise<void> => {
    await runPrompt("Summarize the workbook structure and key formulas using citations for each claim.");
  };

  const onCreateDocumentationSheet = async (): Promise<void> => {
    try {
      const context = await getContextPack({
        includeWorkbookMap: true,
        includeCharts: true,
        includePivots: true,
        includeTables: true,
        maxRows: 10,
        maxColumns: 10
      });
      const sheetName = await createDocumentationSheet(context);

      sessionState.addMessage({
        role: "assistant",
        content: `Created documentation sheet [[${sheetName}!A1:C20]] with workbook metadata and map.`,
        citations: [{ address: `${sheetName}!A1:C20`, label: `${sheetName}!A1:C20` }]
      });
    } catch (error) {
      sessionState.addMessage({
        role: "assistant",
        content: `Could not create documentation sheet: ${error instanceof Error ? error.message : String(error)}`,
        citations: []
      });
    }
  };

  const onRevertChange = async (change: RangeChange): Promise<void> => {
    await revertRangeChange(change);
    sessionState.markRangeChangeReverted(change.id);
  };

  const onUndoLastTurn = async (): Promise<void> => {
    const lastTurn = sessionState.turnRecords[0];
    if (!lastTurn) {
      sessionState.addMessage({
        role: "assistant",
        content: "No previous turn found to undo.",
        citations: []
      });
      return;
    }

    await undoTurnChanges(lastTurn.id, sessionState.rangeChanges);
    sessionState.rangeChanges
      .filter((change) => change.turnId === lastTurn.id)
      .forEach((change) => sessionState.markRangeChangeReverted(change.id));

    sessionState.addMessage({
      role: "assistant",
      content: `Reverted changes from the previous turn (${lastTurn.id}).`,
      citations: lastTurn.editedRanges.map((range) => ({ address: range, label: range }))
    });
  };

  return (
    <div className="app-shell">
      <div className="bg-orb bg-orb-a" />
      <div className="bg-orb bg-orb-b" />

      <header className="hero-header">
        <div className="hero-copy">
          <Caption1 className="hero-kicker">Excel AI Studio</Caption1>
          <Text size={600} weight="semibold" block>
            Precision answers inside your workbook
          </Text>
          <Body1 className="hero-subtitle">
            Every response is cited, every edit is traceable, every action is reviewable.
          </Body1>
        </div>

        <div className="hero-controls">
          <div className="hero-chip-row">
            <span className="hero-chip">Provider: {settingsState.settings.provider}</span>
            <span className="hero-chip">Model: {currentModel}</span>
            <span className={`hero-chip ${sessionState.busy ? "chip-busy" : "chip-ready"}`}>
              {sessionState.busy ? "Running" : "Ready"}
            </span>
          </div>

          <div className="hero-control-row">
            <Select
              value={currentModel}
              onChange={(_, data) => {
                settingsState.setModel(settingsState.settings.provider, data.value);
              }}
            >
              {settingsState.settings.provider === "gemini" ? (
                <>
                  <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
                  <option value="gemini-3-flash-lite">gemini-3-flash-lite</option>
                  <option value={currentModel}>{currentModel}</option>
                </>
              ) : (
                <option value={currentModel}>{currentModel}</option>
              )}
            </Select>

            <Switch
              checked={settingsState.settings.approvalMode}
              label={settingsState.settings.approvalMode ? "Approval mode" : "Autonomous mode"}
              onChange={(_, data) => {
                settingsState.updateSettings({ approvalMode: data.checked });
              }}
            />
          </div>
        </div>
      </header>

      <section className="stats-ribbon">
        {stats.map((stat) => (
          <article key={stat.label} className="stat-card">
            <Caption1>{stat.label}</Caption1>
            <Text weight="semibold" size={400}>
              {stat.value}
            </Text>
          </article>
        ))}
      </section>

      <section className="workbench-card">
        <ActionToolbar
          disabled={sessionState.busy}
          onCaptureSelectionContext={onCaptureSelectionContext}
          onSummarizeWorkbook={onSummarizeWorkbook}
          onCreateDocumentationSheet={onCreateDocumentationSheet}
          onUndoLastTurn={onUndoLastTurn}
        />

        <div className="surface-tabs">
          <TabList
            selectedValue={activeTab}
            onTabSelect={(_, data) => {
              setActiveTab(data.value as typeof activeTab);
            }}
          >
            <Tab value="chat">Chat</Tab>
            <Tab value="timeline">Timeline</Tab>
            <Tab value="diffs">Changes ({pendingChanges.length})</Tab>
            <Tab value="settings">Settings</Tab>
          </TabList>
        </div>

        <div className="surface-view">
          {activeTab === "chat" ? <ChatView messages={sessionState.messages} /> : null}

          {activeTab === "timeline" ? (
            <section className="panel-single">
              <AgentTimeline steps={sessionState.timelineSteps} toolCards={sessionState.toolCards} />
            </section>
          ) : null}

          {activeTab === "diffs" ? (
            <div className="diff-list">
              {sessionState.rangeChanges.map((change) => (
                <DiffCard key={change.id} change={change} onRevert={onRevertChange} />
              ))}
              {sessionState.rangeChanges.length === 0 ? <Body1>No edits yet.</Body1> : null}
            </div>
          ) : null}

          {activeTab === "settings" ? (
            <section className="panel-single">
              <SettingsPanel />
            </section>
          ) : null}
        </div>

        {activeTab === "chat" ? (
          <div className="composer-shell">
            <MessageComposer disabled={sessionState.busy || !settingsState.hydrated} onSend={runPrompt} />
          </div>
        ) : null}
      </section>

      {sessionState.busy ? <Spinner label="Assistant is working..." className="busy-indicator" /> : null}
    </div>
  );
}
