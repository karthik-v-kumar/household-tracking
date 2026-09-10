import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Plus } from "lucide-react";
import { toast } from "sonner";
import { AuthGate, useOverviewQuery } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { FilterSegment, FiltersPanel } from "@/components/filters-panel";
import { LevelMeter } from "@/components/level-meter";
import { ListPicker } from "@/components/list-picker";
import { Stepper } from "@/components/stepper";
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
import { Badge } from "@/components/ui/badge";
import { QUICK_INVENTORY, type InventoryLevel } from "@/lib/constants";
import { fromDateInput, toDateInput } from "@/lib/dates";
import {
  addInventoryItem,
  addLowInventoryToLists,
  deleteInventoryItem,
  listInventory,
  updateInventoryItem,
} from "@/lib/server/inventory";
import { listUpkeep } from "@/lib/server/upkeep";
import type { InventoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inventory")({ component: InventoryPage });

const LAST_PRESETS = [30, 45, 60, 90];

function InventoryPage() {
  return <AuthGate>{() => <InventoryBody />}</AuthGate>;
}

function InventoryBody() {
  const queryClient = useQueryClient();
  const overview = useOverviewQuery();
  const lists = overview.data?.lists ?? [];
  const [view, setView] = useState<"pantry" | "filters">("pantry");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);

  const inventory = useQuery({
    queryKey: ["inventory"],
    queryFn: () => listInventory(),
  });
  const upkeep = useQuery({
    queryKey: ["upkeep"],
    queryFn: () => listUpkeep(),
  });

  const items = inventory.data ?? [];
  const pinnedIds = useRef<number[]>([]);
  if (items.length) {
    const ids = items.map((item) => item.id);
    const keep = pinnedIds.current.filter((id) => ids.includes(id));
    const added = ids.filter((id) => !keep.includes(id));
    pinnedIds.current = keep.length === 0 ? ids : [...keep, ...added];
  }
  const byId = new Map(items.map((item) => [item.id, item]));
  const orderedItems = pinnedIds.current
    .map((id) => byId.get(id))
    .filter((item): item is InventoryItem => Boolean(item));
  const low = orderedItems.filter((item) => item.effectiveLevel === "low" || item.effectiveLevel === "out");
  const dueFilters = (upkeep.data ?? []).filter((item) => item.status !== "ok").length;

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      queryClient.invalidateQueries({ queryKey: ["overview"] }),
    ]);
  };

  const addLow = useMutation({
    mutationFn: (itemIds?: number[]) => addLowInventoryToLists({ data: { itemIds } }),
    onSuccess: async (result) => {
      toast.success(result.added ? `Added ${result.added} to lists` : "Already on a list");
      await invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setLevel = useMutation({
    mutationFn: (input: { itemId: number; level: InventoryLevel }) =>
      updateInventoryItem({ data: input }),
    onMutate: async ({ itemId, level }) => {
      await queryClient.cancelQueries({ queryKey: ["inventory"] });
      const previous = queryClient.getQueryData<InventoryItem[]>(["inventory"]);
      queryClient.setQueryData<InventoryItem[]>(["inventory"], (current) =>
        (current ?? []).map((item) =>
          item.id === itemId ? { ...item, level, effectiveLevel: level } : item,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["inventory"], ctx.previous);
    },
    onSettled: () => {
      void invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: async (item: InventoryItem) => {
      await deleteInventoryItem({ data: { itemId: item.id } });
      return item;
    },
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: ["inventory"] });
      const previous = queryClient.getQueryData<InventoryItem[]>(["inventory"]);
      const index = previous?.findIndex((row) => row.id === item.id) ?? pinnedIds.current.indexOf(item.id);
      queryClient.setQueryData<InventoryItem[]>(["inventory"], (current) =>
        (current ?? []).filter((row) => row.id !== item.id),
      );
      return { previous, index };
    },
    onError: (err: Error, _item, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["inventory"], ctx.previous);
      toast.error(err.message);
    },
    onSuccess: (item, _vars, ctx) => {
      toast(`${item.name} removed`, {
        duration: 10_000,
        action: {
          label: "Undo",
          onClick: () => {
            void restoreInventory(item, ctx?.index ?? 0);
          },
        },
      });
    },
  });

  async function restoreInventory(item: InventoryItem, index: number) {
    try {
      const result = await addInventoryItem({
        data: {
          name: item.name,
          category: item.category,
          level: item.level,
          typicalDays: item.typicalDays,
          defaultListId: item.defaultListId,
          lastRestockedAt: item.lastRestockedAt,
          notes: item.notes,
        },
      });
      const pin = pinnedIds.current.filter((id) => id !== item.id);
      const at = Math.max(0, Math.min(index, pin.length));
      pinnedIds.current = [...pin.slice(0, at), result.id, ...pin.slice(at)];
      await invalidate();
      toast.success(`${item.name} restored`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not undo");
    }
  }

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  return (
    <AppShell
      title={view === "filters" ? "Filters" : "Pantry"}
      eyebrow="Inventory"
      stat={
        view === "filters"
          ? dueFilters
            ? `${dueFilters} need a spare or a change`
            : "Replacement schedule and whether you have one on the shelf"
          : low.length
            ? `${low.length} running low before the weekend run`
            : "Track bulk items. We'll nudge you when a pack is nearly gone"
      }
      actions={
        <Button
          size="icon-sm"
          onClick={openCreate}
          aria-label={view === "filters" ? "Add filter" : "Add inventory item"}
        >
          <Plus className="size-4" />
        </Button>
      }
    >
      <FilterSegment view={view} onChange={setView} dueCount={dueFilters} />

      {view === "filters" ? (
        <FiltersPanel
          lists={lists.map((l) => ({ id: l.id, name: l.name }))}
          onAddClick={openCreate}
          addOpen={open}
          onAddOpenChange={(next) => {
            setOpen(next);
            if (!next) setEditing(null);
          }}
        />
      ) : (
        <>
          {low.length > 0 ? (
            <div className="mb-5 flex items-baseline justify-between gap-3">
              <p className="text-sm text-fg">
                {low.length} item{low.length === 1 ? "" : "s"} running low
              </p>
              <button
                type="button"
                className="text-[13.5px] font-semibold text-accent"
                onClick={() => addLow.mutate(undefined)}
              >
                Add all
              </button>
            </div>
          ) : null}

          {orderedItems.length === 0 ? (
            <EmptyState
              icon={Package}
              image="/images/paper.jpg"
              imageAlt="Paper towels and toilet paper"
              title="Nothing tracked yet"
              body="Start with household bulk — toilet paper, detergent, mouthwash. Set how long a pack usually lasts."
              action={
                <Button onClick={openCreate}>
                  <Plus className="size-4" />
                  Add item
                </Button>
              }
            />
          ) : (
            <div className="border-t border-hairline">
              {orderedItems.map((item) => (
                <InventoryCard
                  key={item.id}
                  item={item}
                  onLevel={(level) => setLevel.mutate({ itemId: item.id, level })}
                  onAdd={() => addLow.mutate([item.id])}
                  onEdit={() => {
                    setEditing(item);
                    setOpen(true);
                  }}
                />
              ))}
            </div>
          )}

          <InventoryDialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) setEditing(null);
            }}
            item={editing}
            lists={lists.map((l) => ({ id: l.id, name: l.name }))}
            existingNames={items.map((i) => i.name)}
            onSaved={invalidate}
          />
        </>
      )}
    </AppShell>
  );
}

function InventoryCard({
  item,
  onLevel,
  onAdd,
  onEdit,
}: {
  item: InventoryItem;
  onLevel: (level: InventoryLevel) => void;
  onAdd: () => void;
  onEdit: () => void;
}) {
  const tone =
    item.effectiveLevel === "out"
      ? "danger"
      : item.effectiveLevel === "low"
        ? "warn"
        : item.effectiveLevel === "full"
          ? "ok"
          : "neutral";
  const estimate =
    item.typicalDays && item.daysSinceRestock != null
      ? `Restocked ${item.daysSinceRestock}d ago · lasts ~${item.typicalDays}d`
      : item.typicalDays
        ? `Usually lasts ${item.typicalDays}d`
        : "Set a typical lifespan to get a heads-up";
  const store = item.defaultListName ?? "list";
  const needsBuy = item.effectiveLevel === "low" || item.effectiveLevel === "out";

  return (
    <article className="border-b border-hairline py-4">
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="min-w-0 text-left" onClick={onEdit}>
          <h3 className="truncate text-base font-medium tracking-[-0.012em]">{item.name}</h3>
          <p className="mt-0.5 text-[13px] text-muted">{estimate}</p>
        </button>
        <Badge tone={tone}>
          {item.effectiveLevel === "out"
            ? "Out"
            : item.effectiveLevel === "low"
              ? "Low"
              : item.effectiveLevel === "full"
                ? "On track"
                : "Okay"}
        </Badge>
      </div>
      <div className="mt-3">
        <LevelMeter level={item.level} onChange={onLevel} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        {needsBuy && !item.onAList ? (
          <Button size="sm" className="h-8 rounded-full px-3.5" onClick={onAdd}>
            Add to {store}
          </Button>
        ) : (
          <Button size="sm" variant="secondary" className="h-8 rounded-full px-3.5" disabled={item.onAList} onClick={onAdd}>
            {item.onAList ? `On the ${store} list` : `Add to ${store}`}
          </Button>
        )}
        <button type="button" className="text-[13.5px] font-medium text-muted" onClick={onEdit}>
          Edit
        </button>
      </div>
    </article>
  );
}

function InventoryDialog({
  open,
  onOpenChange,
  item,
  lists,
  existingNames,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem | null;
  lists: { id: number; name: string }[];
  existingNames: string[];
  onSaved: () => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [typicalDays, setTypicalDays] = useState(45);
  const [listId, setListId] = useState<number | "">("");
  const [lastRestocked, setLastRestocked] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? "");
    setTypicalDays(item?.typicalDays ?? 45);
    setListId(item?.defaultListId ?? lists[0]?.id ?? "");
    setLastRestocked(toDateInput(item?.lastRestockedAt) || toDateInput(new Date().toISOString()));
  }, [open, item, lists]);

  const have = useMemo(
    () => new Set(existingNames.map((n) => n.toLowerCase())),
    [existingNames],
  );

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        typicalDays,
        defaultListId: typeof listId === "number" ? listId : null,
        lastRestockedAt: lastRestocked ? fromDateInput(lastRestocked) : null,
      };
      if (item) {
        return updateInventoryItem({ data: { itemId: item.id, ...payload } });
      }
      return addInventoryItem({ data: payload });
    },
    onSuccess: async () => {
      toast.success(item ? "Updated" : "Tracked");
      await onSaved();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "Track a bulk item"}</DialogTitle>
          <DialogDescription>
            We'll nudge you when it is likely running out, based on the last restock.
          </DialogDescription>
        </DialogHeader>
        {!item ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {QUICK_INVENTORY.filter((row) => !have.has(row.name.toLowerCase())).map((row) => {
              const selected = name.trim().toLowerCase() === row.name.toLowerCase();
              return (
                <button
                  key={row.name}
                  type="button"
                  onClick={() => {
                    setName(row.name);
                    setTypicalDays(row.typicalDays);
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
            <Label htmlFor="inv-name">Item</Label>
            <Input
              id="inv-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Toilet paper"
              autoComplete="off"
              enterKeyHint="done"
            />
          </div>
          <div className="grid gap-1.5">
            <Stepper
              label="Usually lasts"
              value={typicalDays}
              min={1}
              max={730}
              suffix="days"
              editable
              onChange={setTypicalDays}
            />
            <div className="flex flex-wrap gap-1.5">
              {LAST_PRESETS.map((days) => {
                const selected = typicalDays === days;
                return (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setTypicalDays(days)}
                    className={cn(
                      "h-8 rounded-full border px-2.5 text-sm",
                      selected
                        ? "border-fg bg-primary text-primary-fg"
                        : "border-border bg-bg-elevated text-fg",
                    )}
                  >
                    {days}d
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="inv-restocked">Last restocked</Label>
            <Input
              id="inv-restocked"
              type="date"
              value={lastRestocked}
              max={toDateInput(new Date().toISOString())}
              onChange={(e) => setLastRestocked(e.target.value)}
            />
          </div>
          <ListPicker label="Restock at" lists={lists} value={listId} onChange={setListId} />
          <Button type="submit" disabled={save.isPending || !name.trim()}>
            {save.isPending ? "Saving…" : item ? "Save changes" : "Add to inventory"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
