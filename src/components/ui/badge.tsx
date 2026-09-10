import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "ok" | "warn" | "danger" | "primary";
};

const tones: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "text-muted",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
  primary: "text-fg",
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "status inline-flex items-center",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
