import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { listColor, listIcon } from "@/lib/icons";
import { LIST_COLOR_CLASS } from "@/lib/icons";
import type { ShoppingList } from "@/lib/types";

export function ListCard({ list }: { list: ShoppingList }) {
  const Icon = listIcon(list.icon);
  const color = listColor(list.color);
  return (
    <Link
      to="/lists/$listId"
      params={{ listId: String(list.id) }}
      className="flex items-center gap-4 rounded-xl bg-surface p-4 shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5"
    >
      <div
        className={`grid size-12 place-items-center rounded-md text-primary-fg ${LIST_COLOR_CLASS[color]}`}
      >
        <Icon className="size-5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{list.name}</p>
        <p className="mt-0.5 text-sm text-muted">
          {list.uncheckedCount === 0
            ? list.totalCount === 0
              ? "Empty — add this week's run"
              : "All checked"
            : `${list.uncheckedCount} to buy`}
        </p>
      </div>
      <ChevronRight className="size-4 text-subtle" />
    </Link>
  );
}
