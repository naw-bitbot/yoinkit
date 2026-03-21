import { useState, useMemo } from "react";
import { Trash2, ExternalLink, Archive as ArchiveIcon } from "lucide-react";
import { useClips } from "../hooks/useClips";
import { Button } from "@yoinkit/ui";
import { UrlField } from "@yoinkit/ui";
import { api } from "../lib/tauri";
import type { Clip } from "../lib/tauri";

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

const truncateUrl = (u: string, maxLen = 50) =>
  u.length > maxLen ? u.slice(0, maxLen) + "…" : u;

export function ArchivePage() {
  const { clips, loading, deleteClip, refresh } = useClips();
  const [url, setUrl] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const archives: Clip[] = useMemo(
    () => clips.filter((c) => c.source_type === "archive"),
    [clips]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return archives;
    const q = search.trim().toLowerCase();
    return archives.filter(
      (c) =>
        (c.title ?? "").toLowerCase().includes(q) ||
        c.url.toLowerCase().includes(q)
    );
  }, [archives, search]);

  const handleArchive = async (submitUrl: string) => {
    const trimmed = submitUrl.trim();
    if (!trimmed) return;
    setError(null);
    setArchiving(true);
    try {
      await api.archiveUrl(trimmed);
      setUrl("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive URL");
    } finally {
      setArchiving(false);
    }
  };

  const handleOpen = (clip: Clip) => {
    if (clip.vault_path) {
      // Open the archived file via shell
      import("@tauri-apps/plugin-shell")
        .then(({ open }) => open(clip.vault_path!))
        .catch(() => {});
    }
  };

  const handleDelete = async (clip: Clip) => {
    setDeletingId(clip.id);
    try {
      await deleteClip(clip.id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h2 className="text-[20px] font-bold tracking-tight" style={{ color: "var(--text)" }}>
          Archive
        </h2>
        <p className="text-[13px] mt-1" style={{ color: "var(--text-tertiary)" }}>
          Save complete web pages for offline access.
        </p>
      </div>

      {/* URL Input Row */}
      <div className="flex gap-2 items-center">
        <UrlField
          value={url}
          onChange={setUrl}
          onSubmit={handleArchive}
          placeholder="Paste a URL to archive…"
          disabled={archiving}
          className="flex-1"
        />
        <Button
          variant="primary"
          size="md"
          loading={archiving}
          disabled={archiving || !url.trim()}
          onClick={() => handleArchive(url)}
        >
          Archive
        </Button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-[13px]" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      {/* Search/filter */}
      {archives.length > 0 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search archives…"
          className="w-full rounded-[8px] px-3 py-2 text-[13px] outline-none"
          style={{
            background: "var(--fill)",
            border: "0.5px solid var(--border)",
            color: "var(--text)",
          }}
        />
      )}

      {/* Loading */}
      {loading && (
        <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
          Loading…
        </p>
      )}

      {/* Archive Grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((clip) => (
            <div
              key={clip.id}
              className="rounded-[10px] p-4 flex flex-col gap-2"
              style={{
                background: "var(--surface-solid)",
                border: "0.5px solid var(--border)",
              }}
            >
              {/* Title row */}
              <div className="flex items-start gap-2">
                <div
                  className="shrink-0 w-7 h-7 rounded-[6px] flex items-center justify-center mt-0.5"
                  style={{ background: "color-mix(in srgb, var(--brand) 12%, transparent)" }}
                >
                  <ArchiveIcon size={14} strokeWidth={1.5} style={{ color: "var(--brand)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[13px] font-medium truncate"
                    style={{ color: "var(--text)" }}
                    title={clip.title ?? "Untitled"}
                  >
                    {clip.title ?? "Untitled"}
                  </p>
                  <p
                    className="text-[11px] mt-0.5 truncate"
                    style={{ color: "var(--text-tertiary)" }}
                    title={clip.url}
                  >
                    {truncateUrl(clip.url)}
                  </p>
                </div>
              </div>

              {/* Date + Badge row */}
              <div className="flex items-center gap-2">
                <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  {formatDate(clip.created_at)}
                </p>
                {/* "Archived" badge — tinted brand color like TagEditor pills */}
                <span
                  className="text-[11px] px-1.5 py-0.5 rounded-full"
                  style={{
                    background: "color-mix(in srgb, var(--brand) 15%, transparent)",
                    color: "var(--brand)",
                    border: "0.5px solid color-mix(in srgb, var(--brand) 30%, transparent)",
                  }}
                >
                  Archived
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 mt-1">
                {clip.vault_path && (
                  <button
                    onClick={() => handleOpen(clip)}
                    className="h-[26px] px-2 rounded-[5px] text-[11px] flex items-center gap-1 transition-all duration-150"
                    style={{
                      background: "var(--fill)",
                      color: "var(--text-secondary)",
                      border: "0.5px solid var(--border)",
                    }}
                    title="Open archived page"
                  >
                    <ExternalLink size={12} strokeWidth={1.5} />
                    Open
                  </button>
                )}
                <button
                  onClick={() => handleDelete(clip)}
                  disabled={deletingId === clip.id}
                  className="h-[26px] px-2 rounded-[5px] text-[11px] flex items-center gap-1 transition-all duration-150"
                  style={{
                    background: "var(--fill)",
                    color: "var(--danger)",
                    border: "0.5px solid var(--border)",
                    opacity: deletingId === clip.id ? 0.4 : 1,
                  }}
                  title="Delete"
                >
                  <Trash2 size={12} strokeWidth={1.5} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && archives.length === 0 && (
        <div
          className="rounded-[10px] py-12 flex flex-col items-center gap-2"
          style={{
            background: "var(--surface-solid)",
            border: "0.5px solid var(--border)",
          }}
        >
          <ArchiveIcon size={32} strokeWidth={1} style={{ color: "var(--text-tertiary)" }} />
          <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
            No archives yet. Enter a URL to save a page for offline access.
          </p>
        </div>
      )}

      {/* No search results state */}
      {!loading && archives.length > 0 && filtered.length === 0 && (
        <div
          className="rounded-[10px] py-12 flex flex-col items-center gap-2"
          style={{
            background: "var(--surface-solid)",
            border: "0.5px solid var(--border)",
          }}
        >
          <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
            No archives match your search.
          </p>
        </div>
      )}
    </div>
  );
}
