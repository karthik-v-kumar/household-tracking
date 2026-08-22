import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl bg-surface px-6 py-12 text-center shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-6" strokeWidth={1.75} />
      </div>
      <h3 className="mt-4 font-display text-xl font-medium tracking-tight">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
