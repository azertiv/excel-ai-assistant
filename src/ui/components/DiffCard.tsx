import { Button, Card, CardHeader, Caption1, Divider, Text } from "@fluentui/react-components";
import type { RangeChange } from "@/state/types";

interface DiffCardProps {
  change: RangeChange;
  onRevert: (change: RangeChange) => Promise<void>;
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

export function DiffCard({ change, onRevert }: DiffCardProps): JSX.Element {
  return (
    <Card size="small" className="diff-card">
      <CardHeader
        header={<Text weight="semibold">{change.address}</Text>}
        description={<Caption1>{change.reason}</Caption1>}
      />

      <div className="diff-meta-row">
        <Caption1>
          <strong>Changed cells:</strong> {change.changedCellCount}
        </Caption1>
        <Caption1>
          <strong>Status:</strong> {change.reverted ? "Reverted" : "Active"}
        </Caption1>
      </div>

      <Divider />

      <Caption1>Before</Caption1>
      <pre className="diff-pre">{previewMatrix(change.before.values, change.before.formulas)}</pre>

      <Caption1>After</Caption1>
      <pre className="diff-pre">{previewMatrix(change.after.values, change.after.formulas)}</pre>

      <Button
        size="small"
        appearance={change.reverted ? "secondary" : "outline"}
        disabled={change.reverted}
        onClick={() => {
          void onRevert(change);
        }}
      >
        {change.reverted ? "Already reverted" : "Revert this change"}
      </Button>
    </Card>
  );
}
