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
  const [writeSubs, setWriteSubs] = useState(false);
  const [subLang, setSubLang] = useState("en");
  const [subFormat, setSubFormat] = useState("srt");
  const [error, setError] = useState<string | null>(null);

  const subFormats = ["srt", "vtt", "txt"];
  const subLangs = [
    { label: "English", value: "en" },
    { label: "Spanish", value: "es" },
    { label: "French", value: "fr" },
    { label: "German", value: "de" },
    { label: "Japanese", value: "ja" },
    { label: "All", value: "all" },
  ];

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
      await startVideoDownload(url.trim(), format, quality, true, writeSubs, subLang, subFormat);
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

        {/* Transcript toggle */}
        <div className="bg-yoinkit-surface/50 rounded-lg p-3 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={writeSubs}
              onChange={e => setWriteSubs(e.target.checked)}
              className="rounded border-yoinkit-muted/30 bg-yoinkit-surface"
            />
            <span className="text-sm text-yoinkit-text">Include transcript/lyrics</span>
          </label>
          {writeSubs && (
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
                          ? "bg-yoinkit-secondary text-white"
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
