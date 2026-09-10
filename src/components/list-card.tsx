import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, MoreHorizontal } from "lucide-react";
import { listColor, LIST_COLOR_CLASS } from "@/lib/icons";
import type { ShoppingList } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function ListCard({
  list,
  onEdit,
  onDelete,
}: {
  list: ShoppingList;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const color = listColor(list.color);
  const empty = list.totalCount === 0;
  const done = !empty && list.uncheckedCount === 0;
  const initial = list.name.trim().charAt(0).toUpperCase() || "L";

  return (
    <div className="flex h-16 items-center gap-3.5 border-b border-hairline">
      <Link
        to="/lists/$listId"
        params={{ listId: String(list.id) }}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3.5"
      >
        <span
          className={cn(
            "grid size-[34px] shrink-0 place-items-center rounded-[11px] text-[13px] font-semibold text-primary-fg",
            empty ? "bg-fill-quiet text-muted" : LIST_COLOR_CLASS[color],
          )}
        >
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-base font-medium tracking-[-0.012em]", empty && "text-muted")}>
            {list.name}
          </span>
          <span className={cn("mt-px block truncate text-[13px]", empty ? "text-subtle" : "text-muted")}>
            {empty
              ? "Empty"
              : done
                ? "All checked"
                : `${list.uncheckedCount} to buy`}
          </span>
        </span>
        {done ? (
          <Check className="size-4 shrink-0 text-ok" strokeWidth={1.7} />
        ) : empty ? null : (
          <span className="text-[15px] font-medium tabular-nums text-fg-2">{list.uncheckedCount}</span>
        )}
        <ChevronRight className="size-3.5 shrink-0 text-stroke-quiet" strokeWidth={1.6} />
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`${list.name} list actions`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}>Edit list</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem danger onSelect={onDelete}>
            Delete list
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function NewListCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 h-11 w-full rounded-xl border border-dashed border-fg/18 bg-transparent text-sm font-medium text-muted"
    >
      New list
    </button>
  );
}
