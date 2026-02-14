import { Body1, Caption1, Card, CardHeader, Divider, Text } from "@fluentui/react-components";
import type { TimelineStep, ToolTimelineCard } from "@/state/types";

interface AgentTimelineProps {
  steps: TimelineStep[];
  toolCards: ToolTimelineCard[];
  compact?: boolean;
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

function toolStatusLabel(status: ToolTimelineCard["status"]): string {
  if (status === "success") {
    return "Done";
  }
  if (status === "running") {
    return "Running";
  }
  if (status === "error") {
    return "Error";
  }
  if (status === "cancelled") {
    return "Cancelled";
  }
  return "Pending";
}

export function AgentTimeline({ steps, toolCards, compact = false }: AgentTimelineProps): JSX.Element {
  return (
    <div className="timeline-panel">
      {!compact ? (
        <div className="timeline-head">
          <Text weight="semibold">Agent Timeline</Text>
          <Caption1>Live execution trace</Caption1>
        </div>
      ) : null}

      <div className="timeline-steps">
        {steps.map((step) => (
          <Card key={step.id} size="small" className={`timeline-step-card status-${step.status}`}>
            <CardHeader
              header={<Body1>{step.label}</Body1>}
              description={<span className={`status-pill status-${step.status}`}>{statusLabel(step.status)}</span>}
            />

            {step.details.length > 0 ? (
              <div className="timeline-details">
                {step.details.map((detail, index) => (
                  <Caption1 key={`${step.id}_${index}`}>{detail}</Caption1>
                ))}
              </div>
            ) : (
              <Caption1 className="timeline-placeholder">Waiting for updates.</Caption1>
            )}
          </Card>
        ))}
      </div>

      {toolCards.length > 0 ? <Divider /> : null}

      <div className="tool-cards">
        {toolCards.map((tool) => (
          <Card key={tool.id} size="small" className={`tool-card status-${tool.status}`}>
            <CardHeader
              header={<Body1>{tool.toolName}</Body1>}
              description={<span className={`status-pill status-${tool.status}`}>{toolStatusLabel(tool.status)}</span>}
            />

            <div className="tool-grid">
              <Caption1>
                <strong>Targets:</strong> {tool.targetRanges.length ? tool.targetRanges.join(", ") : "n/a"}
              </Caption1>
              <Caption1>
                <strong>Reason:</strong> {tool.reason}
              </Caption1>
              <Caption1>
                <strong>Duration:</strong> {tool.durationMs ? `${tool.durationMs}ms` : "-"}
              </Caption1>
            </div>

            <details>
              <summary>Expand details</summary>
              <pre className="tool-details-pre">Args: {tool.argsPreview}</pre>
              <pre className="tool-details-pre">Result: {tool.resultPreview}</pre>
            </details>
          </Card>
        ))}
      </div>
    </div>
  );
}
