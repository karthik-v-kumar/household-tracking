import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Plus } from "lucide-react";
import { toast } from "sonner";
import { AuthGate, useOverviewQuery } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { FilterSegment, FiltersPanel } from "@/components/filters-panel";
import { LevelMeter } from "@/components/level-meter";
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

function InventoryPage() {
  return <AuthGate>{() => <InventoryBody />}</AuthGate>;
}

function InventoryBody() {
  const queryClient = useQueryClient();
  const overview = useOverviewQuery();
  const lists = overview.data?.lists ?? [];
  const [view, setView] = useState<"pantry" | "filters">("pantry");
  const [open, setOpen] = useState(false);

  const inventory = useQuery({
    queryKey: ["inventory"],
    queryFn: () => listInventory(),
    refetchInterval: 15_000,
  });
  const upkeep = useQuery({
    queryKey: ["upkeep"],
    queryFn: () => listUpkeep(),
    refetchInterval: 15_000,
  });

  const items = inventory.data ?? [];
  const low = items.filter((item) => item.effectiveLevel === "low" || item.effectiveLevel === "out");
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
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (itemId: number) => deleteInventoryItem({ data: { itemId } }),
    onSuccess: invalidate,
  });

  return (
    <AppShell
      title={view === "filters" ? "Filters" : "Pantry"}
      eyebrow="Inventory"
      stat={
        view === "filters"
          ? dueFilters
            ? `${dueFilters} need a spare or a change.`
            : "Replacement schedule and whether you have one on the shelf."
          : low.length
            ? `${low.length} running low — add them before the weekend run.`
            : "Track bulk items. We'll nudge you when a pack is nearly gone."
      }
      actions={
        <Button
          size="icon-sm"
          onClick={() => setOpen(true)}
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
          onAddClick={() => setOpen(true)}
          addOpen={open}
          onAddOpenChange={setOpen}
        />
      ) : (
        <>
          {low.length > 0 ? (
            <div className="panel mb-4 flex items-center justify-between gap-3 px-4 py-3">
              <p className="text-sm">
                <span className="font-medium">{low.length} running low</span>
              </p>
              <Button size="sm" variant="secondary" onClick={() => addLow.mutate(undefined)}>
                Add all
              </Button>
            </div>
          ) : null}

          {items.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nothing tracked yet"
              body="Start with household bulk — toilet paper, detergent, mouthwash. Set how long a pack usually lasts."
              action={
                <Button onClick={() => setOpen(true)}>
                  <Plus className="size-4" />
                  Add item
                </Button>
              }
            />
          ) : (
            <div className="grid gap-2.5">
              {items.map((item) => (
                <InventoryCard
                  key={item.id}
                  item={item}
                  onLevel={(level) => setLevel.mutate({ itemId: item.id, level })}
                  onAdd={() => addLow.mutate([item.id])}
                  onDelete={() => remove.mutate(item.id)}
                />
              ))}
            </div>
          )}

          <AddInventoryDialog
            open={open}
            onOpenChange={setOpen}
            lists={lists.map((l) => ({ id: l.id, name: l.name }))}
            existingNames={items.map((i) => i.name)}
            onCreated={invalidate}
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
  onDelete,
}: {
  item: InventoryItem;
  onLevel: (level: InventoryLevel) => void;
  onAdd: () => void;
  onDelete: () => void;
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
      ? `Last restocked ${item.daysSinceRestock}d ago · usually lasts ${item.typicalDays}d`
      : item.typicalDays
        ? `Usually lasts ${item.typicalDays} days`
        : "Set a typical lifespan to get a heads-up";

  return (
    <article className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display font-medium">{item.name}</h3>
          <p className="mt-0.5 text-xs text-muted">{estimate}</p>
        </div>
        <Badge tone={tone}>
          {item.effectiveLevel === "out"
            ? "Out"
            : item.effectiveLevel === "low"
              ? "Low"
              : item.effectiveLevel === "full"
                ? "Full"
                : "Okay"}
        </Badge>
      </div>
      <div className="mt-4">
        <LevelMeter level={item.level} onChange={onLevel} />
        <div className="mt-1.5 flex justify-between font-display text-xs tracking-wide text-subtle uppercase">
          <span>Out</span>
          <span>Full</span>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="flex-1"
          disabled={item.onAList}
          onClick={onAdd}
        >
          {item.onAList ? "On a list" : "Add to list"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          Remove
        </Button>
      </div>
    </article>
  );
}

function AddInventoryDialog({
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
  const [name, setName] = useState("");
  const [typicalDays, setTypicalDays] = useState("45");
  const [listId, setListId] = useState<number | "">(lists[0]?.id ?? "");

  useEffect(() => {
    if (!open) return;
    setName("");
    setTypicalDays("45");
    setListId(lists[0]?.id ?? "");
  }, [open]);

  const have = useMemo(
    () => new Set(existingNames.map((n) => n.toLowerCase())),
    [existingNames],
  );

  const create = useMutation({
    mutationFn: (input: {
      name: string;
      typicalDays?: number;
      defaultListId?: number;
    }) => addInventoryItem({ data: input }),
    onSuccess: async () => {
      toast.success("Tracked");
      setName("");
      await onCreated();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Track a bulk item</DialogTitle>
          <DialogDescription>
            We'll nudge you when it is likely running out, based on the last restock.
          </DialogDescription>
        </DialogHeader>
        <div className="mb-4 flex flex-wrap gap-2">
          {QUICK_INVENTORY.filter((item) => !have.has(item.name.toLowerCase())).map((item) => {
            const selected = name.trim().toLowerCase() === item.name.toLowerCase();
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => {
                  setName(item.name);
                  setTypicalDays(String(item.typicalDays));
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors duration-200",
                  selected
                    ? "border-fg bg-primary text-primary-fg"
                    : "border-border bg-bg-elevated text-fg",
                )}
              >
                {item.name}
              </button>
            );
          })}
        </div>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            create.mutate({
              name: name.trim(),
              typicalDays: typicalDays ? Number(typicalDays) : undefined,
              defaultListId: typeof listId === "number" ? listId : undefined,
            });
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="inv-name">Item</Label>
            <Input
              id="inv-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Toilet paper"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="typical">Typical days</Label>
              <Input
                id="typical"
                inputMode="numeric"
                value={typicalDays}
                onChange={(e) => setTypicalDays(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="restock-list">Restock at</Label>
              <select
                id="restock-list"
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
            {create.isPending ? "Saving…" : "Add to inventory"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
