import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
  const lastNotice = useRef<number | null>(null);

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
    if (!hidden) {
      void queryClient.invalidateQueries({ queryKey: ["pulse"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["upkeep"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
    }
  }, [hidden, queryClient]);

  useEffect(() => {
    const next = pulse.data?.pulse ?? null;
    if (next && lastPulse.current && next !== lastPulse.current) {
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["upkeep"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      void queryClient.invalidateQueries({ queryKey: ["list"] });
      void queryClient.invalidateQueries({ queryKey: ["catalog"] });
    }
    if (next) lastPulse.current = next;
  }, [pulse.data?.pulse, queryClient]);

  useEffect(() => {
    const notice = pulse.data?.notice;
    if (!notice?.id || !user) return;
    if (lastNotice.current == null) {
      lastNotice.current = notice.id;
      return;
    }
    if (notice.id === lastNotice.current) return;
    lastNotice.current = notice.id;
    if (notice.actorUserId === user.id) return;
    toast(notice.body, { description: notice.title });
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted" &&
      typeof document !== "undefined" &&
      document.hidden
    ) {
      try {
        new Notification(notice.title, { body: notice.body, icon: "/icon-192.png" });
      } catch {
        // Safari / iOS may ignore page notifications outside a Home Screen app.
      }
    }
  }, [pulse.data?.notice, user]);

  return null;
}
