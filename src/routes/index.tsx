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
import { NewListDialog } from "@/components/new-list-dialog";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { addLowInventoryToLists } from "@/lib/server/inventory";
import { deleteList } from "@/lib/server/lists";
import { addNeededUpkeepToLists } from "@/lib/server/upkeep";
import { formatUpkeepDue } from "@/lib/upkeep-logic";
import { INVENTORY_LEVELS } from "@/lib/constants";
import type { ShoppingList } from "@/lib/types";

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
  const low = overview.lowInventory.filter((item) => !item.onAList);
  const due = (overview.dueUpkeep ?? []).filter((item) => !item.onAList);
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

  const remaining = overview.lists.reduce((sum, list) => sum + list.uncheckedCount, 0);

  return (
    <AppShell
      eyebrow={overview.household.name}
      title="This weekend"
      stat={
        remaining === 0
          ? "Nothing on the lists yet"
          : `${remaining} item${remaining === 1 ? "" : "s"} still to pick up`
      }
      actions={
        <Button size="icon-sm" onClick={() => { setEditing(null); setNewOpen(true); }} aria-label="New list">
          <Plus className="size-4" />
        </Button>
      }
    >
      <ShareInviteBanner overview={overview} />
      {low.length > 0 ? (
        <div className="mb-5 grid gap-2.5">
          {low.map((item) => {
            const level = INVENTORY_LEVELS.find((row) => row.id === item.effectiveLevel)?.label ?? item.effectiveLevel;
            return (
              <NeedRow
                key={item.id}
                name={`${item.name} is running ${level.toLowerCase()}`}
                detail={item.defaultListName ? `Usually bought at ${item.defaultListName}` : undefined}
                busy={addLow.isPending && addLow.variables?.[0] === item.id}
                onAdd={() => addLow.mutate([item.id])}
              />
            );
          })}
        </div>
      ) : null}

      {due.length > 0 ? (
        <div className="mb-5 grid gap-2.5">
          {due.map((item) => (
            <NeedRow
              key={item.id}
              name={item.name}
              detail={[formatUpkeepDue(item.daysUntil), item.defaultListName].filter(Boolean).join(" · ")}
              canAdd={item.needToBuy}
              busy={addFilters.isPending && addFilters.variables?.[0] === item.id}
              onAdd={() => addFilters.mutate([item.id])}
            />
          ))}
        </div>
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
        <div>
          <div className="flex items-baseline justify-between">
            <p className="kicker">
              {overview.lists.length} list{overview.lists.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="mt-2.5 border-t border-hairline">
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
          </div>
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
  canAdd = true,
  busy,
  onAdd,
}: {
  name: string;
  detail?: string;
  canAdd?: boolean;
  busy?: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="nudge">
      <span className="size-1.5 shrink-0 rounded-full bg-accent" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-tight">{name}</p>
        {detail ? <p className="truncate text-[12.5px] text-muted">{detail}</p> : null}
      </div>
      {canAdd ? (
        <Button size="sm" variant="accent" disabled={busy} onClick={onAdd}>
          Add
        </Button>
      ) : (
        <span className="shrink-0 text-[13px] text-muted">Not yet</span>
      )}
    </div>
  );
}
