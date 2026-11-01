import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-line",
  primary: "bg-primary-soft text-ink border-transparent",
  accent: "bg-accent-soft text-ink border-transparent",
  success: "bg-success/15 text-success border-transparent",
  warning: "bg-warning/15 text-warning border-transparent",
  danger: "bg-danger/15 text-danger border-transparent",
};

export function Badge({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
      )}
    >
      {icon}
      {children}
    </span>
  );
}
