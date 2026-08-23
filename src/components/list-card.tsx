import { Link } from "@tanstack/react-router";
import { MoreHorizontal, Plus } from "lucide-react";
import { listColor, listIcon, LIST_COLOR_CLASS } from "@/lib/icons";
import type { ShoppingList } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ListCard({
  list,
  onEdit,
  onDelete,
}: {
  list: ShoppingList;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = listIcon(list.icon);
  const color = listColor(list.color);
  return (
    <div className="panel flex items-center overflow-hidden">
      <Link
        to="/lists/$listId"
        params={{ listId: String(list.id) }}
        className="flex min-w-0 flex-1 items-center gap-4 p-4 transition-[background-color] duration-200 hover:bg-bg-elevated"
      >
        <div
          className={`grid size-11 place-items-center rounded-full text-primary-fg ${LIST_COLOR_CLASS[color]}`}
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
      </Link>
      <div className="pr-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`${list.name} list actions`}>
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
    </div>
  );
}

export function NewListCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-lg border border-dashed border-fg/20 bg-transparent p-4 text-left transition-[background-color] duration-200 hover:bg-bg-elevated"
    >
      <div className="grid size-11 place-items-center rounded-full border border-dashed border-fg/25 text-fg">
        <Plus className="size-5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">New list</p>
        <p className="mt-0.5 text-sm text-muted">Costco, farmers market, Target…</p>
      </div>
    </button>
  );
}
