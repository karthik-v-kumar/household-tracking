import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  leaveHousehold,
  regenerateInviteCode,
  renameHousehold,
} from "@/lib/server/household";
import type { Overview } from "@/lib/types";

export const Route = createFileRoute("/household")({ component: HouseholdPage });

function HouseholdPage() {
  return (
    <AuthGate>
      {(overview) => <HouseholdBody overview={overview} />}
    </AuthGate>
  );
}

function HouseholdBody({ overview }: { overview: Overview }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(overview.household.name);

  const rename = useMutation({
    mutationFn: (value: string) => renameHousehold({ data: { name: value } }),
    onSuccess: async () => {
      toast.success("Household renamed");
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const refresh = useMutation({
    mutationFn: () => regenerateInviteCode(),
    onSuccess: async () => {
      toast.success("New invite code");
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const leave = useMutation({
    mutationFn: () => leaveHousehold(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success("Left household");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(overview.household.inviteCode);
      toast.success("Invite code copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <AppShell title={overview.household.name} eyebrow="Household">
      <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-xl font-medium tracking-tight">Invite</h2>
        <p className="mt-1 text-sm text-muted">
          Share this code. After they sign in, they join and see the same lists and pantry.
        </p>
        <button
          type="button"
          onClick={() => void copyCode()}
          className="mt-4 flex w-full items-center justify-between rounded-lg bg-bg-elevated px-4 py-3 text-left"
        >
          <span className="font-display text-2xl tracking-[0.18em]">
            {overview.household.inviteCode}
          </span>
          <Copy className="size-4 text-muted" />
        </button>
        {overview.household.role === "owner" ? (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
          >
            <RefreshCw className="size-3.5" />
            New code
          </Button>
        ) : null}
      </section>

      <section className="mt-4 rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-xl font-medium tracking-tight">People</h2>
        <ul className="mt-3 divide-y divide-border">
          {overview.members.map((member) => (
            <li key={member.userId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              {member.imageUrl ? (
                <img
                  src={member.imageUrl}
                  alt=""
                  className="size-10 rounded-full object-cover outline outline-1 -outline-offset-1 outline-fg/10"
                />
              ) : (
                <span className="grid size-10 place-items-center rounded-full bg-primary/10 font-medium text-primary">
                  {member.displayName.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {member.displayName}
                  {member.isYou ? " (you)" : ""}
                </p>
                <p className="text-xs text-muted capitalize">{member.role}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <form
        className="mt-4 rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          rename.mutate(name.trim());
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="hh-name">Household name</Label>
          <Input
            id="hh-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button type="submit" className="mt-3" disabled={rename.isPending || !name.trim()}>
          Save name
        </Button>
      </form>

      <Button
        variant="ghost"
        className="mt-6 w-full text-danger"
        onClick={() => {
          if (window.confirm("Leave this household? Lists stay with whoever remains.")) {
            leave.mutate();
          }
        }}
      >
        Leave household
      </Button>
    </AppShell>
  );
}
