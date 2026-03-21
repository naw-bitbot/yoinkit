import { forwardRef } from "react";
import {
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
  File,
} from "lucide-react";

interface YoinkReceiptProps {
  title: string;
  fileSize?: string;
  date: string;
  sourceUrl: string;
  fileType?: string;
}

function getFileIcon(fileType?: string) {
  if (!fileType) return FileText;
  const t = fileType.toLowerCase();
  if (t.includes("image") || t.includes("png") || t.includes("jpg") || t.includes("jpeg") || t.includes("gif") || t.includes("svg") || t.includes("webp")) return FileImage;
  if (t.includes("video") || t.includes("mp4") || t.includes("mov") || t.includes("avi") || t.includes("mkv") || t.includes("webm")) return FileVideo;
  if (t.includes("audio") || t.includes("mp3") || t.includes("wav") || t.includes("flac") || t.includes("aac") || t.includes("ogg")) return FileAudio;
  if (t.includes("zip") || t.includes("tar") || t.includes("gz") || t.includes("rar") || t.includes("7z") || t.includes("archive")) return FileArchive;
  if (t.includes("html") || t.includes("css") || t.includes("js") || t.includes("ts") || t.includes("json") || t.includes("xml") || t.includes("code")) return FileCode;
  if (t.includes("pdf") || t.includes("doc") || t.includes("txt") || t.includes("text")) return FileText;
  return File;
}

function truncateUrl(url: string, maxLength = 42): string {
  try {
    const parsed = new URL(url);
    const display = parsed.hostname + parsed.pathname;
    if (display.length <= maxLength) return display;
    return display.slice(0, maxLength - 1) + "…";
  } catch {
    if (url.length <= maxLength) return url;
    return url.slice(0, maxLength - 1) + "…";
  }
}

export const YoinkReceipt = forwardRef<HTMLDivElement, YoinkReceiptProps>(
  ({ title, fileSize, date, sourceUrl, fileType }, ref) => {
    const IconComponent = getFileIcon(fileType);

    return (
      <div
        ref={ref}
        style={{
          width: "320px",
          background: "var(--surface-solid)",
          border: "0.5px solid var(--border)",
          borderRadius: "10px",
          overflow: "hidden",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif",
          position: "relative",
          flexShrink: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px 10px 16px",
          }}
        >
          <span
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--brand)",
              letterSpacing: "-0.3px",
              lineHeight: 1.1,
            }}
          >
            Yoinked!
          </span>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--text-tertiary)",
              letterSpacing: "0.02em",
              textTransform: "lowercase",
            }}
          >
            yoinkit
          </span>
        </div>

        {/* Divider */}
        <div
          style={{
            height: "0.5px",
            background: "var(--border)",
            margin: "0 16px",
          }}
        />

        {/* Icon */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "16px 16px 10px 16px",
          }}
        >
          <IconComponent
            size={32}
            strokeWidth={1.25}
            style={{ color: "var(--brand)" }}
          />
        </div>

        {/* Title */}
        <div style={{ padding: "0 16px 8px 16px" }}>
          <p
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--text)",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={title}
          >
            {title}
          </p>
        </div>

        {/* Metadata row */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            padding: "0 16px 6px 16px",
          }}
        >
          {fileSize && (
            <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
              {fileSize}
            </span>
          )}
          {fileSize && (
            <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
              ·
            </span>
          )}
          <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
            {date}
          </span>
        </div>

        {/* Source URL */}
        <div style={{ padding: "0 16px 14px 16px" }}>
          <p
            style={{
              fontSize: "11px",
              color: "var(--text-tertiary)",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={sourceUrl}
          >
            {truncateUrl(sourceUrl)}
          </p>
        </div>

        {/* Watermark */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "0 16px 8px 16px",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              color: "var(--text-tertiary)",
              opacity: 0.4,
            }}
          >
            yoinkit.app
          </span>
        </div>

        {/* Accent bar */}
        <div
          style={{
            height: "4px",
            background: "var(--brand)",
            width: "100%",
          }}
        />
      </div>
    );
  }
);

YoinkReceipt.displayName = "YoinkReceipt";
