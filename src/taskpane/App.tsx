import { Body1, Caption1, Select, Spinner, Switch, Tab, TabList, Text } from "@fluentui/react-components";
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
  const [viewMode, setViewMode] = useState<"workspace" | "settings">("workspace");

  const loadSettings = settingsState.loadSettings;

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const currentModel = settingsState.settings.models[settingsState.settings.provider];

  const pendingChanges = useMemo(
    () => sessionState.rangeChanges.filter((change) => !change.reverted),
    [sessionState.rangeChanges]
  );
  const assistantMessageCount = useMemo(
    () => sessionState.messages.filter((message) => message.role === "assistant").length,
    [sessionState.messages]
  );
  const completedToolCount = useMemo(
    () => sessionState.toolCards.filter((tool) => tool.status === "success").length,
    [sessionState.toolCards]
  );
  const completedStepCount = useMemo(
    () => sessionState.timelineSteps.filter((step) => step.status === "success").length,
    [sessionState.timelineSteps]
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
      <header className="pane-header">
        <div className="pane-head-main">
          <div className="pane-title-group">
            <Text size={500} weight="semibold" block>
              Excel AI Assistant
            </Text>
            <Caption1>Minimal workspace for workbook chat, citations, and reversible edits.</Caption1>
          </div>

          <div className="pane-controls">
            <div className="control-status-row">
              <span className={`status-chip ${sessionState.busy ? "busy" : "ready"}`}>
                {sessionState.busy ? "Running" : "Ready"}
              </span>
              <Switch
                checked={settingsState.settings.approvalMode}
                label={settingsState.settings.approvalMode ? "Approval mode" : "Autonomous mode"}
                onChange={(_, data) => {
                  settingsState.updateSettings({ approvalMode: data.checked });
                }}
              />
            </div>

            <div className="model-select-wrap">
              <Caption1>Model</Caption1>
              <Select
                value={currentModel}
                onChange={(_, data) => {
                  settingsState.setModel(settingsState.settings.provider, data.value);
                }}
              >
                {settingsState.settings.provider === "gemini" ? (
                  <>
                    <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
                    <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</option>
                    <option value={currentModel}>{currentModel}</option>
                  </>
                ) : (
                  <option value={currentModel}>{currentModel}</option>
                )}
              </Select>
            </div>
          </div>
        </div>

        <div className="overview-grid">
          <article className="overview-card">
            <Caption1>Total messages</Caption1>
            <Text size={500} weight="semibold">
              {sessionState.messages.length}
            </Text>
          </article>
          <article className="overview-card">
            <Caption1>Assistant replies</Caption1>
            <Text size={500} weight="semibold">
              {assistantMessageCount}
            </Text>
          </article>
          <article className="overview-card">
            <Caption1>Tools completed</Caption1>
            <Text size={500} weight="semibold">
              {completedToolCount}
            </Text>
          </article>
          <article className="overview-card">
            <Caption1>Pending edits</Caption1>
            <Text size={500} weight="semibold">
              {pendingChanges.length}
            </Text>
          </article>
        </div>
      </header>

      <section className="main-surface">
        <div className="main-nav">
          <div className="main-nav-meta">
            <Text weight="semibold">{viewMode === "workspace" ? "Workspace" : "Settings"}</Text>
            <Caption1>
              {viewMode === "workspace"
                ? "Run prompts and monitor live execution."
                : "Provider, safety, and runtime controls."}
            </Caption1>
          </div>

          <TabList
            className="view-tabs"
            selectedValue={viewMode}
            onTabSelect={(_, data) => {
              setViewMode(data.value as typeof viewMode);
            }}
          >
            <Tab value="workspace">Workspace</Tab>
            <Tab value="settings">Settings</Tab>
          </TabList>
        </div>

        {viewMode === "workspace" ? (
          <div className="workspace-stack">
            <section className="panel panel-requests">
              <div className="panel-head">
                <Text weight="semibold">Requests</Text>
                <Caption1>{sessionState.messages.length} messages tracked</Caption1>
              </div>

              <ActionToolbar
                disabled={sessionState.busy}
                onCaptureSelectionContext={onCaptureSelectionContext}
                onSummarizeWorkbook={onSummarizeWorkbook}
                onCreateDocumentationSheet={onCreateDocumentationSheet}
                onUndoLastTurn={onUndoLastTurn}
              />

              <div className="panel-body">
                <ChatView messages={sessionState.messages} />
              </div>

              <div className="panel-foot">
                <MessageComposer disabled={sessionState.busy || !settingsState.hydrated} onSend={runPrompt} />
              </div>
            </section>

            <section className="panel panel-timeline">
              <div className="panel-head">
                <Text weight="semibold">Live Timeline</Text>
                <Caption1>
                  {sessionState.toolCards.length} tool calls · {completedStepCount}/{sessionState.timelineSteps.length} steps
                </Caption1>
              </div>
              <div className="panel-body">
                <AgentTimeline steps={sessionState.timelineSteps} toolCards={sessionState.toolCards} compact />
              </div>
            </section>

            <section className="panel panel-changes">
              <div className="panel-head">
                <Text weight="semibold">Changes</Text>
                <Caption1>{pendingChanges.length} pending</Caption1>
              </div>

              <div className="panel-body changes-list">
                {sessionState.rangeChanges.map((change) => (
                  <DiffCard key={change.id} change={change} onRevert={onRevertChange} />
                ))}
                {sessionState.rangeChanges.length === 0 ? <Body1 className="panel-empty">No edits yet.</Body1> : null}
              </div>
            </section>
          </div>
        ) : (
          <div className="settings-stack">
            <SettingsPanel />
          </div>
        )}
      </section>

      {sessionState.busy ? <Spinner label="Assistant is working..." className="busy-indicator" /> : null}
    </div>
  );
}
