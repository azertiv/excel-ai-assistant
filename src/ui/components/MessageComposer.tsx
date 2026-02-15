import { Button, Textarea } from "@fluentui/react-components";
import { ArrowUp16Regular } from "@fluentui/react-icons";
import { useMemo, useState } from "react";

interface MessageComposerProps {
  disabled?: boolean;
  onSend: (prompt: string) => Promise<void>;
}

export function MessageComposer({ disabled, onSend }: MessageComposerProps): JSX.Element {
  const [value, setValue] = useState("");

  const canSend = useMemo(() => value.trim().length > 0 && !disabled, [value, disabled]);

  const submit = async (): Promise<void> => {
    const prompt = value.trim();
    if (!prompt || disabled) {
      return;
    }

    setValue("");
    await onSend(prompt);
  };

  return (
    <div className="composer">
      <Textarea
        resize="none"
        rows={1}
        value={value}
        onChange={(_, data) => {
          setValue(data.value);
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void submit();
          }
        }}
        placeholder="Ask about your workbook..."
        disabled={disabled}
      />

      <div className="composer-actions">
        <Button
          className="send-arrow-btn"
          appearance="primary"
          icon={<ArrowUp16Regular />}
          aria-label="Send message"
          disabled={!canSend}
          onClick={() => {
            void submit();
          }}
        />
      </div>
    </div>
  );
}
