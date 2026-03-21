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
      <div className="flex justify-between text-[11px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
        <span>{clampedProgress.toFixed(1)}%</span>
        <div className="flex gap-3">
          {speed && <span>{speed}</span>}
          {eta && <span>{eta}</span>}
        </div>
      </div>
      <div className="w-full h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--fill)' }}>
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${clampedProgress}%`, background: 'var(--brand)' }}
        />
      </div>
    </div>
  );
}
