import { Body1, Caption1, Divider, Text } from "@fluentui/react-components";
import type { ChatMessage } from "@/state/types";
import { splitByCitations } from "@/utils/citations";
import { CitationLink } from "./CitationLink";

interface ChatViewProps {
  messages: ChatMessage[];
}

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

export function ChatView({ messages }: ChatViewProps): JSX.Element {
  const assistantCitations = Array.from(
    new Set(
      messages
        .filter((message) => message.role === "assistant")
        .flatMap((message) => message.citations?.map((citation) => citation.address) ?? [])
    )
  );

  return (
    <div className="chat-panel">
      <div className="chat-scroll">
        {messages.map((message) => {
          const parts = splitByCitations(message.content);
          return (
            <article key={message.id} className={`chat-message chat-${message.role}`}>
              <div className="chat-meta">
                <span className={`chat-role-pill role-${message.role}`}>{ROLE_LABEL[message.role] ?? message.role}</span>
                <Caption1>{formatTime(message.createdAt)}</Caption1>
              </div>

              <Body1>
                {parts.map((part, index) => {
                  if (part.type === "citation") {
                    return <CitationLink key={`${message.id}_${index}`} address={part.value} label={`[[${part.value}]]`} />;
                  }
                  return <span key={`${message.id}_${index}`}>{part.value}</span>;
                })}
              </Body1>

              {message.streaming ? <Caption1>Streaming response…</Caption1> : null}
            </article>
          );
        })}
      </div>

      <Divider />

      <div className="sources-block">
        <Text weight="semibold">Sources</Text>
        {assistantCitations.length === 0 ? <Caption1>No citations yet.</Caption1> : null}
        <div className="sources-list">
          {assistantCitations.map((address) => (
            <CitationLink key={address} address={address} label={address} />
          ))}
        </div>
      </div>
    </div>
  );
}
