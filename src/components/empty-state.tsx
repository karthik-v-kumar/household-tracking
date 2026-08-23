import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  image,
  imageAlt = "",
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon;
  image?: string;
  imageAlt?: string;
  title: string;
  body: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("panel flex flex-col items-center justify-center px-6 py-10 text-center", className)}>
      {image ? (
        <div className="still-life w-40">
          <img src={image} alt={imageAlt} width={900} height={900} className="aspect-square w-full object-cover" />
        </div>
      ) : (
        <div className="grid size-12 place-items-center rounded-full bg-fg/6 text-fg">
          <Icon className="size-5" strokeWidth={1.75} />
        </div>
      )}
      <h3 className="mt-4 font-display text-2xl tracking-tight">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
