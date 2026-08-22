import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus } from "lucide-react";
import { toast } from "sonner";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { ListCard } from "@/components/list-card";
import { LoginPending, LoginScreen } from "@/components/login-screen";
import { NewListDialog } from "@/components/new-list-dialog";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { addLowInventoryToLists } from "@/lib/server/inventory";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <LoginPending />;
  if (!user) return <LoginScreen />;
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
  const queryClient = useQueryClient();
  const low = overview.lowInventory;
  const addLow = useMutation({
    mutationFn: () => addLowInventoryToLists({ data: {} }),
    onSuccess: async (result) => {
      toast.success(result.added ? `Added ${result.added} to lists` : "Already on a list");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      ]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remaining = overview.lists.reduce((sum, list) => sum + list.uncheckedCount, 0);

  return (
    <AppShell
      eyebrow={overview.household.name}
      title="This weekend"
      actions={
        <Button size="icon-sm" onClick={() => setNewOpen(true)} aria-label="New list">
          <Plus className="size-4" />
        </Button>
      }
    >
      <p className="mb-5 text-sm text-muted">
        {remaining === 0
          ? "Nothing on the lists yet. Add usuals, or drop in what you noticed running low."
          : `${remaining} item${remaining === 1 ? "" : "s"} still to pick up.`}
      </p>

      {low.length > 0 ? (
        <section className="mb-5 rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-medium tracking-tight">Running low</h2>
              <p className="mt-0.5 text-sm text-muted">
                {low.map((item) => item.name).join(", ")}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={addLow.isPending || low.every((i) => i.onAList)}
              onClick={() => addLow.mutate()}
            >
              Add to lists
            </Button>
          </div>
        </section>
      ) : null}

      {overview.lists.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No lists yet"
          body="Make one per store so you are not hunting through a single giant reminder."
          action={
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="size-4" />
              New list
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {overview.lists.map((list) => (
            <ListCard key={list.id} list={list} />
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-subtle">
        Shared with{" "}
        {overview.members.map((m) => (m.isYou ? "you" : m.displayName)).join(" and ")}.{" "}
        <Link to="/household" className="underline underline-offset-2">
          Invite
        </Link>
      </p>

      <NewListDialog open={newOpen} onOpenChange={setNewOpen} />
    </AppShell>
  );
}
