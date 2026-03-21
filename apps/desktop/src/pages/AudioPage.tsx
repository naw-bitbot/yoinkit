import { useState } from "react";
import { useDownloads } from "../hooks/useDownloads";
import { DownloadList } from "../components/DownloadList";
import { Button, UrlField } from "@yoinkit/ui";

export function AudioPage() {
  const { downloads, startVideoDownload, pauseDownload, resumeDownload, cancelDownload, deleteDownload } = useDownloads();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState("mp3");
  const [quality, setQuality] = useState("192");
  const [error, setError] = useState<string | null>(null);

  const formats = ["mp3", "aac", "flac", "wav", "opus"];
  const qualities = [
    { label: "320 kbps", value: "0" },
    { label: "192 kbps", value: "5" },
    { label: "128 kbps", value: "8" },
  ];

  const handleDownload = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await startVideoDownload(url.trim(), format, quality, true);
      setUrl("");
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Download failed");
    } finally {
      setLoading(false);
    }
  };

  const audioDownloads = downloads.filter(d => d.flags === "audio_only");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-yoinkit-text mb-1">Audio Extract</h2>
        <p className="text-sm text-yoinkit-muted">
          Extract audio from any video URL. Supports MP3, AAC, FLAC, WAV, and Opus.
        </p>
      </div>

      {/* URL Input */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <UrlField
              value={url}
              onChange={setUrl}
              onSubmit={handleDownload}
              placeholder="Paste a video URL to extract audio..."
            />
          </div>
          <Button onClick={handleDownload} loading={loading}>
            Extract
          </Button>
        </div>

        {/* Format selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-yoinkit-muted">Format:</span>
          <div className="flex gap-1">
            {formats.map(f => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`px-3 py-1 text-xs rounded-md uppercase transition-colors ${
                  format === f
                    ? "bg-yoinkit-secondary text-white"
                    : "bg-yoinkit-surface text-yoinkit-muted hover:text-yoinkit-text"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Quality selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-yoinkit-muted">Quality:</span>
          <div className="flex gap-1">
            {qualities.map(q => (
              <button
                key={q.value}
                onClick={() => setQuality(q.value)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  quality === q.value
                    ? "bg-yoinkit-secondary text-white"
                    : "bg-yoinkit-surface text-yoinkit-muted hover:text-yoinkit-text"
                }`}
              >
                {q.label}
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

      {/* Download List */}
      {audioDownloads.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-yoinkit-muted mb-3">Audio Downloads</h3>
          <DownloadList
            downloads={audioDownloads}
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
