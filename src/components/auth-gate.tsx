import type { ReactNode } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useQuery } from "@tanstack/react-query";
import { getOverview } from "@/lib/server/household";
import { isUnauthorized } from "@/lib/utils";
import { HouseholdSetup } from "@/components/household-setup";
import type { Overview } from "@/lib/types";

export function useOverviewQuery() {
  const { user, isPending } = useCurrentUserState();
  return useQuery({
    queryKey: ["overview"],
    queryFn: () => getOverview(),
    enabled: Boolean(user) && !isPending,
  });
}

function LoadingShell() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-6 py-12">
      <p className="wordmark w-fit">Stocked</p>
      <h1 className="mt-6 font-display text-5xl tracking-tight">Loading…</h1>
      <div className="panel h-28 animate-pulse" />
      <div className="panel h-28 animate-pulse" />
    </div>
  );
}

export function AuthGate({ children }: { children: (overview: Overview) => ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const overview = useOverviewQuery();

  if (isPending) return <LoadingShell />;
  if (!user) return <RedirectToSignIn />;
  if (overview.isLoading) return <LoadingShell />;

  if (overview.error && isUnauthorized(overview.error)) return <RedirectToSignIn />;
  if (overview.error) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <p className="text-sm text-muted">
          {overview.error instanceof Error ? overview.error.message : "Could not load household."}
        </p>
      </div>
    );
  }

  if (!overview.data) return <HouseholdSetup />;
  return <>{children(overview.data)}</>;
}
