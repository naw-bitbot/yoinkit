import { useState } from "react";
import { useDownloads } from "../hooks/useDownloads";
import { DownloadList } from "../components/DownloadList";
import { Button, UrlField } from "@yoinkit/ui";
import { FileText } from "lucide-react";

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
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Audio</h2>
        <p className="text-sm text-yoinkit-text-secondary mt-1">
          Extract audio from any video URL. Supports MP3, AAC, FLAC, WAV, and Opus.
        </p>
      </div>

      {/* URL Input */}
      <div className="space-y-4">
        <div className="flex gap-2">
          <UrlField
            value={url}
            onChange={setUrl}
            onSubmit={handleDownload}
            placeholder="Paste a video URL to extract audio..."
            className="flex-1"
          />
          <Button onClick={handleDownload} loading={loading}>
            Extract
          </Button>
        </div>

        {/* Format selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-yoinkit-text-muted uppercase tracking-wider">Format</span>
          <div className="flex gap-1 bg-yoinkit-bg rounded-lg p-0.5">
            {formats.map(f => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`px-3 py-1 text-xs rounded-md uppercase transition-colors ${
                  format === f
                    ? "bg-yoinkit-accent text-white"
                    : "text-yoinkit-text-secondary hover:text-yoinkit-text"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Quality selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-yoinkit-text-muted uppercase tracking-wider">Quality</span>
          <div className="flex gap-1 bg-yoinkit-bg rounded-lg p-0.5">
            {qualities.map(q => (
              <button
                key={q.value}
                onClick={() => setQuality(q.value)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  quality === q.value
                    ? "bg-yoinkit-accent text-white"
                    : "text-yoinkit-text-secondary hover:text-yoinkit-text"
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transcript toggle */}
        <div className="rounded-xl border border-yoinkit-border p-4 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={writeSubs}
              onChange={e => setWriteSubs(e.target.checked)}
              className="rounded"
            />
            <FileText size={14} className="text-yoinkit-text-secondary" />
            <span className="text-sm text-yoinkit-text">Include transcript / lyrics</span>
          </label>
          {writeSubs && (
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

      {/* Download List */}
      {audioDownloads.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-yoinkit-text-muted uppercase tracking-wider mb-3">Downloads</h3>
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
