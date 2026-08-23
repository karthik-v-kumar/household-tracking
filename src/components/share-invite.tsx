import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import type { Overview } from "@/lib/types";

export function ShareInviteBanner({ overview }: { overview: Overview }) {
  const [copied, setCopied] = useState(false);
  if (overview.members.length > 1) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(overview.household.inviteCode);
      setCopied(true);
      toast.success("Invite code copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <div className="panel mb-4 p-4">
      <p className="font-display text-base font-medium tracking-tight">Just you so far</p>
      <p className="mt-1 text-sm text-muted">
        Lists only sync with people in this household. Send the code — if they
        already made their own, they need to leave it first, then join yours.
      </p>
      <button
        type="button"
        onClick={() => void copy()}
        className="mt-3 flex w-full items-center justify-between rounded-md border border-border bg-bg-elevated px-4 py-3 text-left"
      >
        <span className="font-display text-xl tracking-widest">
          {overview.household.inviteCode}
        </span>
        <Copy className="size-4 text-muted" />
      </button>
      <p className="mt-2 text-xs text-subtle">
        {copied ? "Copied. " : ""}
        <Link to="/household" className="underline-offset-2 hover:underline">
          Household
        </Link>
      </p>
    </div>
  );
}
