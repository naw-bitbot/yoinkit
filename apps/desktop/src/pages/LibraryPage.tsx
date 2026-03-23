import { useState, useEffect, useMemo } from "react";
import { Search, LayoutGrid, List, FileText, Archive, Video, Music, ImageIcon, File, Link2, ExternalLink, FolderOpen, Trash2, Copy } from "lucide-react";
import { api } from "../lib/tauri";
import { usePro } from "../hooks/usePro";
import type { Clip, Download, SearchResult } from "../lib/tauri";

type MediaFilter = "all" | "page" | "archive" | "video" | "audio" | "images" | "file" | "link";

const FILTERS: { id: MediaFilter; label: string; icon: React.ComponentType<any> }[] = [
  { id: "all", label: "All", icon: LayoutGrid },
  { id: "page", label: "Pages", icon: FileText },
  { id: "archive", label: "Archives", icon: Archive },
  { id: "video", label: "Videos", icon: Video },
  { id: "audio", label: "Audio", icon: Music },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "file", label: "Files", icon: File },
  { id: "link", label: "Links", icon: Link2 },
];

interface LibraryItem {
  id: string;
  type: "download" | "clip";
  mediaType: MediaFilter;
  title: string;
  url: string;
  date: string;
  status?: string;
  filePath?: string;
  error?: string | null;
  tags?: string;
}

function getMediaType(item: { flags?: string; source_type?: string }): MediaFilter {
  if ('flags' in item) {
    const flags = (item as any).flags || "";
    if (flags === "video") return "video";
    if (flags === "audio_only") return "audio";
    return "file";
  }
  if ('source_type' in item) {
    const st = (item as any).source_type || "";
    if (st === "archive") return "archive";
    if (st === "link") return "link";
    return "page";
  }
  return "file";
}

function getMediaIcon(mediaType: MediaFilter) {
  const icons: Record<MediaFilter, React.ComponentType<any>> = {
    all: LayoutGrid, page: FileText, archive: Archive, video: Video,
    audio: Music, images: ImageIcon, file: File, link: Link2,
  };
  return icons[mediaType] || File;
}

const formatDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
  } catch { return dateStr; }
};

export function LibraryPage() {
  const { isPro } = usePro();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("list");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadItems = async () => {
    setLoading(true);
    try {
      const [downloads, clips] = await Promise.all([
        api.listDownloads(),
        api.listClips(),
      ]);

      const libraryItems: LibraryItem[] = [
        ...downloads.map(d => ({
          id: d.id,
          type: "download" as const,
          mediaType: getMediaType(d),
          title: d.url.split("/").pop() || d.url,
          url: d.url,
          date: d.created_at,
          status: d.status,
          filePath: d.save_path,
          error: d.error,
        })),
        ...clips.map(c => ({
          id: c.id,
          type: "clip" as const,
          mediaType: getMediaType(c),
          title: c.title || c.url,
          url: c.url,
          date: c.created_at,
          tags: c.tags,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setItems(libraryItems);
    } catch (err) {
      console.error("Failed to load library:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadItems(); }, []);

  const filteredItems = useMemo(() => {
    let result = items;
    if (filter !== "all") {
      result = result.filter(i => i.mediaType === filter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i =>
        i.title.toLowerCase().includes(q) || i.url.toLowerCase().includes(q)
      );
    }
    return result;
  }, [items, filter, searchQuery]);

  const handleDelete = async (item: LibraryItem) => {
    setDeletingId(item.id);
    try {
      if (item.type === "download") {
        await api.deleteDownload(item.id);
      } else {
        await api.deleteClip(item.id);
      }
      setItems(prev => prev.filter(i => i.id !== item.id));
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpen = async (item: LibraryItem) => {
    if (item.mediaType === "link") {
      // Open URL in browser
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(item.url);
    } else if (item.filePath) {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(item.filePath);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
  };

  // Count by type
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    items.forEach(i => { counts[i.mediaType] = (counts[i.mediaType] || 0) + 1; });
    return counts;
  }, [items]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>Library</h2>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {items.length} indexed yoink{items.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView("list")} className={`p-1.5 rounded-[5px] ${view === "list" ? "bg-[var(--fill)]" : ""}`}>
            <List size={16} strokeWidth={1.5} style={{ color: view === "list" ? 'var(--text)' : 'var(--text-tertiary)' }} />
          </button>
          <button onClick={() => setView("grid")} className={`p-1.5 rounded-[5px] ${view === "grid" ? "bg-[var(--fill)]" : ""}`}>
            <LayoutGrid size={16} strokeWidth={1.5} style={{ color: view === "grid" ? 'var(--text)' : 'var(--text-tertiary)' }} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-[6px] px-3" style={{ background: 'var(--fill)', border: '0.5px solid var(--border)', height: '36px' }}>
        <Search size={14} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search your library..."
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '13px', color: 'var(--text)' }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>&#x2715;</button>
        )}
      </div>

      {/* Type filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTERS.map(({ id, label }) => {
          const count = typeCounts[id] || 0;
          if (id !== "all" && count === 0) return null;
          const active = filter === id;
          return (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className="px-3 py-1 rounded-full text-[11px] transition-all duration-150"
              style={{
                background: active ? 'color-mix(in srgb, var(--brand) 15%, transparent)' : 'var(--fill)',
                color: active ? 'var(--brand)' : 'var(--text-secondary)',
                border: active ? '0.5px solid color-mix(in srgb, var(--brand) 40%, transparent)' : '0.5px solid var(--border)',
                fontWeight: active ? 500 : 400,
              }}
            >
              {label} {count > 0 && <span className="ml-1 opacity-60">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Empty state */}
      {filteredItems.length === 0 && (
        <div className="rounded-[10px] py-16 flex flex-col items-center gap-3" style={{ background: 'var(--surface-solid)', border: '0.5px solid var(--border)' }}>
          <LayoutGrid size={32} strokeWidth={1} style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
            {searchQuery ? `No results for "${searchQuery}"` : "Your library is empty. Yoink something to get started."}
          </p>
        </div>
      )}

      {/* Items list */}
      {filteredItems.length > 0 && (
        <div className={view === "grid" ? "grid grid-cols-2 md:grid-cols-3 gap-3" : "space-y-1"}>
          {filteredItems.map(item => {
            const Icon = getMediaIcon(item.mediaType);
            const isDeleting = deletingId === item.id;

            if (view === "grid") {
              return (
                <div key={item.id} className="rounded-[10px] p-3 space-y-2" style={{ background: 'var(--surface-solid)', border: '0.5px solid var(--border)' }}>
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)' }}>
                      <Icon size={14} strokeWidth={1.5} style={{ color: 'var(--brand)' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium truncate" style={{ color: 'var(--text)' }}>{item.title}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{formatDate(item.date)}</p>
                    </div>
                  </div>
                  {item.error && <p className="text-[10px] truncate" style={{ color: 'var(--danger)' }}>{item.error}</p>}
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleOpen(item)} className="h-[22px] px-1.5 rounded-[4px] text-[10px] flex items-center gap-1" style={{ background: 'var(--fill)', color: 'var(--text-secondary)', border: '0.5px solid var(--border)' }}>
                      <ExternalLink size={10} strokeWidth={1.5} />Open
                    </button>
                    <button onClick={() => handleDelete(item)} disabled={isDeleting} className="h-[22px] px-1.5 rounded-[4px] text-[10px] flex items-center gap-1" style={{ background: 'var(--fill)', color: 'var(--danger)', border: '0.5px solid var(--border)', opacity: isDeleting ? 0.4 : 1 }}>
                      <Trash2 size={10} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              );
            }

            // List view
            return (
              <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 rounded-[8px] transition-colors hover:bg-[var(--fill)]" style={{ borderBottom: '0.5px solid var(--separator)' }}>
                <div className="w-8 h-8 rounded-[6px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--brand) 10%, transparent)' }}>
                  <Icon size={15} strokeWidth={1.5} style={{ color: 'var(--brand)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text)' }}>{item.title}</p>
                  <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{item.url}</p>
                </div>
                {item.status && item.status !== "completed" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{
                    background: item.status === "failed" ? 'color-mix(in srgb, var(--danger) 15%, transparent)' : 'color-mix(in srgb, var(--brand) 15%, transparent)',
                    color: item.status === "failed" ? 'var(--danger)' : 'var(--brand)',
                  }}>
                    {item.status === "failed" ? "Failed" : item.status === "downloading" ? "Yoinking..." : item.status}
                  </span>
                )}
                {item.error && (
                  <span className="text-[10px] max-w-[200px] truncate" style={{ color: 'var(--danger)' }} title={item.error}>
                    {item.error}
                  </span>
                )}
                <span className="text-[11px] tabular-nums shrink-0" style={{ color: 'var(--text-tertiary)' }}>{formatDate(item.date)}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleCopyUrl(item.url)} className="p-1 rounded-[4px] hover:bg-[var(--fill)]" title="Copy URL">
                    <Copy size={13} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                  <button onClick={() => handleOpen(item)} className="p-1 rounded-[4px] hover:bg-[var(--fill)]" title="Open">
                    <ExternalLink size={13} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  <button onClick={() => handleDelete(item)} disabled={isDeleting} className="p-1 rounded-[4px] hover:bg-[var(--fill)]" title="Delete">
                    <Trash2 size={13} strokeWidth={1.5} style={{ color: isDeleting ? 'var(--text-tertiary)' : 'var(--danger)' }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
