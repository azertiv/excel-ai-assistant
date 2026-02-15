import type { ReactNode } from "react";
import { CitationLink } from "./CitationLink";

interface MarkdownContentProps {
  text: string;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const tokenPattern =
    /(\[\[[^[\]]+\]\]|`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|~~[^~\n]+~~|\[[^\]]+\]\((?:https?:\/\/|mailto:)[^)]+\))/g;

  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    const token = match[0];
    const tokenStart = match.index;

    if (tokenStart > cursor) {
      nodes.push(text.slice(cursor, tokenStart));
    }

    if (token.startsWith("[[") && token.endsWith("]]")) {
      const address = token.slice(2, -2).trim();
      nodes.push(
        <CitationLink key={`${keyPrefix}_citation_${tokenStart}`} address={address} label={`[[${address}]]`} />
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      const value = token.slice(2, -2);
      nodes.push(<strong key={`${keyPrefix}_strong_${tokenStart}`}>{value}</strong>);
    } else if (token.startsWith("__") && token.endsWith("__")) {
      const value = token.slice(2, -2);
      nodes.push(<strong key={`${keyPrefix}_strongu_${tokenStart}`}>{value}</strong>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      const value = token.slice(1, -1);
      nodes.push(<em key={`${keyPrefix}_em_${tokenStart}`}>{value}</em>);
    } else if (token.startsWith("_") && token.endsWith("_")) {
      const value = token.slice(1, -1);
      nodes.push(<em key={`${keyPrefix}_emu_${tokenStart}`}>{value}</em>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      const value = token.slice(1, -1);
      nodes.push(<code key={`${keyPrefix}_code_${tokenStart}`}>{value}</code>);
    } else if (token.startsWith("~~") && token.endsWith("~~")) {
      const value = token.slice(2, -2);
      nodes.push(<del key={`${keyPrefix}_del_${tokenStart}`}>{value}</del>);
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const [, label, url] = linkMatch;
        nodes.push(
          <a key={`${keyPrefix}_link_${tokenStart}`} href={url} target="_blank" rel="noreferrer">
            {label}
          </a>
        );
      } else {
        nodes.push(token);
      }
    } else {
      nodes.push(token);
    }

    cursor = tokenStart + token.length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

export function MarkdownContent({ text }: MarkdownContentProps): JSX.Element {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];

  let paragraph: string[] = [];
  let unorderedItems: string[] = [];
  let orderedItems: string[] = [];
  let inCodeBlock = false;
  let codeLanguage = "";
  let codeLines: string[] = [];

  const flushParagraph = (index: number): void => {
    if (paragraph.length === 0) {
      return;
    }

    const content = paragraph.join(" ").trim();
    if (content) {
      blocks.push(
        <p key={`p_${index}`} className="md-paragraph">
          {renderInline(content, `p_${index}`)}
        </p>
      );
    }

    paragraph = [];
  };

  const flushUnordered = (index: number): void => {
    if (unorderedItems.length === 0) {
      return;
    }

    blocks.push(
      <ul key={`ul_${index}`} className="md-list">
        {unorderedItems.map((item, itemIndex) => (
          <li key={`ul_${index}_${itemIndex}`}>{renderInline(item, `ul_${index}_${itemIndex}`)}</li>
        ))}
      </ul>
    );

    unorderedItems = [];
  };

  const flushOrdered = (index: number): void => {
    if (orderedItems.length === 0) {
      return;
    }

    blocks.push(
      <ol key={`ol_${index}`} className="md-list md-list-ordered">
        {orderedItems.map((item, itemIndex) => (
          <li key={`ol_${index}_${itemIndex}`}>{renderInline(item, `ol_${index}_${itemIndex}`)}</li>
        ))}
      </ol>
    );

    orderedItems = [];
  };

  const flushCodeBlock = (index: number): void => {
    const value = codeLines.join("\n");
    blocks.push(
      <pre key={`code_${index}`} className="md-code-block">
        <code data-lang={codeLanguage || undefined}>{value}</code>
      </pre>
    );

    codeLines = [];
    codeLanguage = "";
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flushParagraph(index);
      flushUnordered(index);
      flushOrdered(index);

      if (inCodeBlock) {
        flushCodeBlock(index);
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLanguage = trimmed.slice(3).trim();
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    if (!trimmed) {
      flushParagraph(index);
      flushUnordered(index);
      flushOrdered(index);
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph(index);
      flushUnordered(index);
      flushOrdered(index);

      const headingHashes = headingMatch[1] ?? "";
      const headingRawText = headingMatch[2] ?? "";
      const level = Math.min(4, headingHashes.length);
      const headingText = headingRawText.trim();
      const className = `md-heading md-h${level}`;

      if (level === 1) {
        blocks.push(
          <h1 key={`h_${index}`} className={className}>
            {renderInline(headingText, `h_${index}`)}
          </h1>
        );
      } else if (level === 2) {
        blocks.push(
          <h2 key={`h_${index}`} className={className}>
            {renderInline(headingText, `h_${index}`)}
          </h2>
        );
      } else if (level === 3) {
        blocks.push(
          <h3 key={`h_${index}`} className={className}>
            {renderInline(headingText, `h_${index}`)}
          </h3>
        );
      } else {
        blocks.push(
          <h4 key={`h_${index}`} className={className}>
            {renderInline(headingText, `h_${index}`)}
          </h4>
        );
      }
      return;
    }

    const unorderedMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph(index);
      flushOrdered(index);
      const unorderedText = unorderedMatch[1];
      if (unorderedText) {
        unorderedItems.push(unorderedText);
      }
      return;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph(index);
      flushUnordered(index);
      const orderedText = orderedMatch[1];
      if (orderedText) {
        orderedItems.push(orderedText);
      }
      return;
    }

    const quoteMatch = trimmed.match(/^>\s+(.+)$/);
    if (quoteMatch) {
      flushParagraph(index);
      flushUnordered(index);
      flushOrdered(index);
      const quoteText = quoteMatch[1];
      if (!quoteText) {
        return;
      }
      blocks.push(
        <blockquote key={`q_${index}`} className="md-quote">
          {renderInline(quoteText, `q_${index}`)}
        </blockquote>
      );
      return;
    }

    paragraph.push(trimmed);
  });

  flushParagraph(lines.length + 1);
  flushUnordered(lines.length + 1);
  flushOrdered(lines.length + 1);

  if (inCodeBlock) {
    flushCodeBlock(lines.length + 2);
  }

  return <div className="markdown-body">{blocks}</div>;
}
