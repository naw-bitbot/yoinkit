import React from "react";

interface ProgressBarProps {
  progress: number; // 0-100
  speed?: string;
  eta?: string;
  className?: string;
}

export function ProgressBar({ progress, speed, eta, className = "" }: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between text-xs text-yoinkit-muted mb-1">
        <span>{clampedProgress.toFixed(1)}%</span>
        <div className="flex gap-3">
          {speed && <span>{speed}</span>}
          {eta && <span>ETA: {eta}</span>}
        </div>
      </div>
      <div className="w-full h-2 bg-yoinkit-bg rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-yoinkit-primary to-yoinkit-secondary rounded-full transition-all duration-300 ease-out"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}
