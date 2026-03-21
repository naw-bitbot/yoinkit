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
    { label: "English", value: "en" }, { label: "Spanish", value: "es" },
    { label: "French", value: "fr" }, { label: "German", value: "de" },
    { label: "Japanese", value: "ja" }, { label: "All", value: "all" },
  ];
  const formats = ["mp3", "aac", "flac", "wav", "opus"];
  const qualities = [
    { label: "320 kbps", value: "0" },
    { label: "192 kbps", value: "5" },
    { label: "128 kbps", value: "8" },
  ];

  const handleDownload = async () => {
    if (!url.trim()) return;
    setLoading(true); setError(null);
    try {
      await startVideoDownload(url.trim(), format, quality, true, writeSubs, subLang, subFormat);
      setUrl("");
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Download failed");
    } finally { setLoading(false); }
  };

  const audioDownloads = downloads.filter(d => d.flags === "audio_only");

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-[20px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>Audio</h2>
        <p className="text-[13px] mt-1" style={{ color: 'var(--text-secondary)' }}>
          Extract audio from any video URL. Supports MP3, AAC, FLAC, WAV, and Opus.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          <UrlField value={url} onChange={setUrl} onSubmit={handleDownload} placeholder="Paste a video URL to extract audio..." className="flex-1" />
          <Button onClick={handleDownload} loading={loading}>Extract</Button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Format</span>
          <div className="apple-pill flex">
            {formats.map(f => (
              <button key={f} onClick={() => setFormat(f)} className={`apple-pill-item uppercase ${format === f ? 'active' : ''}`}>{f}</button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Quality</span>
          <div className="apple-pill flex">
            {qualities.map(q => (
              <button key={q.value} onClick={() => setQuality(q.value)} className={`apple-pill-item ${quality === q.value ? 'active' : ''}`}>{q.label}</button>
            ))}
          </div>
        </div>

        {/* Transcript */}
        <div className="glass rounded-[10px] p-4 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={writeSubs} onChange={e => setWriteSubs(e.target.checked)} className="rounded" />
            <FileText size={15} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
            <span className="text-[13px]" style={{ color: 'var(--text)' }}>Include transcript / lyrics</span>
          </label>
          {writeSubs && (
            <div className="flex items-center gap-5 pl-6">
              <div className="flex items-center gap-2">
                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Language</span>
                <select value={subLang} onChange={e => setSubLang(e.target.value)} className="apple-input px-2.5 py-1.5 text-[11px]">
                  {subLangs.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Format</span>
                <div className="apple-pill flex">
                  {subFormats.map(f => (
                    <button key={f} onClick={() => setSubFormat(f)} className={`apple-pill-item text-[11px] !px-2 !py-0.5 ${subFormat === f ? 'active' : ''}`}>.{f}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-[8px] px-4 py-3 text-[13px]" style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {audioDownloads.length > 0 && (
        <div>
          <h3 className="text-[11px] font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)' }}>Downloads</h3>
          <DownloadList downloads={audioDownloads} onPause={pauseDownload} onResume={resumeDownload} onCancel={cancelDownload} onDelete={deleteDownload} />
        </div>
      )}
    </div>
  );
}
