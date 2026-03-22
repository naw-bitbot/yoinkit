import { useState } from "react";
import { Copy, Trash2, Upload, FileText, Info } from "lucide-react";
import { useClips } from "../hooks/useClips";
import { useSettings } from "../hooks/useSettings";
import { MarkdownPreview } from "../components/MarkdownPreview";
import { TagEditor } from "../components/TagEditor";
import { Button } from "@yoinkit/ui";
import { UrlField } from "@yoinkit/ui";
import type { Clip } from "../lib/tauri";

export function ClipperPage() {
  const { clips, loading, clipUrl, deleteClip, updateTags, exportToVault } = useClips();
  const { settings } = useSettings();
  const [url, setUrl] = useState("");
  const [clipping, setClipping] = useState(false);
  const [activeClip, setActiveClip] = useState<Clip | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClip = async (submitUrl: string) => {
    const trimmed = submitUrl.trim();
    if (!trimmed) return;
    setError(null);
    setClipping(true);
    try {
      const clip = await clipUrl(trimmed);
      setActiveClip(clip);
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clip URL");
    } finally {
      setClipping(false);
    }
  };

  const handleExport = async (clip: Clip) => {
    const vaultPath = settings.obsidian_vault_path || "";
    const attachmentsFolder = settings.obsidian_attachments_folder || "Attachments";
    if (!vaultPath) {
      setError("No Obsidian vault path configured. Set it in Settings.");
      return;
    }
    setExportingId(clip.id);
    try {
      await exportToVault(clip.id, vaultPath, attachmentsFolder);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportingId(null);
    }
  };

  const handleCopy = async (clip: Clip) => {
    try {
      await navigator.clipboard.writeText(clip.markdown ?? "");
      setCopiedId(clip.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // clipboard not available
    }
  };

  const handleDelete = async (clip: Clip) => {
    await deleteClip(clip.id);
    if (activeClip?.id === clip.id) setActiveClip(null);
  };

  const handleTagsChange = async (clipId: string, tags: string[]) => {
    await updateTags(clipId, tags);
    if (activeClip?.id === clipId) {
      setActiveClip(prev => prev ? { ...prev, tags: JSON.stringify(tags) } : null);
    }
  };

  const parseTags = (tagsStr: string): string[] => {
    try {
      return JSON.parse(tagsStr) as string[];
    } catch {
      return [];
    }
  };

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

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h2 className="text-[20px] font-bold tracking-tight" style={{ color: "var(--text)" }}>
          Clipper
        </h2>
        <p className="text-[13px] mt-1" style={{ color: "var(--text-tertiary)" }}>
          Clip any webpage to Markdown. Export to Obsidian.
        </p>
      </div>

      {/* URL Input Row */}
      <div className="flex gap-2 items-center">
        <UrlField
          value={url}
          onChange={setUrl}
          onSubmit={handleClip}
          placeholder="Paste a URL to clip…"
          disabled={clipping}
          className="flex-1"
        />
        <Button
          variant="primary"
          size="md"
          loading={clipping}
          disabled={clipping || !url.trim()}
          onClick={() => handleClip(url)}
        >
          Clip
        </Button>
      </div>

      <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
        <Info className="w-3 h-3" />
        Clips are saved locally for personal reference. Credit original creators when sharing.
      </p>

      {/* Error */}
      {error && (
        <p className="text-[13px]" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      {/* Active Clip — two-panel view */}
      {activeClip && (
        <div
          className="flex gap-4 rounded-[10px] overflow-hidden"
          style={{
            border: "0.5px solid var(--border)",
            background: "var(--surface-solid)",
          }}
        >
          {/* Left — Markdown Preview (60%) */}
          <div
            className="flex-[3] overflow-y-auto p-5"
            style={{
              borderRight: "0.5px solid var(--border)",
              maxHeight: "480px",
            }}
          >
            {activeClip.markdown ? (
              <MarkdownPreview content={activeClip.markdown} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                  No markdown content
                </p>
              </div>
            )}
          </div>

          {/* Right — Metadata Panel (40%) */}
          <div className="flex-[2] p-5 flex flex-col gap-4" style={{ maxHeight: "480px", overflowY: "auto" }}>
            {/* Title */}
            <div>
              <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: "var(--text-tertiary)" }}>
                Title
              </p>
              <p className="text-[13px] font-medium leading-snug" style={{ color: "var(--text)" }}>
                {activeClip.title ?? "Untitled"}
              </p>
            </div>

            {/* URL */}
            <div>
              <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: "var(--text-tertiary)" }}>
                URL
              </p>
              <p
                className="text-[11px] break-all"
                style={{ color: "var(--text-secondary)" }}
              >
                {activeClip.url}
              </p>
            </div>

            {/* Date */}
            <div>
              <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: "var(--text-tertiary)" }}>
                Date
              </p>
              <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                {formatDate(activeClip.created_at)}
              </p>
            </div>

            {/* Tags */}
            <div>
              <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: "var(--text-tertiary)" }}>
                Tags
              </p>
              <div
                className="rounded-[6px]"
                style={{ border: "0.5px solid var(--border)", background: "var(--fill)" }}
              >
                <TagEditor
                  tags={parseTags(activeClip.tags)}
                  onChange={(tags) => handleTagsChange(activeClip.id, tags)}
                />
              </div>
            </div>

            {/* Export Button */}
            <div className="mt-auto pt-2">
              <Button
                variant="primary"
                size="md"
                loading={exportingId === activeClip.id}
                onClick={() => handleExport(activeClip)}
                className="w-full"
              >
                <Upload size={14} strokeWidth={1.5} />
                Export to Vault
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Clip History */}
      {!loading && clips.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            History
          </p>
          <div className="space-y-2">
            {clips.map((clip) => (
              <div
                key={clip.id}
                className="rounded-[10px] px-4 py-3"
                style={{
                  background: "var(--surface-solid)",
                  border: "0.5px solid var(--border)",
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className="mt-0.5 shrink-0 w-7 h-7 rounded-[6px] flex items-center justify-center"
                    style={{ background: "color-mix(in srgb, var(--brand) 12%, transparent)" }}
                  >
                    <FileText size={14} strokeWidth={1.5} style={{ color: "var(--brand)" }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[13px] font-medium truncate"
                        style={{ color: "var(--text)" }}
                      >
                        {clip.title ?? "Untitled"}
                      </span>
                      <span
                        className="text-[11px] px-1.5 py-0.5 rounded-full shrink-0"
                        style={{
                          background: "var(--fill)",
                          color: "var(--text-secondary)",
                          border: "0.5px solid var(--border)",
                        }}
                      >
                        {clip.source_type}
                      </span>
                    </div>
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-tertiary)" }}>
                      {truncateUrl(clip.url)}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                      {formatDate(clip.created_at)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setActiveClip(clip)}
                      className="h-[26px] px-2 rounded-[5px] text-[11px] flex items-center gap-1 transition-all duration-150"
                      style={{
                        background: "var(--fill)",
                        color: "var(--text-secondary)",
                        border: "0.5px solid var(--border)",
                      }}
                      title="View"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleExport(clip)}
                      disabled={exportingId === clip.id}
                      className="h-[26px] px-2 rounded-[5px] text-[11px] flex items-center gap-1 transition-all duration-150"
                      style={{
                        background: "var(--fill)",
                        color: "var(--text-secondary)",
                        border: "0.5px solid var(--border)",
                        opacity: exportingId === clip.id ? 0.4 : 1,
                      }}
                      title="Export to Vault"
                    >
                      <Upload size={12} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => handleCopy(clip)}
                      className="h-[26px] px-2 rounded-[5px] text-[11px] flex items-center gap-1 transition-all duration-150"
                      style={{
                        background: copiedId === clip.id
                          ? "color-mix(in srgb, var(--brand) 12%, transparent)"
                          : "var(--fill)",
                        color: copiedId === clip.id ? "var(--brand)" : "var(--text-secondary)",
                        border: "0.5px solid var(--border)",
                      }}
                      title="Copy Markdown"
                    >
                      <Copy size={12} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => handleDelete(clip)}
                      className="h-[26px] px-2 rounded-[5px] text-[11px] flex items-center gap-1 transition-all duration-150"
                      style={{
                        background: "var(--fill)",
                        color: "var(--danger)",
                        border: "0.5px solid var(--border)",
                      }}
                      title="Delete"
                    >
                      <Trash2 size={12} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && clips.length === 0 && !activeClip && (
        <div
          className="rounded-[10px] py-12 flex flex-col items-center gap-2"
          style={{
            background: "var(--surface-solid)",
            border: "0.5px solid var(--border)",
          }}
        >
          <FileText size={32} strokeWidth={1} style={{ color: "var(--text-tertiary)" }} />
          <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
            No clips yet. Paste a URL above to get started.
          </p>
        </div>
      )}
    </div>
  );
}
