import { useState } from "react";
import { useDownloads } from "../hooks/useDownloads";
import { DownloadList } from "../components/DownloadList";
import { Button, UrlField } from "@yoinkit/ui";
import { Info, Subtitles, FileText } from "lucide-react";
import { api } from "../lib/tauri";

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
  const [transcriptText, setTranscriptText] = useState("");
  const [structuring, setStructuring] = useState(false);
  const [structureResult, setStructureResult] = useState<string | null>(null);

  const qualities = ["4k", "1080p", "720p", "480p", "360p"];
  const subFormats = ["srt", "vtt", "ass", "txt"];
  const subLangs = [
    { label: "English", value: "en" }, { label: "Spanish", value: "es" },
    { label: "French", value: "fr" }, { label: "German", value: "de" },
    { label: "Japanese", value: "ja" }, { label: "Korean", value: "ko" },
    { label: "Chinese", value: "zh" }, { label: "Portuguese", value: "pt" },
    { label: "Arabic", value: "ar" }, { label: "Hindi", value: "hi" },
    { label: "All", value: "all" },
  ];

  const handleFetchInfo = async () => {
    if (!url.trim()) return;
    setFetching(true); setError(null); setVideoInfo(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const info = await invoke<VideoInfo>("get_video_info", { url: url.trim() });
      setVideoInfo(info);
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Failed to fetch video info");
    } finally { setFetching(false); }
  };

  const handleDownload = async () => {
    setLoading(true); setError(null);
    try {
      if (subsOnly) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("download_subtitles", { url: url.trim(), subLang, subFormat, autoSubs: true });
      } else {
        await startVideoDownload(url.trim(), undefined, quality, false, writeSubs, subLang, subFormat);
      }
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Download failed");
    } finally { setLoading(false); }
  };

  const handleQuickDownload = async () => {
    if (!url.trim()) return;
    setLoading(true); setError(null);
    try {
      if (subsOnly) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("download_subtitles", { url: url.trim(), subLang, subFormat, autoSubs: true });
      } else {
        await startVideoDownload(url.trim(), undefined, quality, false, writeSubs, subLang, subFormat);
      }
      setUrl(""); setVideoInfo(null);
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Download failed");
    } finally { setLoading(false); }
  };

  const handleStructure = async () => {
    if (!transcriptText.trim()) return;
    setStructuring(true);
    setStructureResult(null);
    try {
      await api.structureTranscript(transcriptText);
      setStructureResult("Notes saved to Clipper!");
      setTranscriptText("");
      setTimeout(() => setStructureResult(null), 3000);
    } catch (err) {
      setStructureResult(err instanceof Error ? err.message : "Failed to structure notes");
    } finally {
      setStructuring(false);
    }
  };

  const videoDownloads = downloads.filter(d => d.flags === "video" || d.flags === "audio_only");

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-[20px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>Video</h2>
        <p className="text-[13px] mt-1" style={{ color: 'var(--text-secondary)' }}>
          Download videos from YouTube, Vimeo, TikTok, and 1000+ sites.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          <UrlField value={url} onChange={setUrl} onSubmit={handleFetchInfo} placeholder="Paste a video URL..." className="flex-1" />
          <Button onClick={handleFetchInfo} loading={fetching} variant="secondary">
            <Info size={15} strokeWidth={1.5} />
            Info
          </Button>
          <Button onClick={handleQuickDownload} loading={loading}>
            Yoink!
          </Button>
        </div>

        {/* Quality — Apple segmented control */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Quality</span>
          <div className="apple-pill flex">
            {qualities.map(q => (
              <button key={q} onClick={() => setQuality(q)} className={`apple-pill-item ${quality === q ? 'active' : ''}`}>
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Subtitles panel */}
        <div className="glass rounded-[10px] p-4 space-y-3">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={writeSubs} onChange={e => { setWriteSubs(e.target.checked); if (e.target.checked) setSubsOnly(false); }} className="rounded" />
              <Subtitles size={15} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
              <span className="text-[13px]" style={{ color: 'var(--text)' }}>Include subtitles</span>
            </label>
            <div className="w-px h-4" style={{ background: 'var(--separator)' }} />
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={subsOnly} onChange={e => { setSubsOnly(e.target.checked); if (e.target.checked) setWriteSubs(false); }} className="rounded" />
              <FileText size={15} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
              <span className="text-[13px]" style={{ color: 'var(--text)' }}>Transcript only</span>
            </label>
          </div>
          {(writeSubs || subsOnly) && (
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
                    <button key={f} onClick={() => setSubFormat(f)} className={`apple-pill-item text-[11px] !px-2 !py-0.5 ${subFormat === f ? 'active' : ''}`}>
                      .{f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-[8px] px-4 py-3 text-[13px]" style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)', border: '0.5px solid color-mix(in srgb, var(--danger) 20%, transparent)' }}>
          {error}
        </div>
      )}

      {videoInfo && (
        <div className="glass rounded-[10px] p-5 space-y-4">
          <div className="flex gap-4">
            {videoInfo.thumbnail && <img src={videoInfo.thumbnail} alt={videoInfo.title} className="w-44 h-24 object-cover rounded-[10px]" />}
            <div className="flex-1 min-w-0">
              <h3 className="text-[13px] font-medium truncate" style={{ color: 'var(--text)' }}>{videoInfo.title}</h3>
              {videoInfo.duration && <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-tertiary)' }}>Duration: {videoInfo.duration}</p>}
              <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{videoInfo.formats.length} formats available</p>
            </div>
          </div>
          <Button onClick={handleDownload} loading={loading} className="w-full" size="lg">
            Download at {quality}
          </Button>
        </div>
      )}

      {/* Structure Transcript */}
      <div className="glass rounded-[10px] p-4 space-y-3">
        <label className="flex items-center gap-2 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
          <FileText size={15} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
          Structure Transcript
        </label>
        <textarea
          value={transcriptText}
          onChange={(e) => setTranscriptText(e.target.value)}
          placeholder="Paste transcript text here…"
          className="apple-input w-full px-3.5 py-2 text-[13px] resize-none"
          rows={4}
          style={{ minHeight: '80px' }}
        />
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            loading={structuring}
            disabled={structuring || !transcriptText.trim()}
            onClick={handleStructure}
          >
            Structure Notes
          </Button>
          {structureResult && (
            <span className="text-[11px]" style={{ color: structureResult.startsWith("Notes") ? 'var(--brand)' : 'var(--danger)' }}>
              {structureResult}
            </span>
          )}
        </div>
      </div>

      {videoDownloads.length > 0 && (
        <div>
          <h3 className="text-[11px] font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)' }}>Downloads</h3>
          <DownloadList downloads={videoDownloads} onPause={pauseDownload} onResume={resumeDownload} onCancel={cancelDownload} onDelete={deleteDownload} />
        </div>
      )}
    </div>
  );
}
