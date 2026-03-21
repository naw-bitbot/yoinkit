interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function convertMarkdownToHtml(markdown: string): string {
  // Escape HTML entities first to prevent XSS
  let html = escapeHtml(markdown);

  // Fenced code blocks (``` ... ```)
  html = html.replace(
    /```([^\n]*)\n([\s\S]*?)```/g,
    (_, lang, code) => {
      const langAttr = lang.trim() ? ` data-lang="${escapeHtml(lang.trim())}"` : "";
      return `<pre style="background:var(--fill);border:0.5px solid var(--border);border-radius:6px;padding:10px 12px;overflow-x:auto;margin:8px 0;"${langAttr}><code style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--text);line-height:1.5;">${code.trimEnd()}</code></pre>`;
    }
  );

  // Blockquotes (> ...)
  html = html.replace(
    /^(&gt; .+(\n&gt; .+)*)/gm,
    (match) => {
      const inner = match
        .split("\n")
        .map((line) => line.replace(/^&gt; /, ""))
        .join("\n");
      return `<blockquote style="border-left:3px solid var(--brand);margin:8px 0;padding:4px 12px;color:var(--text-secondary);">${inner}</blockquote>`;
    }
  );

  // Headings (must come before inline processing)
  html = html.replace(/^(#{1,6}) (.+)$/gm, (_, hashes, text) => {
    const level = hashes.length;
    const fontSize = level === 1 ? "20px" : level === 2 ? "13px" : "11px";
    const fontWeight = level <= 2 ? "600" : "500";
    const color = level >= 3 ? "var(--text-secondary)" : "var(--text)";
    const marginTop = level === 1 ? "16px" : "12px";
    return `<div style="font-size:${fontSize};font-weight:${fontWeight};color:${color};margin:${marginTop} 0 4px;line-height:1.3;">${text}</div>`;
  });

  // Unordered lists (lines starting with "- ")
  html = html.replace(
    /(^- .+(\n- .+)*)/gm,
    (match) => {
      const items = match
        .split("\n")
        .map((line) => {
          const content = line.replace(/^- /, "");
          return `<li style="margin:2px 0;">${content}</li>`;
        })
        .join("");
      return `<ul style="margin:6px 0;padding-left:18px;list-style:disc;color:var(--text);font-size:13px;line-height:1.5;">${items}</ul>`;
    }
  );

  // Ordered lists (lines starting with "1. ", "2. ", etc.)
  html = html.replace(
    /(^\d+\. .+(\n\d+\. .+)*)/gm,
    (match) => {
      const items = match
        .split("\n")
        .map((line) => {
          const content = line.replace(/^\d+\. /, "");
          return `<li style="margin:2px 0;">${content}</li>`;
        })
        .join("");
      return `<ol style="margin:6px 0;padding-left:18px;list-style:decimal;color:var(--text);font-size:13px;line-height:1.5;">${items}</ol>`;
    }
  );

  // Images ![alt](src) — must come before links
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_, alt, src) =>
      `<img src="${src}" alt="${alt}" style="max-width:100%;border-radius:6px;margin:4px 0;display:block;" />`
  );

  // Links [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, text, url) =>
      `<a href="${url}" style="color:var(--brand);text-decoration:underline;text-decoration-color:rgba(255,107,53,0.4);" target="_blank" rel="noopener noreferrer">${text}</a>`
  );

  // Bold **text**
  html = html.replace(
    /\*\*([^*]+)\*\*/g,
    (_, text) => `<strong style="font-weight:600;">${text}</strong>`
  );

  // Italic *text* (single asterisk, not matched by bold)
  html = html.replace(
    /\*([^*]+)\*/g,
    (_, text) => `<em style="font-style:italic;">${text}</em>`
  );

  // Inline code `code`
  html = html.replace(
    /`([^`]+)`/g,
    (_, code) =>
      `<code style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;background:var(--fill);border:0.5px solid var(--border);border-radius:3px;padding:1px 4px;color:var(--text);">${code}</code>`
  );

  // Horizontal rules (--- or ***)
  html = html.replace(
    /^(---|\*\*\*|___)\s*$/gm,
    `<hr style="border:none;border-top:0.5px solid var(--border);margin:12px 0;" />`
  );

  // Paragraphs: double newlines become paragraph breaks
  const blockTags = /^<(div|ul|ol|pre|blockquote|hr|img)/;
  const paragraphs = html.split(/\n{2,}/);
  html = paragraphs
    .map((chunk) => {
      const trimmed = chunk.trim();
      if (!trimmed) return "";
      if (blockTags.test(trimmed)) return trimmed;
      // Convert single newlines within paragraph to <br>
      const withBr = trimmed.replace(/\n/g, "<br />");
      return `<p style="font-size:13px;color:var(--text);line-height:1.6;margin:6px 0;">${withBr}</p>`;
    })
    .filter(Boolean)
    .join("\n");

  return html;
}

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  const html = convertMarkdownToHtml(content);

  return (
    <div
      className={className}
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
        color: "var(--text)",
        lineHeight: 1.6,
        wordBreak: "break-word",
      }}
      // Input is sanitized: HTML entities are escaped before markdown conversions
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
