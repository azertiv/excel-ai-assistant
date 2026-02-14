import { Button } from "@fluentui/react-components";

interface ActionToolbarProps {
  disabled?: boolean;
  onCaptureSelectionContext: () => Promise<void>;
  onSummarizeWorkbook: () => Promise<void>;
  onCreateDocumentationSheet: () => Promise<void>;
  onUndoLastTurn: () => Promise<void>;
}

export function ActionToolbar({
  disabled,
  onCaptureSelectionContext,
  onSummarizeWorkbook,
  onCreateDocumentationSheet,
  onUndoLastTurn
}: ActionToolbarProps): JSX.Element {
  return (
    <div className="action-toolbar">
      <Button size="small" disabled={disabled} onClick={() => void onCaptureSelectionContext()}>
        Capture selection context
      </Button>
      <Button size="small" disabled={disabled} onClick={() => void onSummarizeWorkbook()}>
        Summarize workbook
      </Button>
      <Button size="small" disabled={disabled} onClick={() => void onCreateDocumentationSheet()}>
        Create documentation sheet
      </Button>
      <Button size="small" appearance="outline" disabled={disabled} onClick={() => void onUndoLastTurn()}>
        Undo last turn
      </Button>
    </div>
  );
}
