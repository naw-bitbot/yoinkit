import React from "react";
import { CheckCircle2, XCircle, Pause, Loader2, Clock, Ban, type LucideProps } from "lucide-react";

type DownloadStatus = "queued" | "downloading" | "paused" | "completed" | "failed" | "cancelled";

interface StatusBadgeProps {
  status: DownloadStatus;
  className?: string;
}

const STATUS_CONFIG: Record<DownloadStatus, { label: string; color: string; icon: React.ComponentType<LucideProps> }> = {
  queued: { label: "Queued", color: "text-yoinkit-text-muted", icon: Clock },
  downloading: { label: "Downloading", color: "text-yoinkit-accent", icon: Loader2 },
  paused: { label: "Paused", color: "text-yoinkit-warning", icon: Pause },
  completed: { label: "Completed", color: "text-yoinkit-success", icon: CheckCircle2 },
  failed: { label: "Failed", color: "text-yoinkit-danger", icon: XCircle },
  cancelled: { label: "Cancelled", color: "text-yoinkit-text-muted", icon: Ban },
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.queued;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${config.color} ${className}`}>
      <Icon size={14} className={status === "downloading" ? "animate-spin" : ""} />
      {config.label}
    </span>
  );
}
