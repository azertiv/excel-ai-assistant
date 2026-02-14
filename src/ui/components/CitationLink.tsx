import { Button } from "@fluentui/react-components";
import { selectAndFlashRange } from "@/office/excelClient";
import { useState } from "react";

interface CitationLinkProps {
  address: string;
  label?: string;
}

export function CitationLink({ address, label }: CitationLinkProps): JSX.Element {
  const [busy, setBusy] = useState(false);

  const handleClick = async (): Promise<void> => {
    try {
      setBusy(true);
      await selectAndFlashRange(address);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="small"
      appearance="subtle"
      disabled={busy}
      onClick={() => {
        void handleClick();
      }}
    >
      {label ?? address}
    </Button>
  );
}
