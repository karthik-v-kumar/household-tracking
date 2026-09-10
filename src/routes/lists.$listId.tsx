import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, MoreHorizontal, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { AuthGate } from "@/components/auth-gate";
import { AddItemBar } from "@/components/add-item-bar";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { ItemRow } from "@/components/item-row";
import { LoginPending } from "@/components/login-screen";
import { EditUsualDialog, ManageUsualsDialog } from "@/components/edit-usual-dialog";
import { NewListDialog } from "@/components/new-list-dialog";
import { UsualsTray } from "@/components/usuals-tray";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  addListItem,
  addUsualsToList,
  clearCheckedItems,
  deleteList,
  deleteListItem,
  getListDetail,
  toggleListItem,
  updateListItem,
} from "@/lib/server/lists";
import type { ListDetail, ListItem, Usual } from "@/lib/types";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { usualBelongsToList } from "@/lib/usuals";
import { cn, isUnauthorized } from "@/lib/utils";

export const Route = createFileRoute("/lists/$listId")({ component: ListPage });

function ListPage() {
  const { listId } = Route.useParams();
  const id = Number(listId);
  const { user, isPending } = useCurrentUserState();

  if (isPending) return <LoginPending />;
  if (!user) return <RedirectToSignIn />;
  if (!Number.isFinite(id)) return <Link to="/">Back to lists</Link>;

  return (
    <AuthGate>
      {(overview) => <ListBody listId={id} lists={overview.lists} />}
    </AuthGate>
  );
}

function ListBody({
  listId,
  lists,
}: {
  listId: number;
  lists: { id: number; name: string }[];
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draggingUsual, setDraggingUsual] = useState(false);
  const [heldInPlace, setHeldInPlace] = useState<number[]>([]);
  const [manageUsuals, setManageUsuals] = useState(false);
  const [editingUsual, setEditingUsual] = useState<Usual | null>(null);
  const holdTimers = useRef<Map<number, number>>(new Map());
  const queryKey = ["list", listId] as const;

  const detail = useQuery({
    queryKey,
    queryFn: () => getListDetail({ data: { listId } }),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: ["overview"] }),
      queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      queryClient.invalidateQueries({ queryKey: ["upkeep"] }),
    ]);
  };

  const add = useMutation({
    mutationFn: (input: { name: string; quantity?: string; isStaple: boolean }) =>
      addListItem({
        data: {
          listId,
          name: input.name,
          quantity: input.quantity,
          isStaple: input.isStaple,
        },
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ListDetail>(queryKey);
      if (previous) {
        const key = input.name.toLowerCase();
        const existing = previous.items.find((item) => item.name.toLowerCase() === key);
        queryClient.setQueryData<ListDetail>(queryKey, {
          ...previous,
          items: existing
            ? previous.items.map((item) =>
                item.id === existing.id
                  ? { ...item, checked: false, isStaple: input.isStaple || item.isStaple }
                  : item,
              )
            : [
                {
                  id: -Date.now(),
                  listId,
                  catalogItemId: null,
                  name: input.name,
                  quantity: input.quantity ?? null,
                  notes: null,
                  checked: false,
                  isStaple: input.isStaple,
                  addedBy: "",
                  addedByName: "You",
                  createdAt: new Date().toISOString(),
                },
                ...previous.items,
              ],
          usuals: previous.usuals.map((usual) =>
            usual.name.toLowerCase() === key ? { ...usual, alreadyOnList: true } : usual,
          ),
        });
      }
      return { previous };
    },
    onError: (err: Error, _input, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
      toast.error(err.message);
    },
    onSuccess: async (result) => {
      if (result.already) toast.message("Already on the list");
      await invalidate();
    },
  });

  const toggle = useMutation({
    mutationFn: (input: { itemId: number; checked: boolean }) => toggleListItem({ data: input }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ListDetail>(queryKey);
      if (previous) {
        queryClient.setQueryData<ListDetail>(queryKey, {
          ...previous,
          items: previous.items.map((item) =>
            item.id === input.itemId ? { ...item, checked: input.checked } : item,
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
    onSettled: () => void invalidate(),
  });

  useEffect(() => {
    const timers = holdTimers.current;
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
    };
  }, []);

  function requestToggle(item: ListItem) {
    toggle.mutate({ itemId: item.id, checked: !item.checked });
    setHeldInPlace((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
    const existing = holdTimers.current.get(item.id);
    if (existing) window.clearTimeout(existing);
    const timer = window.setTimeout(() => {
      setHeldInPlace((prev) => prev.filter((id) => id !== item.id));
      holdTimers.current.delete(item.id);
    }, 450);
    holdTimers.current.set(item.id, timer);
  }

  const staple = useMutation({
    mutationFn: (item: ListItem) =>
      updateListItem({ data: { itemId: item.id, isStaple: !item.isStaple } }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (itemId: number) => deleteListItem({ data: { itemId } }),
    onSuccess: invalidate,
  });

  const usuals = useMutation({
    mutationFn: () => addUsualsToList({ data: { listId } }),
    onSuccess: async (result) => {
      toast.success(result.added ? `Added ${result.added} usual${result.added === 1 ? "" : "s"}` : "Usuals already on the list");
      await invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const clearBought = useMutation({
    mutationFn: () => clearCheckedItems({ data: { listId } }),
    onSuccess: async (result) => {
      toast.success(
        result.cleared
          ? `Cleared ${result.cleared}. Usuals are in the tray when you want them.`
          : "Nothing checked yet",
      );
      await invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const nextShop = useMutation({
    mutationFn: async () => {
      await clearCheckedItems({ data: { listId } });
      return addUsualsToList({ data: { listId } });
    },
    onSuccess: async (result) => {
      toast.success(
        result.added
          ? `Ready — ${result.added} usual${result.added === 1 ? "" : "s"} on the list`
          : "Cleared. No usuals waiting.",
      );
      await invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeList = useMutation({
    mutationFn: () => deleteList({ data: { listId } }),
    onSuccess: async () => {
      toast.success("List deleted");
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
      void navigate({ to: "/" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (detail.error && isUnauthorized(detail.error)) return <RedirectToSignIn />;
  if (detail.isLoading || !detail.data) {
    return (
      <AppShell eyebrow="Shopping list" title="Loading…">
        <div className="panel h-48 animate-pulse" />
      </AppShell>
    );
  }

  const { list, items, usuals: usualCatalog } = detail.data;
  const held = new Set(heldInPlace);
  const openItems = items.filter((item) => item.checked === held.has(item.id));
  const bought = items.filter((item) => item.checked !== held.has(item.id));
  const missingUsuals = usualCatalog.filter(
    (item) => !item.alreadyOnList && usualBelongsToList(item, listId),
  );
  const trayUsuals = usualCatalog.filter((item) => usualBelongsToList(item, listId));
  const busyShop = clearBought.isPending || nextShop.isPending || usuals.isPending;

  return (
    <AppShell
      eyebrow="Shopping list"
      title={list.name}
      stat={
        openItems.length
          ? `${openItems.length} to buy${bought.length ? ` · ${bought.length} bought` : ""}`
          : items.length
            ? `${bought.length} bought · nothing left to pick up`
            : "Empty — add this week's run"
      }
      back={
        <Link
          to="/"
          aria-label="Back to lists"
          className="inline-flex h-9 items-center gap-1.5 rounded-[10px] pr-2.5 text-[15px] font-medium text-fg-2"
        >
          <ChevronLeft className="size-3.5" strokeWidth={1.7} />
          Lists
        </Link>
      }
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="List actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>Edit list</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setManageUsuals(true)}>
              Edit usuals
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={usuals.isPending || missingUsuals.length === 0}
              onSelect={() => usuals.mutate()}
            >
              {missingUsuals.length
                ? `Add usuals (${missingUsuals.length})`
                : "Usuals already on the list"}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={clearBought.isPending || bought.length === 0}
              onSelect={() => clearBought.mutate()}
            >
              Clear bought
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={nextShop.isPending || (bought.length === 0 && missingUsuals.length === 0)}
              onSelect={() => nextShop.mutate()}
            >
              Next shop — add usuals
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem danger onSelect={() => setDeleteOpen(true)}>
              Delete list
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      rail={
        <UsualsTray
          usuals={trayUsuals}
          onAdd={(usual) => add.mutate({ name: usual.name, isStaple: true })}
          onAddRemaining={missingUsuals.length ? () => usuals.mutate() : undefined}
          remainingCount={missingUsuals.length}
          onEdit={setEditingUsual}
          onManage={() => setManageUsuals(true)}
          onDraggingChange={setDraggingUsual}
          busy={add.isPending || usuals.isPending}
          compact
          hint="Tap any time — leftover items on the list can stay."
        />
      }
      dock={<AddItemBar listId={listId} onAdd={(input) => add.mutate(input)} busy={add.isPending} />}
    >
      <div
        data-usuals-drop
        className={cn("min-h-32", draggingUsual && "rounded-lg")}
      >
        {items.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            image="/images/eggs.jpg"
            imageAlt="A carton of brown eggs"
            title="Nothing here yet"
            body={
              usualCatalog.length
                ? missingUsuals.length
                  ? "Tap a usual up top, or add this list's usuals. Leftovers can stay — you don't have to finish the list first."
                  : "Add this week's items. Usuals for other stores stay in their own trays."
                : "Add this week's items. Star anything you buy often — it lands in the tray next time."
            }
            action={
              missingUsuals.length ? (
                <Button onClick={() => usuals.mutate()} disabled={usuals.isPending}>
                  Add {missingUsuals.length} usual{missingUsuals.length === 1 ? "" : "s"}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="border-t border-hairline">
              {openItems.length ? (
                <p className="kicker py-3">
                  To buy · {openItems.length}
                </p>
              ) : null}
              {openItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onToggle={() => requestToggle(item)}
                  onStaple={() => staple.mutate(item)}
                  onDelete={() => remove.mutate(item.id)}
                />
              ))}
              {openItems.length === 0 ? (
                <div className="panel mt-2 px-5 py-6">
                  <p className="text-[22px] font-semibold tracking-[-0.02em]">Cart is clear</p>
                  <p className="mt-1 text-sm text-muted">Add usuals for the next run, or clear bought items</p>
                  <div className="mt-4 grid gap-2">
                    {usualCatalog.length > 0 ? (
                      <Button disabled={busyShop} onClick={() => nextShop.mutate()}>
                        Add usuals
                      </Button>
                    ) : null}
                    {bought.length > 0 ? (
                      <Button
                        variant="secondary"
                        disabled={busyShop}
                        onClick={() => clearBought.mutate()}
                      >
                        Clear bought
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
            {bought.length > 0 ? (
              <section className="mt-6">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="kicker">Bought · {bought.length}</h2>
                  <button
                    type="button"
                    className="text-[13.5px] font-medium text-muted"
                    disabled={clearBought.isPending}
                    onClick={() => clearBought.mutate()}
                  >
                    Clear
                  </button>
                </div>
                <div className="mt-1 border-t border-hairline">
                  {bought.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onToggle={() => requestToggle(item)}
                      onStaple={() => staple.mutate(item)}
                      onDelete={() => remove.mutate(item.id)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>

      <NewListDialog open={editOpen} onOpenChange={setEditOpen} list={list} />
      <ManageUsualsDialog
        open={manageUsuals}
        onOpenChange={setManageUsuals}
        usuals={usualCatalog}
        lists={lists}
        onSaved={invalidate}
      />
      <EditUsualDialog
        open={Boolean(editingUsual)}
        onOpenChange={(next) => {
          if (!next) setEditingUsual(null);
        }}
        usual={editingUsual}
        lists={lists}
        onSaved={invalidate}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${list.name}?`}
        description="Items on this list will be removed. Usuals stay in the catalog."
        confirmLabel="Delete list"
        danger
        busy={removeList.isPending}
        onConfirm={() => removeList.mutate()}
      />
    </AppShell>
  );
}
