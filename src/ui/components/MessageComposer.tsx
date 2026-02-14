import { Button, Textarea } from "@fluentui/react-components";
import { useState } from "react";

interface MessageComposerProps {
  disabled?: boolean;
  onSend: (prompt: string) => Promise<void>;
}

export function MessageComposer({ disabled, onSend }: MessageComposerProps): JSX.Element {
  const [value, setValue] = useState("");

  const submit = async (): Promise<void> => {
    const prompt = value.trim();
    if (!prompt) {
      return;
    }
    setValue("");
    await onSend(prompt);
  };

  return (
    <div className="composer">
      <Textarea
        resize="vertical"
        rows={4}
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
        placeholder="Ask anything about the workbook. Use Cmd/Ctrl + Enter to send."
        disabled={disabled}
      />

      <div className="composer-actions">
        <Button appearance="primary" disabled={disabled} onClick={() => void submit()}>
          Send request
        </Button>
      </div>
    </div>
  );
}
