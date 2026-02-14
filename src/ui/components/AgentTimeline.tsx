import { Body1, Caption1, Card, CardHeader, Divider, Text } from "@fluentui/react-components";
import type { TimelineStep, ToolTimelineCard } from "@/state/types";

interface AgentTimelineProps {
  steps: TimelineStep[];
  toolCards: ToolTimelineCard[];
}

function statusLabel(status: TimelineStep["status"]): string {
  if (status === "running") {
    return "Running";
  }
  if (status === "success") {
    return "Done";
  }
  if (status === "error") {
    return "Error";
  }
  return "Pending";
}

export function AgentTimeline({ steps, toolCards }: AgentTimelineProps): JSX.Element {
  return (
    <div className="timeline-panel">
      <Text weight="semibold">Agent Timeline</Text>
      {steps.map((step) => (
        <Card key={step.id} size="small" className="timeline-step-card">
          <CardHeader
            header={<Body1>{step.label}</Body1>}
            description={<Caption1>{statusLabel(step.status)}</Caption1>}
          />
          {step.details.length > 0 ? (
            <div className="timeline-details">
              {step.details.map((detail, index) => (
                <Caption1 key={`${step.id}_${index}`}>{detail}</Caption1>
              ))}
            </div>
          ) : null}
        </Card>
      ))}

      {toolCards.length > 0 ? <Divider /> : null}

      {toolCards.map((tool) => (
        <Card key={tool.id} size="small" className="tool-card">
          <CardHeader
            header={<Body1>{tool.toolName}</Body1>}
            description={<Caption1>{tool.status}</Caption1>}
          />
          <Caption1>Targets: {tool.targetRanges.length ? tool.targetRanges.join(", ") : "n/a"}</Caption1>
          <Caption1>Reason: {tool.reason}</Caption1>
          <Caption1>Duration: {tool.durationMs ? `${tool.durationMs}ms` : "-"}</Caption1>
          <details>
            <summary>Expand details</summary>
            <pre className="tool-details-pre">Args: {tool.argsPreview}</pre>
            <pre className="tool-details-pre">Result: {tool.resultPreview}</pre>
          </details>
        </Card>
      ))}
    </div>
  );
}
