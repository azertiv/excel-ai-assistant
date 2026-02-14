const CITATION_REGEX = /\[\[([^\]]+)\]\]/g;

export interface CitationRef {
  label: string;
  address: string;
}

export function extractCitations(text: string): CitationRef[] {
  const citations = new Map<string, CitationRef>();
  for (const match of text.matchAll(CITATION_REGEX)) {
    const raw = match[1]?.trim();
    if (!raw) {
      continue;
    }
    const normalized = raw.replace(/^'/, "").replace(/'!/, "!");
    citations.set(normalized, {
      label: normalized,
      address: normalized
    });
  }
  return [...citations.values()];
}

export function splitByCitations(text: string): Array<{ type: "text" | "citation"; value: string }> {
  const parts: Array<{ type: "text" | "citation"; value: string }> = [];
  let cursor = 0;

  for (const match of text.matchAll(CITATION_REGEX)) {
    const full = match[0];
    const value = match[1];
    const index = match.index ?? 0;

    if (index > cursor) {
      parts.push({ type: "text", value: text.slice(cursor, index) });
    }

    if (value) {
      parts.push({ type: "citation", value: value.trim() });
    } else {
      parts.push({ type: "text", value: full });
    }

    cursor = index + full.length;
  }

  if (cursor < text.length) {
    parts.push({ type: "text", value: text.slice(cursor) });
  }

  return parts;
}
