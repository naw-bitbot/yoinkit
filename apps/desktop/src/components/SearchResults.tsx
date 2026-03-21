import { FileText, Download } from "lucide-react";
import type { SearchResult } from "../lib/tauri";

interface SearchResultsProps {
  results: SearchResult[];
  loading: boolean;
}

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

const truncateUrl = (u: string, maxLen = 60) =>
  u.length > maxLen ? u.slice(0, maxLen) + "…" : u;

function ResultIcon({ contentType }: { contentType: string }) {
  const isClip = contentType === "clip";
  const Icon = isClip ? FileText : Download;

  return (
    <div
      className="mt-0.5 shrink-0 w-7 h-7 rounded-[6px] flex items-center justify-center"
      style={{ background: "color-mix(in srgb, var(--brand) 12%, transparent)" }}
    >
      <Icon size={14} strokeWidth={1.5} style={{ color: "var(--brand)" }} />
    </div>
  );
}

export function SearchResults({ results, loading }: SearchResultsProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
          Searching…
        </p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div
        className="rounded-[10px] py-12 flex flex-col items-center gap-2"
        style={{
          background: "var(--surface-solid)",
          border: "0.5px solid var(--border)",
        }}
      >
        <FileText size={32} strokeWidth={1} style={{ color: "var(--text-tertiary)" }} />
        <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
          No results found
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {results.map((result) => (
        <div
          key={result.id}
          className="rounded-[10px] px-4 py-3"
          style={{
            background: "var(--surface-solid)",
            border: "0.5px solid var(--border)",
          }}
        >
          <div className="flex items-start gap-3">
            <ResultIcon contentType={result.content_type} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-[13px] font-medium truncate"
                  style={{ color: "var(--text)" }}
                >
                  {result.title || "Untitled"}
                </span>
                <span
                  className="text-[11px] px-1.5 py-0.5 rounded-full shrink-0"
                  style={{
                    background: "var(--fill)",
                    color: "var(--text-secondary)",
                    border: "0.5px solid var(--border)",
                  }}
                >
                  {result.content_type}
                </span>
              </div>

              {result.snippet && (
                <p
                  className="text-[13px] mt-1 line-clamp-2 leading-snug"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {result.snippet}
                </p>
              )}

              <div className="flex items-center gap-3 mt-1">
                {result.url && (
                  <p className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>
                    {truncateUrl(result.url)}
                  </p>
                )}
                <p className="text-[11px] shrink-0" style={{ color: "var(--text-tertiary)" }}>
                  {formatDate(result.created_at)}
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
