import React from "react";

interface ProgressBarProps {
  progress: number;
  speed?: string;
  eta?: string;
  className?: string;
}

export function ProgressBar({ progress, speed, eta, className = "" }: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      <div className="flex justify-between text-xs text-yoinkit-text-muted">
        <span className="tabular-nums">{clampedProgress.toFixed(1)}%</span>
        <div className="flex gap-3">
          {speed && <span className="tabular-nums">{speed}</span>}
          {eta && <span className="tabular-nums">{eta}</span>}
        </div>
      </div>
      <div className="w-full h-1.5 bg-yoinkit-border rounded-full overflow-hidden">
        <div
          className="h-full bg-yoinkit-accent rounded-full transition-all duration-500 ease-out"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}
