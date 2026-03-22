import React from "react";
import { Crown } from "lucide-react";

interface ProBadgeProps {
  onClick?: () => void;
  size?: "sm" | "md";
}

export function ProBadge({ onClick, size = "sm" }: ProBadgeProps) {
  const cls = size === "sm"
    ? "text-[10px] px-1.5 py-0.5 gap-0.5"
    : "text-xs px-2 py-1 gap-1";
  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center rounded-full font-medium cursor-pointer transition-colors ${cls}`}
      style={{
        backgroundColor: "color-mix(in srgb, var(--brand) 20%, transparent)",
        color: "var(--brand)",
      }}
    >
      <Crown className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      Pro
    </span>
  );
}
