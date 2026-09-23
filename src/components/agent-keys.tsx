import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createAgentKey, listAgentKeys, revokeAgentKey } from "@/lib/server/agent-keys";
import { Button } from "@/components/ui/button";

export function AgentKeysPanel() {
  const queryClient = useQueryClient();
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const keys = useQuery({
    queryKey: ["agent-keys"],
    queryFn: () => listAgentKeys(),
  });

  const create = useMutation({
    mutationFn: () => createAgentKey({ data: { label: "Assistant" } }),
    onSuccess: async (result) => {
      setFreshKey(result.rawKey);
      await queryClient.invalidateQueries({ queryKey: ["agent-keys"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revoke = useMutation({
    mutationFn: (keyId: number) => revokeAgentKey({ data: { keyId } }),
    onSuccess: async () => {
      toast.success("Key revoked");
      await queryClient.invalidateQueries({ queryKey: ["agent-keys"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const active = (keys.data ?? []).filter((key) => !key.revokedAt);

  async function copyKey() {
    if (!freshKey) return;
    try {
      await navigator.clipboard.writeText(freshKey);
      toast.success("Key copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <section className="mt-7" id="agent-keys">
      <p className="kicker">Agent API keys</p>
      <div className="mt-2.5 border-t border-hairline py-4">
        <p className="text-[13px] text-muted">
          A key lets an assistant read and update this household’s lists, pantry, and filters. It
          cannot change who is in the household. Stocked stores only a hash.
        </p>
        {freshKey ? (
          <div className="mt-3 border border-hairline bg-fill-quiet p-3">
            <p className="text-[13px] font-medium">Copy this key now. It won’t be shown again.</p>
            <p className="mt-2 break-all font-mono text-[13px] leading-5">{freshKey}</p>
            <div className="mt-3 flex gap-2">
              <Button type="button" size="sm" onClick={() => void copyKey()}>
                Copy key
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setFreshKey(null)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            className="mt-3"
            disabled={create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Generating…" : "Generate key"}
          </Button>
        )}
        {active.length > 0 ? (
          <ul className="mt-4 divide-y divide-hairline border-t border-hairline">
            {active.map((key) => (
              <li key={key.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium">{key.label}</span>
                  <span className="block font-mono text-[12px] text-muted">{key.prefix}…</span>
                </span>
                <button
                  type="button"
                  className="text-[13px] font-medium text-danger"
                  disabled={revoke.isPending}
                  onClick={() => {
                    if (window.confirm("Revoke this key? Anything using it will stop working.")) {
                      revoke.mutate(key.id);
                    }
                  }}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
