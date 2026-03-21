import React from "react";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "tinted";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "h-[24px] px-2 text-[11px] gap-1 rounded-[5px]",
  md: "h-[30px] px-3.5 text-[13px] gap-1.5 rounded-[6px]",
  lg: "h-[36px] px-4 text-[13px] gap-1.5 rounded-[8px]",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  children,
  className = "",
  disabled,
  style,
  ...props
}: ButtonProps) {
  const getVariantStyle = (): React.CSSProperties => {
    switch (variant) {
      case "primary":
        return { background: 'var(--brand)', color: '#FFFFFF' };
      case "secondary":
        return { background: 'var(--fill)', color: 'var(--text)', border: '0.5px solid var(--border-strong)' };
      case "danger":
        return { background: 'var(--danger)', color: '#FFFFFF' };
      case "ghost":
        return { background: 'transparent', color: 'var(--accent)' };
      case "tinted":
        return { background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' };
      default:
        return {};
    }
  };

  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.97] ${SIZE_STYLES[size]} ${
        disabled || loading ? "opacity-40 pointer-events-none" : ""
      } ${className}`}
      style={{ ...getVariantStyle(), ...style }}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" strokeWidth={1.5} />}
      {children}
    </button>
  );
}
