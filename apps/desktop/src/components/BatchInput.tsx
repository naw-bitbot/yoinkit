import { useState } from "react";
import { Button } from "@yoinkit/ui";

interface BatchInputProps {
  onSubmit: (urls: string[]) => void;
  loading?: boolean;
}

export function BatchInput({ onSubmit, loading = false }: BatchInputProps) {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    const urls = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && (line.startsWith("http://") || line.startsWith("https://")));

    if (urls.length > 0) {
      onSubmit(urls);
      setText("");
    }
  };

  const urlCount = text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed && (trimmed.startsWith("http://") || trimmed.startsWith("https://"));
    }).length;

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"Paste URLs, one per line:\nhttps://example.com/file1.pdf\nhttps://example.com/file2.pdf"}
        rows={6}
        disabled={loading}
        className="w-full px-4 py-3 bg-yoinkit-bg border border-yoinkit-muted/30 rounded-lg text-sm text-yoinkit-text placeholder-yoinkit-muted/50 focus:outline-none focus:ring-2 focus:ring-yoinkit-primary/50 focus:border-yoinkit-primary resize-y font-mono"
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-yoinkit-muted">
          {urlCount} valid URL{urlCount !== 1 ? "s" : ""} detected
        </span>
        <Button onClick={handleSubmit} disabled={urlCount === 0} loading={loading} size="sm">
          Download All ({urlCount})
        </Button>
      </div>
    </div>
  );
}
