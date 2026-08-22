import type { ReactNode } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useQuery } from "@tanstack/react-query";
import { getOverview } from "@/lib/server/household";
import { isUnauthorized } from "@/lib/utils";
import { HouseholdSetup } from "@/components/household-setup";
import { Skeleton } from "@/components/ui/skeleton";
import type { Overview } from "@/lib/types";

export function useOverviewQuery() {
  const { user, isPending } = useCurrentUserState();
  return useQuery({
    queryKey: ["overview"],
    queryFn: () => getOverview(),
    enabled: Boolean(user) && !isPending,
    refetchInterval: 12_000,
  });
}

export function AuthGate({ children }: { children: (overview: Overview) => ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const overview = useOverviewQuery();

  if (isPending) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-5 py-10">
        <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">Household lists</p>
        <h1 className="font-display text-4xl font-medium tracking-tight">Stocked</h1>
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;

  if (overview.isLoading) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-5 py-10">
        <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">Household lists</p>
        <h1 className="font-display text-4xl font-medium tracking-tight">Stocked</h1>
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    );
  }

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
