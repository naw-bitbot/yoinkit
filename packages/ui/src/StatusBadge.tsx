import React from "react";
import { CheckCircle2, XCircle, Pause, Loader2, Clock, Ban } from "lucide-react";

type DownloadStatus = "queued" | "downloading" | "paused" | "completed" | "failed" | "cancelled";

interface StatusBadgeProps {
  status: DownloadStatus;
  className?: string;
}

const STATUS_CONFIG: Record<DownloadStatus, { label: string; colorVar: string; icon: React.ComponentType<any> }> = {
  queued: { label: "Queued", colorVar: '--text-tertiary', icon: Clock },
  downloading: { label: "Yoinking", colorVar: '--accent', icon: Loader2 },
  paused: { label: "Paused", colorVar: '--warning', icon: Pause },
  completed: { label: "Indexed", colorVar: '--success', icon: CheckCircle2 },
  failed: { label: "Failed", colorVar: '--danger', icon: XCircle },
  cancelled: { label: "Cancelled", colorVar: '--text-tertiary', icon: Ban },
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.queued;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${className}`} style={{ color: `var(${config.colorVar})` }}>
      <Icon size={13} strokeWidth={1.5} className={status === "downloading" ? "animate-spin" : ""} />
      {config.label}
    </span>
  );
}
