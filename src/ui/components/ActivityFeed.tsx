import { Body1, Caption1, Text } from "@fluentui/react-components";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, RangeChange, TimelineEvent } from "@/state/types";
import { MarkdownContent } from "./MarkdownContent";

interface ActivityFeedProps {
  messages: ChatMessage[];
  timelineEvents: TimelineEvent[];
  rangeChanges: RangeChange[];
  onRevertChange: (change: RangeChange) => Promise<void>;
}

type ActivityItem =
  | { id: string; createdAt: string; kind: "message"; message: ChatMessage }
  | { id: string; createdAt: string; kind: "timeline"; event: TimelineEvent }
  | { id: string; createdAt: string; kind: "change"; change: RangeChange };

const ROLE_LABEL: Record<string, string> = {
  user: "You",
  assistant: "Assistant",
  tool: "Tool",
  memory: "Memory",
  system: "System"
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function toTimestamp(value: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return parsed;
}

function previewMatrix(values: unknown[][], formulas: string[][]): string {
  return values
    .slice(0, 4)
    .map((row, rowIndex) =>
      row
        .slice(0, 6)
        .map((value, colIndex) => {
          const formula = formulas[rowIndex]?.[colIndex] ?? "";
          if (formula.startsWith("=")) {
            return formula;
          }
          return String(value ?? "");
        })
        .join(" | ")
    )
    .join("\n");
}

function TimelineStatusIcon({ status }: { status: TimelineEvent["status"] }): JSX.Element {
  if (status === "running") {
    return <span className="timeline-status-icon spinner" aria-hidden="true" />;
  }

  if (status === "success") {
    return <span className="timeline-status-icon success">✓</span>;
  }

  if (status === "error") {
    return <span className="timeline-status-icon error">!</span>;
  }

  return <span className="timeline-status-icon pending">•</span>;
}

export function ActivityFeed({ messages, timelineEvents, rangeChanges, onRevertChange }: ActivityFeedProps): JSX.Element {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const items = useMemo<ActivityItem[]>(() => {
    const merged: ActivityItem[] = [
      ...messages.map((message) => ({
        id: `msg_${message.id}`,
        createdAt: message.createdAt,
        kind: "message" as const,
        message
      })),
      ...timelineEvents.map((event) => ({
        id: `timeline_${event.id}`,
        createdAt: event.createdAt,
        kind: "timeline" as const,
        event
      })),
      ...rangeChanges.map((change) => ({
        id: `change_${change.id}`,
        createdAt: change.createdAt,
        kind: "change" as const,
        change
      }))
    ];

    return merged.sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt));
  }, [messages, timelineEvents, rangeChanges]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth"
    });
  }, [items.length]);

  const toggleExpanded = (id: string): void => {
    setExpanded((state) => ({
      ...state,
      [id]: !state[id]
    }));
  };

  if (items.length === 0) {
    return (
      <div className="activity-empty">
        <Text weight="semibold">No activity yet</Text>
        <Caption1>Send your first request from the bottom input bar.</Caption1>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="activity-feed">
      {items.map((item) => {
        if (item.kind === "message") {
          const message = item.message;
          return (
            <article key={item.id} className={`feed-card message-card role-${message.role}`}>
              <div className="feed-card-top">
                <span className={`message-role role-${message.role}`}>{ROLE_LABEL[message.role] ?? message.role}</span>
                <Caption1>{formatTime(message.createdAt)}</Caption1>
              </div>

              <div className="feed-card-body">
                <MarkdownContent text={message.content} />
              </div>

              {message.streaming ? <Caption1 className="streaming-label">Streaming response...</Caption1> : null}
            </article>
          );
        }

        if (item.kind === "timeline") {
          const event = item.event;
          const hasDetails = Boolean(event.detail);
          const isExpanded = expanded[item.id] ?? false;

          return (
            <article key={item.id} className="feed-card timeline-card">
              <div className="compact-row">
                <div className="compact-main">
                  <TimelineStatusIcon status={event.status} />
                  <Body1>{event.label}</Body1>
                </div>

                <div className="compact-actions">
                  <Caption1>{formatTime(event.createdAt)}</Caption1>
                  {hasDetails ? (
                    <button
                      type="button"
                      className="compact-toggle"
                      onClick={() => {
                        toggleExpanded(item.id);
                      }}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? "▾" : "▸"}
                    </button>
                  ) : null}
                </div>
              </div>

              {hasDetails && isExpanded ? <p className="compact-details">{event.detail}</p> : null}
            </article>
          );
        }

        const change = item.change;
        const isExpanded = expanded[item.id] ?? false;

        return (
          <article key={item.id} className={`feed-card change-card ${change.reverted ? "is-reverted" : ""}`}>
            <div className="compact-row">
              <div className="compact-main">
                <span className="change-dot" aria-hidden="true" />
                <Body1>{change.address}</Body1>
              </div>

              <div className="compact-actions">
                <button
                  type="button"
                  className="revert-round-btn"
                  disabled={change.reverted}
                  title={change.reverted ? "Already reverted" : "Revert this change"}
                  onClick={() => {
                    void onRevertChange(change);
                  }}
                >
                  ↺
                </button>
                <button
                  type="button"
                  className="compact-toggle"
                  onClick={() => {
                    toggleExpanded(item.id);
                  }}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? "▾" : "▸"}
                </button>
              </div>
            </div>

            <Caption1 className="change-meta">
              {change.changedCellCount} cell{change.changedCellCount > 1 ? "s" : ""} changed · {formatTime(change.createdAt)}
            </Caption1>

            {isExpanded ? (
              <div className="compact-details-grid">
                <Caption1>{change.reason}</Caption1>
                <div>
                  <Caption1>Before</Caption1>
                  <pre className="compact-pre">{previewMatrix(change.before.values, change.before.formulas)}</pre>
                </div>
                <div>
                  <Caption1>After</Caption1>
                  <pre className="compact-pre">{previewMatrix(change.after.values, change.after.formulas)}</pre>
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
