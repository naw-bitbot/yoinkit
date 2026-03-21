import { useState } from "react";
import { useDownloads } from "../hooks/useDownloads";
import { DownloadList } from "../components/DownloadList";
import { Button, UrlField } from "@yoinkit/ui";

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

  // Filter video downloads
  const videoDownloads = downloads.filter(d => d.flags === "video" || d.flags === "audio_only");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-yoinkit-text mb-1">Video Download</h2>
        <p className="text-sm text-yoinkit-muted">
          Download videos from YouTube, Vimeo, TikTok, and 1000+ sites.
        </p>
      </div>

      {/* URL Input */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <UrlField
              value={url}
              onChange={setUrl}
              onSubmit={handleFetchInfo}
              placeholder="Paste a video URL..."
            />
          </div>
          <Button onClick={handleFetchInfo} loading={fetching} variant="secondary">
            Fetch Info
          </Button>
          <Button onClick={handleQuickDownload} loading={loading}>
            Yoink!
          </Button>
        </div>

        {/* Quality selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-yoinkit-muted">Quality:</span>
          <div className="flex gap-1">
            {qualities.map(q => (
              <button
                key={q}
                onClick={() => setQuality(q)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  quality === q
                    ? "bg-yoinkit-primary text-white"
                    : "bg-yoinkit-surface text-yoinkit-muted hover:text-yoinkit-text"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Subtitles / Transcript */}
        <div className="bg-yoinkit-surface/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={writeSubs}
                onChange={e => { setWriteSubs(e.target.checked); if (e.target.checked) setSubsOnly(false); }}
                className="rounded border-yoinkit-muted/30 bg-yoinkit-surface"
              />
              <span className="text-sm text-yoinkit-text">Include subtitles</span>
            </label>
            <span className="text-yoinkit-muted/30">|</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={subsOnly}
                onChange={e => { setSubsOnly(e.target.checked); if (e.target.checked) setWriteSubs(false); }}
                className="rounded border-yoinkit-muted/30 bg-yoinkit-surface"
              />
              <span className="text-sm text-yoinkit-text">Transcript only</span>
            </label>
          </div>
          {(writeSubs || subsOnly) && (
            <div className="flex items-center gap-4 ml-6">
              <div className="flex items-center gap-2">
                <span className="text-xs text-yoinkit-muted">Language:</span>
                <select
                  value={subLang}
                  onChange={e => setSubLang(e.target.value)}
                  className="bg-yoinkit-surface text-yoinkit-text text-xs rounded px-2 py-1 border border-yoinkit-muted/20"
                >
                  {subLangs.map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-yoinkit-muted">Format:</span>
                <div className="flex gap-1">
                  {subFormats.map(f => (
                    <button
                      key={f}
                      onClick={() => setSubFormat(f)}
                      className={`px-2 py-0.5 text-xs rounded transition-colors ${
                        subFormat === f
                          ? "bg-yoinkit-primary text-white"
                          : "bg-yoinkit-bg text-yoinkit-muted hover:text-yoinkit-text"
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
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Video Info Card */}
      {videoInfo && (
        <div className="bg-yoinkit-surface rounded-lg p-4 space-y-3">
          <div className="flex gap-4">
            {videoInfo.thumbnail && (
              <img
                src={videoInfo.thumbnail}
                alt={videoInfo.title}
                className="w-40 h-24 object-cover rounded-md"
              />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-yoinkit-text truncate">{videoInfo.title}</h3>
              {videoInfo.duration && (
                <p className="text-sm text-yoinkit-muted mt-1">Duration: {videoInfo.duration}</p>
              )}
              <p className="text-xs text-yoinkit-muted mt-1">
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
          <h3 className="text-sm font-medium text-yoinkit-muted mb-3">Video Downloads</h3>
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
