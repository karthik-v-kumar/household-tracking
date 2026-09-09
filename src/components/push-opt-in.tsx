import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import {
  deletePushSubscription,
  getPushPublicKey,
  savePushSubscription,
} from "@/lib/server/push";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

async function getRegistration() {
  return navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
}

async function subscribeAndSave() {
  const registration = await getRegistration();
  await navigator.serviceWorker.ready;
  const { publicKey } = await getPushPublicKey();
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error("Could not subscribe for alerts");
  }
  await savePushSubscription({
    data: {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    },
  });
}

async function unsubscribeAndForget() {
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await deletePushSubscription({ data: { endpoint: subscription.endpoint } }).catch(() => undefined);
    await subscription.unsubscribe();
  }
}

export function PushRegistrar() {
  useEffect(() => {
    if (!pushSupported()) return;
    if (Notification.permission !== "granted") return;
    void subscribeAndSave().catch(() => undefined);
  }, []);
  return null;
}

export function PushSettingsItem() {
  const [status, setStatus] = useState<"loading" | "off" | "on" | "blocked" | "browser" | "unsupported">(
    "loading",
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) {
      setStatus(isStandalone() ? "unsupported" : "browser");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("blocked");
      return;
    }
    void (async () => {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await registration?.pushManager.getSubscription();
      setStatus(Notification.permission === "granted" && sub ? "on" : "off");
    })();
  }, []);

  async function enable() {
    if (!pushSupported()) {
      toast.message("Add Stocked to your Home Screen, then turn on alerts.");
      return;
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "off");
        toast.message("Alerts stayed off");
        return;
      }
      await subscribeAndSave();
      setStatus("on");
      toast.success("You’ll get a ping when someone adds to a list");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not enable alerts");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      await unsubscribeAndForget();
      setStatus("off");
      toast.message("List alerts off");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not turn alerts off");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") return null;

  if (status === "browser" || status === "unsupported") {
    return (
      <DropdownMenuItem
        className="h-auto items-start gap-2.5 py-2"
        onSelect={() => toast.message("Add Stocked to your Home Screen, then open it from there to turn on alerts.")}
      >
        <BellOff className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0">
          <span className="block">List alerts</span>
          <span className="block text-xs text-muted">Needs the Home Screen app on iPhone</span>
        </span>
      </DropdownMenuItem>
    );
  }

  if (status === "blocked") {
    return (
      <DropdownMenuItem disabled className="h-auto items-start gap-2.5 py-2">
        <BellOff className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0">
          <span className="block">List alerts blocked</span>
          <span className="block text-xs text-muted">Allow notifications in iPhone Settings</span>
        </span>
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem
      disabled={busy}
      className="h-auto items-start gap-2.5 py-2"
      onSelect={(event) => {
        event.preventDefault();
        if (status === "on") void disable();
        else void enable();
      }}
    >
      {status === "on" ? (
        <Bell className="mt-0.5 size-4 shrink-0" />
      ) : (
        <BellOff className="mt-0.5 size-4 shrink-0" />
      )}
      <span className="min-w-0">
        <span className="block">{status === "on" ? "List alerts on" : "Notify on new items"}</span>
        <span className="block text-xs text-muted">
          {status === "on" ? "Ping when someone adds to a list" : "Turn on for this iPhone"}
        </span>
      </span>
    </DropdownMenuItem>
  );
}
