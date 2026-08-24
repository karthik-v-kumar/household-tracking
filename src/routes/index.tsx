import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus } from "lucide-react";
import { toast } from "sonner";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { ListCard, NewListCard } from "@/components/list-card";
import { LoginPending } from "@/components/login-screen";
import { LandingPage } from "@/components/landing-page";
import { ShareInviteBanner } from "@/components/share-invite";
import { UsualsTray } from "@/components/usuals-tray";
import { NewListDialog } from "@/components/new-list-dialog";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { addLowInventoryToLists } from "@/lib/server/inventory";
import { addListItem, deleteList } from "@/lib/server/lists";
import { addNeededUpkeepToLists } from "@/lib/server/upkeep";
import { formatUpkeepDue } from "@/lib/upkeep-logic";
import { INVENTORY_LEVELS } from "@/lib/constants";
import type { ShoppingList, Usual } from "@/lib/types";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <LoginPending />;
  if (!user) return <LandingPage />;
  return (
    <AuthGate>
      {(overview) => <HomeContent overview={overview} />}
    </AuthGate>
  );
}

function HomeContent({
  overview,
}: {
  overview: import("@/lib/types").Overview;
}) {
  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<ShoppingList | null>(null);
  const [deleting, setDeleting] = useState<ShoppingList | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const low = overview.lowInventory;
  const due = overview.dueUpkeep ?? [];
  const addLow = useMutation({
    mutationFn: (itemIds?: number[]) => addLowInventoryToLists({ data: { itemIds } }),
    onSuccess: async (result) => {
      toast.success(result.added ? `Added ${result.added} to a list` : "Already on a list");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      ]);
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const addFilters = useMutation({
    mutationFn: (itemIds?: number[]) => addNeededUpkeepToLists({ data: { itemIds } }),
    onSuccess: async (result) => {
      toast.success(result.added ? `Added ${result.added} to a list` : "Already on a list");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
        queryClient.invalidateQueries({ queryKey: ["upkeep"] }),
      ]);
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const removeList = useMutation({
    mutationFn: (listId: number) => deleteList({ data: { listId } }),
    onSuccess: async () => {
      toast.success("List deleted");
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const addUsual = useMutation({
    mutationFn: (usual: Usual) => {
      const listId = usual.defaultListId ?? overview.lists[0]?.id;
      if (!listId) throw new Error("Create a list first.");
      return addListItem({ data: { listId, name: usual.name, isStaple: true } });
    },
    onSuccess: async (result, usual) => {
      const listName =
        usual.defaultListName ?? overview.lists.find((list) => list.id === usual.defaultListId)?.name ?? overview.lists[0]?.name;
      if (result.already) toast.message(`Already on ${listName ?? "the list"}`);
      else toast.success(`Added to ${listName ?? "the list"}`);
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const addAllUsuals = useMutation({
    mutationFn: async () => {
      const fallback = overview.lists[0]?.id;
      if (!fallback) throw new Error("Create a list first.");
      let added = 0;
      for (const usual of overview.usuals) {
        if (usual.alreadyOnList) continue;
        const listId = usual.defaultListId ?? fallback;
        const result = await addListItem({ data: { listId, name: usual.name, isStaple: true } });
        if (!result.already) added += 1;
      }
      return { added };
    },
    onSuccess: async (result) => {
      toast.success(result.added ? `Added ${result.added} usual${result.added === 1 ? "" : "s"}` : "Usuals already on lists");
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remaining = overview.lists.reduce((sum, list) => sum + list.uncheckedCount, 0);
  const missingUsuals = (overview.usuals ?? []).filter((item) => !item.alreadyOnList);

  return (
    <AppShell
      eyebrow={overview.household.name}
      title="This weekend"
      stat={
        remaining === 0
          ? "Nothing on the lists yet."
          : `${remaining} item${remaining === 1 ? "" : "s"} still to pick up.`
      }
      actions={
        <Button size="icon-sm" onClick={() => { setEditing(null); setNewOpen(true); }} aria-label="New list">
          <Plus className="size-4" />
        </Button>
      }
      rail={
        <UsualsTray
          usuals={overview.usuals ?? []}
          onAdd={(usual) => addUsual.mutate(usual)}
          onAddRemaining={missingUsuals.length && overview.lists.length ? () => addAllUsuals.mutate() : undefined}
          remainingCount={missingUsuals.length}
          busy={addUsual.isPending || addAllUsuals.isPending}
          compact
          hint="Add whenever — leftover items can sit on a list until you're ready."
        />
      }
    >
      <ShareInviteBanner overview={overview} />
      {low.length > 0 ? (
        <section className="panel mb-4 px-4 py-3">
          <h2 className="font-display text-base font-medium tracking-tight">Running low</h2>
          <p className="mt-0.5 text-xs text-muted">Add only what you actually want this week.</p>
          <ul className="mt-2 divide-y divide-border">
            {low.map((item) => {
              const level = INVENTORY_LEVELS.find((row) => row.id === item.effectiveLevel)?.label ?? item.effectiveLevel;
              return (
                <li key={item.id}>
                  <NeedRow
                    name={item.name}
                    detail={[level, item.defaultListName].filter(Boolean).join(" · ")}
                    onAList={item.onAList}
                    busy={addLow.isPending && addLow.variables?.[0] === item.id}
                    onAdd={() => addLow.mutate([item.id])}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {due.length > 0 ? (
        <section className="panel mb-4 px-4 py-3">
          <h2 className="font-display text-base font-medium tracking-tight">Filters</h2>
          <p className="mt-0.5 text-xs text-muted">Add the ones you want to pick up now.</p>
          <ul className="mt-2 divide-y divide-border">
            {due.map((item) => (
              <li key={item.id}>
                <NeedRow
                  name={item.name}
                  detail={[formatUpkeepDue(item.daysUntil), item.defaultListName].filter(Boolean).join(" · ")}
                  onAList={item.onAList}
                  canAdd={item.needToBuy}
                  busy={addFilters.isPending && addFilters.variables?.[0] === item.id}
                  onAdd={() => addFilters.mutate([item.id])}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {overview.lists.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          image="/images/produce.jpg"
          imageAlt="Produce and eggs"
          title="No lists yet"
          body="Make one per store so you are not hunting through a single giant reminder."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setNewOpen(true);
              }}
            >
              <Plus className="size-4" />
              New list
            </Button>
          }
        />
      ) : (
        <div className="grid gap-2.5">
          {overview.lists.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              onEdit={() => {
                setNewOpen(false);
                setEditing(list);
              }}
              onDelete={() => setDeleting(list)}
            />
          ))}
          <NewListCard
            onClick={() => {
              setEditing(null);
              setNewOpen(true);
            }}
          />
        </div>
      )}

      <p className="mt-6 text-center text-xs text-subtle">
        Shared with{" "}
        {overview.members.map((m) => (m.isYou ? "you" : m.displayName)).join(" and ")}.{" "}
        <Link to="/household" className="civic-link">
          Invite
        </Link>
      </p>

      <NewListDialog
        open={newOpen || Boolean(editing)}
        list={editing}
        onOpenChange={(open) => {
          if (!open) {
            setNewOpen(false);
            setEditing(null);
          }
        }}
        onCreated={(id) => {
          void navigate({ to: "/lists/$listId", params: { listId: String(id) } });
        }}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={deleting ? `Delete ${deleting.name}?` : "Delete list?"}
        description="Items on this list will be removed. Usuals stay in the catalog so you can add them somewhere else."
        confirmLabel="Delete list"
        danger
        busy={removeList.isPending}
        onConfirm={() => deleting && removeList.mutate(deleting.id)}
      />
    </AppShell>
  );
}

function NeedRow({
  name,
  detail,
  onAList,
  canAdd = true,
  busy,
  onAdd,
}: {
  name: string;
  detail?: string;
  onAList: boolean;
  canAdd?: boolean;
  busy?: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="flex min-h-12 items-center gap-3 py-1">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{name}</p>
        {detail ? <p className="truncate text-xs text-muted">{detail}</p> : null}
      </div>
      {onAList ? (
        <span className="shrink-0 text-xs text-muted">On a list</span>
      ) : canAdd ? (
        <Button size="sm" variant="secondary" disabled={busy} onClick={onAdd}>
          Add
        </Button>
      ) : (
        <span className="shrink-0 text-xs text-muted">Not yet</span>
      )}
    </div>
  );
}
