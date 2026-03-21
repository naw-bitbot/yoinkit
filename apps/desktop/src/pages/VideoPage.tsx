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
  const [error, setError] = useState<string | null>(null);

  const qualities = ["4k", "1080p", "720p", "480p", "360p"];

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
      await startVideoDownload(url.trim(), undefined, quality, false);
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
      await startVideoDownload(url.trim(), undefined, quality, false);
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
