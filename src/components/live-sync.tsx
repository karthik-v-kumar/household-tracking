import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { getHouseholdPulse } from "@/lib/server/household";

function useDocumentHidden() {
  const [hidden, setHidden] = useState(
    () => typeof document !== "undefined" && document.hidden,
  );
  useEffect(() => {
    const sync = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pageshow", sync);
    window.addEventListener("focus", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pageshow", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);
  return hidden;
}

/** Pulls the other phone's writes within a couple of seconds while the app is open. */
export function LiveSync() {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const hidden = useDocumentHidden();
  const lastPulse = useRef<string | null>(null);

  const pulse = useQuery({
    queryKey: ["pulse"],
    queryFn: () => getHouseholdPulse(),
    enabled: Boolean(user),
    staleTime: 0,
    refetchInterval: hidden ? false : 2_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });

  useEffect(() => {
    if (!hidden) void queryClient.invalidateQueries({ queryKey: ["pulse"] });
  }, [hidden, queryClient]);

  useEffect(() => {
    const next = pulse.data?.pulse ?? null;
    if (next && lastPulse.current && next !== lastPulse.current) {
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== "pulse",
      });
    }
    if (next) lastPulse.current = next;
  }, [pulse.data?.pulse, queryClient]);

  return null;
}
