import React from "react";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-yoinkit-accent hover:bg-yoinkit-accent-hover text-white",
  secondary: "bg-yoinkit-surface-hover hover:bg-zinc-700 text-yoinkit-text border border-yoinkit-border",
  danger: "bg-yoinkit-danger/10 hover:bg-yoinkit-danger/20 text-yoinkit-danger border border-yoinkit-danger/20",
  ghost: "bg-transparent hover:bg-yoinkit-surface-hover text-yoinkit-text-secondary hover:text-yoinkit-text",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-6 text-sm gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yoinkit-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-yoinkit-bg ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${
        disabled || loading ? "opacity-50 pointer-events-none" : ""
      } ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}
