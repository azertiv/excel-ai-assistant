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
      <Button className="action-btn" size="small" disabled={disabled} onClick={() => void onCaptureSelectionContext()}>
        Selection
      </Button>
      <Button className="action-btn" size="small" disabled={disabled} onClick={() => void onSummarizeWorkbook()}>
        Summarize
      </Button>
      <Button className="action-btn" size="small" disabled={disabled} onClick={() => void onCreateDocumentationSheet()}>
        Document
      </Button>
      <Button className="action-btn action-btn-danger" size="small" disabled={disabled} onClick={() => void onUndoLastTurn()}>
        Undo
      </Button>
    </div>
  );
}
