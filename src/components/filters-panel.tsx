import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Filter, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QUICK_FILTERS, REPLACE_INTERVALS } from "@/lib/constants";
import { formatUpkeepDue } from "@/lib/upkeep-logic";
import {
  addNeededUpkeepToLists,
  addUpkeepItem,
  deleteUpkeepItem,
  listUpkeep,
  markReplaced,
  updateUpkeepItem,
} from "@/lib/server/upkeep";
import type { UpkeepItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FiltersPanel({
  lists,
  onAddClick,
  addOpen,
  onAddOpenChange,
}: {
  lists: { id: number; name: string }[];
  onAddClick: () => void;
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const upkeep = useQuery({
    queryKey: ["upkeep"],
    queryFn: () => listUpkeep(),
    refetchInterval: 15_000,
  });
  const items = upkeep.data ?? [];
  const needed = items.filter((item) => item.needToBuy);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["upkeep"] }),
      queryClient.invalidateQueries({ queryKey: ["overview"] }),
    ]);
  };

  const addNeeded = useMutation({
    mutationFn: (itemIds?: number[]) => addNeededUpkeepToLists({ data: { itemIds } }),
    onSuccess: async (result) => {
      toast.success(result.added ? `Added ${result.added} to lists` : "Already on a list");
      await invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const replaced = useMutation({
    mutationFn: (itemId: number) => markReplaced({ data: { itemId } }),
    onSuccess: invalidate,
    onError: (err: Error) => toast.error(err.message),
  });

  const patch = useMutation({
    mutationFn: (input: { itemId: number; spareCount?: number }) =>
      updateUpkeepItem({ data: input }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (itemId: number) => deleteUpkeepItem({ data: { itemId } }),
    onSuccess: invalidate,
  });

  return (
    <>
      {needed.length > 0 ? (
        <div className="panel mb-4 flex items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm">
            <span className="font-medium">
              {needed.length} without a spare
            </span>
          </p>
          <Button size="sm" variant="secondary" onClick={() => addNeeded.mutate(undefined)}>
            Add all
          </Button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="No filters yet"
          body="Furnace, fridge, cabin air — set how often they change and whether you keep a spare at home. If you don't, it goes on a list."
          action={
            <Button onClick={onAddClick}>
              <Plus className="size-4" />
              Add filter
            </Button>
          }
        />
      ) : (
        <div className="grid gap-2.5">
          {items.map((item) => (
            <FilterCard
              key={item.id}
              item={item}
              onSpare={(spareCount) => patch.mutate({ itemId: item.id, spareCount })}
              onReplaced={() => replaced.mutate(item.id)}
              onAdd={() => addNeeded.mutate([item.id])}
              onDelete={() => remove.mutate(item.id)}
            />
          ))}
        </div>
      )}

      <AddFilterDialog
        open={addOpen}
        onOpenChange={onAddOpenChange}
        lists={lists}
        existingNames={items.map((item) => item.name)}
        onCreated={invalidate}
      />
    </>
  );
}

function intervalLabel(days: number) {
  return REPLACE_INTERVALS.find((item) => item.days === days)?.label ?? `Every ${days} days`;
}

function FilterCard({
  item,
  onSpare,
  onReplaced,
  onAdd,
  onDelete,
}: {
  item: UpkeepItem;
  onSpare: (count: number) => void;
  onReplaced: () => void;
  onAdd: () => void;
  onDelete: () => void;
}) {
  const tone =
    item.status === "due" ? "danger" : item.status === "soon" ? "warn" : item.status === "buy" ? "warn" : "ok";
  const badge =
    item.status === "due"
      ? "Due"
      : item.status === "soon"
        ? "Soon"
        : item.status === "buy"
          ? "Need spare"
          : "On track";

  return (
    <article className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display font-medium">{item.name}</h3>
          <p className="mt-0.5 text-xs text-muted">
            {intervalLabel(item.intervalDays)}
            {item.qtyNeeded > 1 ? ` · ${item.qtyNeeded} each time` : ""}
          </p>
          <p className="mt-0.5 text-xs text-muted">{formatUpkeepDue(item.daysUntil)}</p>
        </div>
        <Badge tone={tone}>{badge}</Badge>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">On the shelf</p>
        <div className="flex items-center gap-2">
          <Button
            size="icon-sm"
            variant="secondary"
            aria-label="Fewer on the shelf"
            disabled={item.spareCount <= 0}
            onClick={() => onSpare(item.spareCount - 1)}
          >
            <Minus className="size-3.5" />
          </Button>
          <span className="w-6 text-center text-sm font-medium tabular-nums">{item.spareCount}</span>
          <Button
            size="icon-sm"
            variant="secondary"
            aria-label="More on the shelf"
            onClick={() => onSpare(item.spareCount + 1)}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button size="sm" variant="secondary" className="flex-1" onClick={onReplaced}>
          Replaced
        </Button>
        <Button
          size="sm"
          variant={item.needToBuy ? "default" : "secondary"}
          className="flex-1"
          disabled={item.onAList || !item.needToBuy}
          onClick={onAdd}
        >
          {item.onAList ? "On a list" : item.needToBuy ? "Add to list" : "Stocked"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          Remove
        </Button>
      </div>
    </article>
  );
}

function AddFilterDialog({
  open,
  onOpenChange,
  lists,
  existingNames,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lists: { id: number; name: string }[];
  existingNames: string[];
  onCreated: () => Promise<unknown>;
}) {
  const warehouse = lists.find((list) => list.name.toLowerCase() === "warehouse");
  const [name, setName] = useState("");
  const [intervalDays, setIntervalDays] = useState(90);
  const [qtyNeeded, setQtyNeeded] = useState("1");
  const [spareCount, setSpareCount] = useState("0");
  const [listId, setListId] = useState<number | "">(warehouse?.id ?? lists[0]?.id ?? "");

  const have = useMemo(
    () => new Set(existingNames.map((n) => n.toLowerCase())),
    [existingNames],
  );

  const create = useMutation({
    mutationFn: (input: {
      name: string;
      intervalDays: number;
      qtyNeeded?: number;
      spareCount?: number;
      defaultListId?: number;
    }) => addUpkeepItem({ data: input }),
    onSuccess: async () => {
      toast.success("Tracking");
      setName("");
      setQtyNeeded("1");
      setSpareCount("0");
      await onCreated();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Track a filter</DialogTitle>
          <DialogDescription>
            Set the replacement interval and how many you keep at home. If the shelf is empty, we'll put it on a list.
          </DialogDescription>
        </DialogHeader>
        <div className="mb-4 flex flex-wrap gap-2">
          {QUICK_FILTERS.filter((item) => !have.has(item.name.toLowerCase())).map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() =>
                create.mutate({
                  name: item.name,
                  intervalDays: item.intervalDays,
                  qtyNeeded: item.qtyNeeded,
                  spareCount: 0,
                  defaultListId: typeof listId === "number" ? listId : undefined,
                })
              }
              className="rounded-full border border-border bg-bg-elevated px-3 py-1.5 text-sm text-fg"
            >
              {item.name}
            </button>
          ))}
        </div>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            create.mutate({
              name: name.trim(),
              intervalDays,
              qtyNeeded: Math.max(1, Number(qtyNeeded) || 1),
              spareCount: Math.max(0, Number(spareCount) || 0),
              defaultListId: typeof listId === "number" ? listId : undefined,
            });
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="filter-name">Item</Label>
            <Input
              id="filter-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Furnace air filter"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="filter-interval">Replace</Label>
              <select
                id="filter-interval"
                className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
                value={intervalDays}
                onChange={(e) => setIntervalDays(Number(e.target.value))}
              >
                {REPLACE_INTERVALS.map((row) => (
                  <option key={row.days} value={row.days}>
                    {row.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="filter-qty">Each change</Label>
              <Input
                id="filter-qty"
                inputMode="numeric"
                value={qtyNeeded}
                onChange={(e) => setQtyNeeded(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="filter-spare">On the shelf now</Label>
              <Input
                id="filter-spare"
                inputMode="numeric"
                value={spareCount}
                onChange={(e) => setSpareCount(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="filter-list">Buy at</Label>
              <select
                id="filter-list"
                className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
                value={listId}
                onChange={(e) => setListId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Any list</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button type="submit" disabled={create.isPending || !name.trim()}>
            {create.isPending ? "Saving…" : "Add filter"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FilterSegment({
  view,
  onChange,
  dueCount,
}: {
  view: "pantry" | "filters";
  onChange: (view: "pantry" | "filters") => void;
  dueCount: number;
}) {
  return (
    <div className="mb-5 flex rounded-full border border-border bg-bg-elevated p-1">
      {(
        [
          { id: "pantry", label: "Pantry" },
          { id: "filters", label: "Filters" },
        ] as const
      ).map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            "flex-1 rounded-full px-3 py-2.5 text-sm font-medium transition-colors duration-200",
            view === item.id ? "bg-primary text-primary-fg" : "text-muted hover:text-fg",
          )}
        >
          {item.label}
          {item.id === "filters" && dueCount > 0 ? ` · ${dueCount}` : ""}
        </button>
      ))}
    </div>
  );
}
