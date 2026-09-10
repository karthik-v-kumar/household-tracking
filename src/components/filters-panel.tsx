import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Filter, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { ListPicker } from "@/components/list-picker";
import { Stepper } from "@/components/stepper";
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
import { QUICK_FILTERS, REPLACE_INTERVALS, STOCK_LEAD_PRESETS } from "@/lib/constants";
import { fromDateInput, toDateInput } from "@/lib/dates";
import { DEFAULT_STOCK_LEAD_DAYS } from "@/lib/upkeep-logic";
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
  const [editing, setEditing] = useState<UpkeepItem | null>(null);
  const upkeep = useQuery({
    queryKey: ["upkeep"],
    queryFn: () => listUpkeep(),
    refetchInterval: 4_000,
  });
  const items = upkeep.data ?? [];
  const needed = items.filter((item) => item.needToBuy);

  useEffect(() => {
    if (addOpen) setEditing(null);
  }, [addOpen]);

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
    mutationFn: async (item: UpkeepItem) => {
      await deleteUpkeepItem({ data: { itemId: item.id } });
      return item;
    },
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: ["upkeep"] });
      const previous = queryClient.getQueryData<UpkeepItem[]>(["upkeep"]);
      queryClient.setQueryData<UpkeepItem[]>(["upkeep"], (current) =>
        (current ?? []).filter((row) => row.id !== item.id),
      );
      return { previous };
    },
    onError: (err: Error, _item, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["upkeep"], ctx.previous);
      toast.error(err.message);
    },
    onSuccess: (item) => {
      toast(`${item.name} removed`, {
        duration: 10_000,
        action: {
          label: "Undo",
          onClick: () => {
            void restoreFilter(item);
          },
        },
      });
    },
  });

  async function restoreFilter(item: UpkeepItem) {
    try {
      await addUpkeepItem({
        data: {
          name: item.name,
          intervalDays: item.intervalDays,
          qtyNeeded: item.qtyNeeded,
          spareCount: item.spareCount,
          lastReplacedAt: item.lastReplacedAt,
          stockLeadDays: item.stockLeadDays,
          defaultListId: item.defaultListId,
        },
      });
      await invalidate();
      toast.success(`${item.name} restored`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not undo");
    }
  }

  const dialogOpen = addOpen || Boolean(editing);

  return (
    <>
      {needed.length > 0 ? (
        <div className="mb-5 flex items-baseline justify-between gap-3">
          <p className="text-sm">{needed.length} need a spare or a change</p>
          <button
            type="button"
            className="text-[13.5px] font-semibold text-accent"
            onClick={() => addNeeded.mutate(undefined)}
          >
            Add all
          </button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={Filter}
          image="/images/filter.jpg"
          imageAlt="A pleated furnace air filter"
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
        <div className="border-t border-hairline">
          {items.map((item) => (
            <FilterCard
              key={item.id}
              item={item}
              onSpare={(spareCount) => patch.mutate({ itemId: item.id, spareCount })}
              onReplaced={() => replaced.mutate(item.id)}
              onAdd={() => addNeeded.mutate([item.id])}
              onEdit={() => setEditing(item)}
            />
          ))}
        </div>
      )}

      <FilterDialog
        open={dialogOpen}
        onOpenChange={(next) => {
          if (!next) {
            setEditing(null);
            onAddOpenChange(false);
          }
        }}
        item={editing}
        lists={lists}
        existingNames={items.map((row) => row.name)}
        onSaved={invalidate}
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
  onEdit,
}: {
  item: UpkeepItem;
  onSpare: (count: number) => void;
  onReplaced: () => void;
  onAdd: () => void;
  onEdit: () => void;
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
    <article className="border-b border-hairline py-4">
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="min-w-0 text-left" onClick={onEdit}>
          <h3 className="truncate text-base font-medium tracking-[-0.012em]">{item.name}</h3>
          <p className="mt-0.5 text-[13px] text-muted">
            {intervalLabel(item.intervalDays)}
            {item.qtyNeeded > 1 ? ` · ${item.qtyNeeded} each time` : ""}
            {` · ${formatUpkeepDue(item.daysUntil)}`}
          </p>
        </button>
        <Badge tone={tone}>{badge}</Badge>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted">On the shelf</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Fewer on the shelf"
            disabled={item.spareCount <= 0}
            onClick={() => onSpare(item.spareCount - 1)}
            className="grid size-[30px] place-items-center rounded-full border border-hairline text-fg-2 disabled:opacity-30"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="w-6 text-center text-[17px] font-semibold tabular-nums">{item.spareCount}</span>
          <button
            type="button"
            aria-label="More on the shelf"
            onClick={() => onSpare(item.spareCount + 1)}
            className="grid size-[30px] place-items-center rounded-full border border-hairline text-fg-2"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" className="h-8 rounded-full px-3.5" onClick={onReplaced}>
          Mark replaced
        </Button>
        {item.needToBuy && !item.onAList ? (
          <Button size="sm" variant="secondary" className="h-8 rounded-full px-3.5" onClick={onAdd}>
            Add to list
          </Button>
        ) : (
          <button type="button" className="text-[13.5px] font-medium text-muted" onClick={onEdit}>
            Edit
          </button>
        )}
      </div>
    </article>
  );
}

function FilterDialog({
  open,
  onOpenChange,
  item,
  lists,
  existingNames,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: UpkeepItem | null;
  lists: { id: number; name: string }[];
  existingNames: string[];
  onSaved: () => Promise<unknown>;
}) {
  const warehouse = lists.find((list) => list.name.toLowerCase() === "warehouse");
  const [name, setName] = useState("");
  const [intervalDays, setIntervalDays] = useState(90);
  const [qtyNeeded, setQtyNeeded] = useState(1);
  const [spareCount, setSpareCount] = useState(0);
  const [stockLeadDays, setStockLeadDays] = useState(DEFAULT_STOCK_LEAD_DAYS);
  const [listId, setListId] = useState<number | "">("");
  const [lastChanged, setLastChanged] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? "");
    setIntervalDays(item?.intervalDays ?? 90);
    setQtyNeeded(item?.qtyNeeded ?? 1);
    setSpareCount(item?.spareCount ?? 0);
    setStockLeadDays(item?.stockLeadDays ?? DEFAULT_STOCK_LEAD_DAYS);
    setListId(item?.defaultListId ?? warehouse?.id ?? lists[0]?.id ?? "");
    setLastChanged(
      toDateInput(item?.lastReplacedAt) || toDateInput(new Date().toISOString()),
    );
  }, [open, item, lists, warehouse?.id]);

  const have = useMemo(
    () => new Set(existingNames.map((n) => n.toLowerCase())),
    [existingNames],
  );

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        intervalDays,
        qtyNeeded: Math.max(1, qtyNeeded),
        spareCount: Math.max(0, spareCount),
        stockLeadDays,
        lastReplacedAt: lastChanged ? fromDateInput(lastChanged) : null,
        defaultListId: typeof listId === "number" ? listId : null,
      };
      if (item) {
        return updateUpkeepItem({ data: { itemId: item.id, ...payload } });
      }
      return addUpkeepItem({ data: payload });
    },
    onSuccess: async () => {
      toast.success(item ? "Updated" : "Tracking");
      await onSaved();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Edit filter" : "Track a filter"}</DialogTitle>
          <DialogDescription>
            Set when you last changed it — not today, unless you just did.
          </DialogDescription>
        </DialogHeader>
        {!item ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {QUICK_FILTERS.filter((row) => !have.has(row.name.toLowerCase())).map((row) => {
              const selected = name.trim().toLowerCase() === row.name.toLowerCase();
              return (
                <button
                  key={row.name}
                  type="button"
                  onClick={() => {
                    setName(row.name);
                    setIntervalDays(row.intervalDays);
                    setQtyNeeded(row.qtyNeeded);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors duration-200",
                    selected
                      ? "border-fg bg-primary text-primary-fg"
                      : "border-border bg-bg-elevated text-fg",
                  )}
                >
                  {row.name}
                </button>
              );
            })}
          </div>
        ) : null}
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            save.mutate();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="filter-name">Item</Label>
            <Input
              id="filter-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Furnace air filter"
              autoComplete="off"
              enterKeyHint="done"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="filter-changed">Last changed</Label>
            <Input
              id="filter-changed"
              type="date"
              value={lastChanged}
              max={toDateInput(new Date().toISOString())}
              onChange={(e) => setLastChanged(e.target.value)}
            />
            <p className="text-xs text-muted">The day you last put a new one in.</p>
          </div>
          <div className="grid gap-1.5">
            <Stepper
              label="Replace every"
              value={intervalDays}
              min={7}
              max={1095}
              suffix="days"
              editable
              onChange={setIntervalDays}
            />
            <div className="flex flex-wrap gap-1.5">
              {REPLACE_INTERVALS.map((row) => {
                const selected = intervalDays === row.days;
                return (
                  <button
                    key={row.days}
                    type="button"
                    onClick={() => setIntervalDays(row.days)}
                    className={cn(
                      "h-8 rounded-full border px-2.5 text-sm",
                      selected
                        ? "border-fg bg-primary text-primary-fg"
                        : "border-border bg-bg-elevated text-fg",
                    )}
                  >
                    {row.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stepper label="Each change" value={qtyNeeded} min={1} onChange={setQtyNeeded} />
            <Stepper label="On the shelf now" value={spareCount} min={0} onChange={setSpareCount} />
          </div>
          <div className="grid gap-1.5">
            <p className="text-sm font-medium">Remind me to stock</p>
            <p className="text-xs text-muted">
              Cabin filters and the like don't need a spare two years early.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {STOCK_LEAD_PRESETS.map((row) => {
                const selected = stockLeadDays === row.days;
                return (
                  <button
                    key={row.days}
                    type="button"
                    onClick={() => setStockLeadDays(row.days)}
                    className={cn(
                      "h-8 rounded-full border px-2.5 text-sm",
                      selected
                        ? "border-fg bg-primary text-primary-fg"
                        : "border-border bg-bg-elevated text-fg",
                    )}
                  >
                    {row.label}
                  </button>
                );
              })}
            </div>
          </div>
          <ListPicker label="Buy at" lists={lists} value={listId} onChange={setListId} />
          <Button type="submit" disabled={save.isPending || !name.trim()}>
            {save.isPending ? "Saving…" : item ? "Save changes" : "Add filter"}
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
    <div className="mb-5 flex h-9 rounded-[10px] bg-fill-quiet p-[3px]">
      {(
        [
          { id: "pantry", label: "Pantry" },
          { id: "filters", label: "Filters" },
        ] as const
      ).map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => onChange(row.id)}
          className={cn(
            "flex-1 rounded-sm text-[13.5px] font-semibold transition-colors duration-[180ms]",
            view === row.id ? "bg-surface text-fg shadow-[0_1px_2px_rgba(21,19,15,0.08)]" : "text-muted",
          )}
        >
          {row.label}
          {row.id === "filters" && dueCount > 0 ? ` · ${dueCount}` : ""}
        </button>
      ))}
    </div>
  );
}
