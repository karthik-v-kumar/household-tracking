import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, MoreHorizontal, RotateCcw, Star } from "lucide-react";
import { toast } from "sonner";
import { AuthGate } from "@/components/auth-gate";
import { AddItemBar } from "@/components/add-item-bar";
import { EmptyState } from "@/components/empty-state";
import { ItemRow } from "@/components/item-row";
import { NewListDialog } from "@/components/new-list-dialog";
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
import { isUnauthorized } from "@/lib/utils";
import { ShoppingCart } from "lucide-react";

export const Route = createFileRoute("/lists/$listId")({ component: ListPage });

function ListPage() {
  const { listId } = Route.useParams();
  const id = Number(listId);
  const { user, isPending } = useCurrentUserState();

  if (isPending) return <div className="min-h-dvh bg-bg" />;
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
    onSuccess: async (result) => {
      if (result.already) toast.message("Already on the list");
      await invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
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
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
      void navigate({ to: "/" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (detail.error && isUnauthorized(detail.error)) return <RedirectToSignIn />;
  if (detail.isLoading || !detail.data) {
    return <div className="min-h-dvh bg-bg" />;
  }

  const { list, items, usuals: usualCatalog } = detail.data;
  const Icon = listIcon(list.icon);
  const color = listColor(list.color);
  const openItems = items.filter((item) => !item.checked);
  const bought = items.filter((item) => item.checked);
  const missingUsuals = usualCatalog.filter((item) => !item.alreadyOnList).length;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-bg pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-bg/90 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-sm">
        <div className="flex items-center gap-1">
          <Link
            to="/"
            className="grid size-11 place-items-center rounded-sm text-fg hover:bg-fg/5"
            aria-label="Back to lists"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <div
            className={`grid size-10 place-items-center rounded-md text-primary-fg ${LIST_COLOR_CLASS[color]}`}
          >
            <Icon className="size-4" />
          </div>
          <div className="min-w-0 flex-1 px-2">
            <h1 className="truncate font-display text-2xl leading-none font-medium tracking-tight">
              {list.name}
            </h1>
            <p className="mt-1 text-xs text-muted">
              {openItems.length} to buy
              {bought.length ? ` · ${bought.length} in the cart` : ""}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="grid size-11 place-items-center rounded-sm text-muted hover:bg-fg/5 hover:text-fg"
                aria-label="List actions"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>Edit list</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem danger onSelect={() => removeList.mutate()}>
                Delete list
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-3 flex gap-2 px-1">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            disabled={usuals.isPending || missingUsuals === 0}
            onClick={() => usuals.mutate()}
          >
            <Star className="size-3.5" />
            {missingUsuals ? `Add usuals (${missingUsuals})` : "Usuals added"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={clearBought.isPending || bought.length === 0}
            onClick={() => clearBought.mutate()}
          >
            <RotateCcw className="size-3.5" />
            Clear bought
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4 py-3">
        {items.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Nothing here yet"
            body="Add this week's items. Star anything you buy every weekend so it comes back with one tap."
          />
        ) : (
          <>
            <div>
              {openItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onToggle={() => toggle.mutate({ itemId: item.id, checked: !item.checked })}
                  onStaple={() => staple.mutate(item)}
                  onDelete={() => remove.mutate(item.id)}
                />
              ))}
            </div>
            {bought.length > 0 ? (
              <section className="mt-6">
                <h2 className="px-1 text-xs font-medium tracking-[0.16em] text-muted uppercase">
                  Bought
                </h2>
                <div className="mt-1">
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
      </main>

      <div
        className="fixed inset-x-0 bottom-0 z-30 px-4 pt-2"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-lg">
          <AddItemBar listId={listId} onAdd={(input) => add.mutate(input)} busy={add.isPending} />
        </div>
      </div>

      <NewListDialog open={editOpen} onOpenChange={setEditOpen} list={list} />
    </div>
  );
}
