import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { listColor, listIcon, LIST_COLOR_CLASS } from "@/lib/icons";
import type { ShoppingList } from "@/lib/types";

export function ListCard({ list }: { list: ShoppingList }) {
  const Icon = listIcon(list.icon);
  const color = listColor(list.color);
  return (
    <Link
      to="/lists/$listId"
      params={{ listId: String(list.id) }}
      className="panel flex items-center gap-4 p-4 transition-[transform,background-color] duration-200 hover:bg-bg-elevated"
    >
      <div className={`grid size-11 place-items-center rounded-full text-primary-fg ${LIST_COLOR_CLASS[color]}`}>
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
