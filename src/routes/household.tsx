import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { AlertsCard } from "@/components/push-opt-in";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  leaveHousehold,
  regenerateInviteCode,
  renameHousehold,
} from "@/lib/server/household";
import type { Overview } from "@/lib/types";
import { cn } from "@/lib/utils";

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
    <AppShell
      title={overview.household.name}
      eyebrow="Household"
      stat={`${overview.members.length} member${overview.members.length === 1 ? "" : "s"} sharing lists and pantry.`}
    >
      <section>
        <p className="kicker">Invite code</p>
        <div className="mt-2.5 border-t border-hairline pt-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => void copyCode()}
              className="text-left text-2xl font-semibold tracking-[0.1em] tabular-nums"
            >
              {overview.household.inviteCode}
            </button>
            <Button variant="ghost" size="icon-sm" onClick={() => void copyCode()} aria-label="Copy invite code">
              <Copy className="size-4" />
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3">
            <p className="text-[13px] text-muted">Anyone with this code can join</p>
            {overview.household.role === "owner" ? (
              <button
                type="button"
                className="text-[13.5px] font-semibold text-accent"
                onClick={() => refresh.mutate()}
                disabled={refresh.isPending}
              >
                New code
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-7">
        <p className="kicker">Members</p>
        <ul className="mt-2.5 border-t border-hairline">
          {overview.members.map((member) => (
            <li key={member.userId} className="flex h-16 items-center gap-3.5 border-b border-hairline">
              {member.imageUrl ? (
                <img
                  src={member.imageUrl}
                  alt=""
                  className="size-9 rounded-full object-cover"
                />
              ) : (
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-full text-sm font-semibold",
                    member.role === "owner" ? "bg-fg text-primary-fg" : "bg-fill-quiet text-fg",
                  )}
                >
                  {member.displayName.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium tracking-[-0.012em]">
                  {member.displayName}
                  {member.isYou ? " (you)" : ""}
                </p>
                <p className="text-[13px] text-muted">{member.role === "owner" ? "Owner" : "Member"}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <form
        className="mt-7"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          rename.mutate(name.trim());
        }}
      >
        <p className="kicker">Household name</p>
        <div className="mt-2.5 flex gap-2">
          <Input
            id="hh-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" disabled={rename.isPending || !name.trim()}>
            Save
          </Button>
        </div>
      </form>

      <AlertsCard />

      <button
        type="button"
        className="mt-8 text-[13.5px] font-medium text-danger"
        onClick={() => {
          if (window.confirm("Leave this household? Lists stay with whoever remains.")) {
            leave.mutate();
          }
        }}
      >
        Leave household
      </button>
    </AppShell>
  );
}
