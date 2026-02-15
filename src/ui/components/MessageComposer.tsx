import { ArrowUp16Regular } from "@fluentui/react-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface MessageComposerProps {
  disabled?: boolean;
  onSend: (prompt: string) => Promise<void>;
}

const MIN_TEXTAREA_HEIGHT_PX = 24;
const MAX_TEXTAREA_HEIGHT_PX = 136;

export function MessageComposer({ disabled, onSend }: MessageComposerProps): JSX.Element {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const canSend = useMemo(() => value.trim().length > 0 && !disabled, [value, disabled]);

  const resizeTextarea = useCallback((): void => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    const nextHeight = Math.max(MIN_TEXTAREA_HEIGHT_PX, Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT_PX));
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > MAX_TEXTAREA_HEIGHT_PX ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

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
      <textarea
        ref={textareaRef}
        className="composer-textarea"
        rows={1}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
        }}
        onInput={() => {
          resizeTextarea();
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

      <button
        type="button"
        className="send-arrow-btn"
        aria-label="Send message"
        disabled={!canSend}
        onClick={() => {
          void submit();
        }}
      >
        <ArrowUp16Regular />
      </button>
    </div>
  );
}
