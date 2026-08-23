import { useState } from "react";
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
import { listColor, listIcon, LIST_COLOR_CLASS } from "@/lib/icons";
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
import type { ListDetail, ListItem } from "@/lib/types";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
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
      {() => <ListBody listId={id} />}
    </AuthGate>
  );
}

function ListBody({ listId }: { listId: number }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draggingUsual, setDraggingUsual] = useState(false);
  const queryKey = ["list", listId] as const;

  const detail = useQuery({
    queryKey,
    queryFn: () => getListDetail({ data: { listId } }),
    refetchInterval: 8_000,
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
      toast.success(result.added ? `Added ${result.added} usuals` : "Usuals already on the list");
      await invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const clearBought = useMutation({
    mutationFn: () => clearCheckedItems({ data: { listId } }),
    onSuccess: async (result) => {
      toast.success(
        result.cleared
          ? `Cleared ${result.cleared}. Usuals stay ready for next week.`
          : "Nothing checked yet",
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
  const Icon = listIcon(list.icon);
  const color = listColor(list.color);
  const openItems = items.filter((item) => !item.checked);
  const bought = items.filter((item) => item.checked);

  return (
    <AppShell
      eyebrow="Shopping list"
      title={list.name}
      stat={
        openItems.length
          ? `${openItems.length} to buy${bought.length ? ` · ${bought.length} in the cart` : ""}`
          : items.length
            ? "All checked"
            : "Empty — add this week's run"
      }
      back={
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/"
            aria-label="Back to lists"
            className="civic-link inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
          >
            <ChevronLeft className="size-4" />
            Lists
          </Link>
          <div
            className={`grid size-8 place-items-center rounded-full text-primary-fg ${LIST_COLOR_CLASS[color]}`}
            aria-hidden="true"
          >
            <Icon className="size-4" />
          </div>
        </div>
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
            <DropdownMenuItem
              disabled={clearBought.isPending || bought.length === 0}
              onSelect={() => clearBought.mutate()}
            >
              Clear bought
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem danger onSelect={() => setDeleteOpen(true)}>
              Delete list
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      dock={
        <>
          <UsualsTray
            usuals={usualCatalog}
            onAdd={(name) => add.mutate({ name, isStaple: true })}
            onAddRemaining={() => usuals.mutate()}
            onDraggingChange={setDraggingUsual}
            busy={add.isPending || usuals.isPending}
          />
          <AddItemBar listId={listId} onAdd={(input) => add.mutate(input)} busy={add.isPending} />
        </>
      }
    >
      <div
        data-usuals-drop
        className={cn("min-h-32", draggingUsual && "rounded-lg")}
      >
        {items.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Nothing here yet"
            body={
              usualCatalog.length
                ? "Tap a usual in the tray, or drag it onto the list. You do not have to take all of them this week."
                : "Add this week's items. Star anything you buy often — it lands in the tray next time."
            }
          />
        ) : (
          <>
            <div className="panel px-3 py-1">
              {openItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onToggle={() => toggle.mutate({ itemId: item.id, checked: !item.checked })}
                  onStaple={() => staple.mutate(item)}
                  onDelete={() => remove.mutate(item.id)}
                />
              ))}
              {openItems.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted">Cart is clear. Nice.</p>
              ) : null}
            </div>
            {bought.length > 0 ? (
              <section className="mt-6">
                <h2 className="px-1 text-xs font-medium tracking-[0.16em] text-muted uppercase">
                  Bought
                </h2>
                <div className="panel mt-2 px-3 py-1">
                  {bought.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onToggle={() => toggle.mutate({ itemId: item.id, checked: !item.checked })}
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
