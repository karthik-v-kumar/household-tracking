import { Check, MoreHorizontal, Star } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ItemRow({
  item,
  onToggle,
  onStaple,
  onDelete,
}: {
  item: ListItem;
  onToggle: () => void;
  onStaple: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-border/70 px-1 py-1",
        item.checked && "opacity-55",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={item.checked}
        aria-label={item.checked ? `Uncheck ${item.name}` : `Check ${item.name}`}
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-full border transition-colors duration-150",
          item.checked
            ? "border-primary bg-primary text-primary-fg"
            : "border-fg/25 bg-transparent text-transparent",
        )}
      >
        <Check className="size-4" strokeWidth={2.4} />
      </button>
      <button type="button" onClick={onToggle} className="min-w-0 flex-1 py-2 text-left">
        <p
          className={cn(
            "truncate font-medium",
            item.checked && "text-muted line-through",
          )}
        >
          {item.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {[item.quantity, item.isStaple ? "Usual" : null, item.notes]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </button>
      {item.isStaple ? (
        <Star className="size-3.5 shrink-0 fill-primary text-primary" />
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="grid size-11 shrink-0 place-items-center rounded-sm text-muted hover:bg-fg/5 hover:text-fg"
            aria-label={`More for ${item.name}`}
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onStaple}>
            {item.isStaple ? "Remove from usuals" : "Remember as usual"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem danger onSelect={onDelete}>
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
