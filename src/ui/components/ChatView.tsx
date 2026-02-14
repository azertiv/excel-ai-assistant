import { Body1, Caption1, Divider, Text } from "@fluentui/react-components";
import type { ChatMessage } from "@/state/types";
import { splitByCitations } from "@/utils/citations";
import { CitationLink } from "./CitationLink";

interface ChatViewProps {
  messages: ChatMessage[];
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
      {messages.map((message) => {
        const parts = splitByCitations(message.content);
        return (
          <div key={message.id} className={`chat-message chat-${message.role}`}>
            <Text weight="semibold" size={200}>
              {message.role.toUpperCase()}
            </Text>
            <Body1 as="div">
              {parts.map((part, index) => {
                if (part.type === "citation") {
                  return <CitationLink key={`${message.id}_${index}`} address={part.value} label={`[[${part.value}]]`} />;
                }
                return <span key={`${message.id}_${index}`}>{part.value}</span>;
              })}
            </Body1>
            {message.streaming ? <Caption1>Streaming...</Caption1> : null}
          </div>
        );
      })}

      <Divider />
      <div className="sources-block">
        <Text weight="semibold">Sources</Text>
        {assistantCitations.length === 0 ? <Caption1>No citations yet.</Caption1> : null}
        {assistantCitations.map((address) => (
          <CitationLink key={address} address={address} label={address} />
        ))}
      </div>
    </div>
  );
}
