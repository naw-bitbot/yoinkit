import React from "react";

type DownloadStatus = "queued" | "downloading" | "paused" | "completed" | "failed" | "cancelled";

interface StatusBadgeProps {
  status: DownloadStatus;
  className?: string;
}

const STATUS_CONFIG: Record<DownloadStatus, { label: string; color: string }> = {
  queued: { label: "Queued", color: "bg-yoinkit-muted/20 text-yoinkit-muted" },
  downloading: { label: "Downloading", color: "bg-yoinkit-primary/20 text-yoinkit-primary" },
  paused: { label: "Paused", color: "bg-yoinkit-warning/20 text-yoinkit-warning" },
  completed: { label: "Completed", color: "bg-yoinkit-success/20 text-yoinkit-success" },
  failed: { label: "Failed", color: "bg-yoinkit-danger/20 text-yoinkit-danger" },
  cancelled: { label: "Cancelled", color: "bg-yoinkit-muted/20 text-yoinkit-muted" },
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.queued;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.color} ${className}`}>
      {status === "downloading" && (
        <span className="w-1.5 h-1.5 bg-current rounded-full mr-1.5 animate-pulse" />
      )}
      {config.label}
    </span>
  );
}
