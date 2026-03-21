import { useState } from "react";
import { useDownloads } from "../hooks/useDownloads";
import { DownloadList } from "../components/DownloadList";
import { Button, UrlField } from "@yoinkit/ui";
import { Info, Subtitles, FileText } from "lucide-react";

interface VideoInfo {
  title: string;
  url: string;
  thumbnail: string | null;
  duration: string | null;
  formats: FormatInfo[];
}

interface FormatInfo {
  format_id: string;
  ext: string;
  resolution: string | null;
  filesize: number | null;
  vcodec: string | null;
  acodec: string | null;
  format_note: string | null;
}

export function VideoPage() {
  const { downloads, startVideoDownload, pauseDownload, resumeDownload, cancelDownload, deleteDownload } = useDownloads();
  const [url, setUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [quality, setQuality] = useState("1080p");
  const [writeSubs, setWriteSubs] = useState(false);
  const [subLang, setSubLang] = useState("en");
  const [subFormat, setSubFormat] = useState("srt");
  const [subsOnly, setSubsOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qualities = ["4k", "1080p", "720p", "480p", "360p"];
  const subFormats = ["srt", "vtt", "ass", "txt"];
  const subLangs = [
    { label: "English", value: "en" },
    { label: "Spanish", value: "es" },
    { label: "French", value: "fr" },
    { label: "German", value: "de" },
    { label: "Japanese", value: "ja" },
    { label: "Korean", value: "ko" },
    { label: "Chinese", value: "zh" },
    { label: "Portuguese", value: "pt" },
    { label: "Arabic", value: "ar" },
    { label: "Hindi", value: "hi" },
    { label: "All", value: "all" },
  ];

  const handleFetchInfo = async () => {
    if (!url.trim()) return;
    setFetching(true);
    setError(null);
    setVideoInfo(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const info = await invoke<VideoInfo>("get_video_info", { url: url.trim() });
      setVideoInfo(info);
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Failed to fetch video info");
    } finally {
      setFetching(false);
    }
  };

  const handleDownload = async () => {
    setLoading(true);
    setError(null);
    try {
      if (subsOnly) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("download_subtitles", { url: url.trim(), subLang, subFormat, autoSubs: true });
      } else {
        await startVideoDownload(url.trim(), undefined, quality, false, writeSubs, subLang, subFormat);
      }
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Download failed");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDownload = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      if (subsOnly) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("download_subtitles", { url: url.trim(), subLang, subFormat, autoSubs: true });
      } else {
        await startVideoDownload(url.trim(), undefined, quality, false, writeSubs, subLang, subFormat);
      }
      setUrl("");
      setVideoInfo(null);
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Download failed");
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown size";
    if (bytes > 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const videoDownloads = downloads.filter(d => d.flags === "video" || d.flags === "audio_only");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Video</h2>
        <p className="text-sm text-yoinkit-text-secondary mt-1">
          Download videos from YouTube, Vimeo, TikTok, and 1000+ sites.
        </p>
      </div>

      {/* URL Input */}
      <div className="space-y-4">
        <div className="flex gap-2">
          <UrlField
            value={url}
            onChange={setUrl}
            onSubmit={handleFetchInfo}
            placeholder="Paste a video URL..."
            className="flex-1"
          />
          <Button onClick={handleFetchInfo} loading={fetching} variant="secondary">
            <Info size={14} />
            Info
          </Button>
          <Button onClick={handleQuickDownload} loading={loading}>
            Yoink!
          </Button>
        </div>

        {/* Quality selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-yoinkit-text-muted uppercase tracking-wider">Quality</span>
          <div className="flex gap-1 bg-yoinkit-bg rounded-lg p-0.5">
            {qualities.map(q => (
              <button
                key={q}
                onClick={() => setQuality(q)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  quality === q
                    ? "bg-yoinkit-accent text-white"
                    : "text-yoinkit-text-secondary hover:text-yoinkit-text"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Subtitles / Transcript */}
        <div className="rounded-xl border border-yoinkit-border p-4 space-y-3">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={writeSubs}
                onChange={e => { setWriteSubs(e.target.checked); if (e.target.checked) setSubsOnly(false); }}
                className="rounded"
              />
              <Subtitles size={14} className="text-yoinkit-text-secondary" />
              <span className="text-sm text-yoinkit-text">Include subtitles</span>
            </label>
            <div className="w-px h-4 bg-yoinkit-border" />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={subsOnly}
                onChange={e => { setSubsOnly(e.target.checked); if (e.target.checked) setWriteSubs(false); }}
                className="rounded"
              />
              <FileText size={14} className="text-yoinkit-text-secondary" />
              <span className="text-sm text-yoinkit-text">Transcript only</span>
            </label>
          </div>
          {(writeSubs || subsOnly) && (
            <div className="flex items-center gap-5 pl-6">
              <div className="flex items-center gap-2">
                <span className="text-xs text-yoinkit-text-muted">Language</span>
                <select
                  value={subLang}
                  onChange={e => setSubLang(e.target.value)}
                  className="bg-yoinkit-bg text-yoinkit-text text-xs rounded-md px-2.5 py-1.5 border border-yoinkit-border focus:outline-none focus:ring-1 focus:ring-yoinkit-accent/40"
                >
                  {subLangs.map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-yoinkit-text-muted">Format</span>
                <div className="flex gap-0.5 bg-yoinkit-bg rounded-md p-0.5">
                  {subFormats.map(f => (
                    <button
                      key={f}
                      onClick={() => setSubFormat(f)}
                      className={`px-2.5 py-1 text-xs rounded transition-colors ${
                        subFormat === f
                          ? "bg-yoinkit-accent text-white"
                          : "text-yoinkit-text-muted hover:text-yoinkit-text"
                      }`}
                    >
                      .{f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-yoinkit-danger/5 border border-yoinkit-danger/20 text-yoinkit-danger px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Video Info Card */}
      {videoInfo && (
        <div className="bg-yoinkit-surface rounded-xl p-5 border border-yoinkit-border space-y-4">
          <div className="flex gap-4">
            {videoInfo.thumbnail && (
              <img
                src={videoInfo.thumbnail}
                alt={videoInfo.title}
                className="w-44 h-24 object-cover rounded-lg"
              />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium truncate">{videoInfo.title}</h3>
              {videoInfo.duration && (
                <p className="text-xs text-yoinkit-text-muted mt-1.5">Duration: {videoInfo.duration}</p>
              )}
              <p className="text-xs text-yoinkit-text-muted mt-1">
                {videoInfo.formats.length} formats available
              </p>
            </div>
          </div>

          <Button onClick={handleDownload} loading={loading} className="w-full">
            Download at {quality}
          </Button>
        </div>
      )}

      {/* Download List */}
      {videoDownloads.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-yoinkit-text-muted uppercase tracking-wider mb-3">Downloads</h3>
          <DownloadList
            downloads={videoDownloads}
            onPause={pauseDownload}
            onResume={resumeDownload}
            onCancel={cancelDownload}
            onDelete={deleteDownload}
          />
        </div>
      )}
    </div>
  );
}
