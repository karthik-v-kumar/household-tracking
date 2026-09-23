import { createHash, randomBytes } from "node:crypto";
import type { Sql } from "@/lib/db";

export type AgentPrincipal = {
  keyId: number;
  householdId: number;
  userId: string;
  canWrite: boolean;
};

export function generateAgentKey(): string {
  return `stk_${randomBytes(32).toString("base64url")}`;
}

export function hashAgentKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function keyPrefix(raw: string): string {
  return raw.slice(0, 12);
}

export function readBearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (match?.[1]) return match[1].trim();
  const alt = request.headers.get("x-stocked-key");
  return alt?.trim() || null;
}

export async function lookupAgentKey(sql: Sql, token: string): Promise<AgentPrincipal | null> {
  if (!token.startsWith("stk_") || token.length < 20) return null;
  const rows = await sql<{
    id: number;
    household_id: number;
    user_id: string;
    can_write: boolean;
    revoked_at: string | Date | null;
  }>`
    select id, household_id, user_id, can_write, revoked_at
    from agent_api_keys
    where key_hash = ${hashAgentKey(token)}
    limit 1
  `;
  const row = rows[0];
  if (!row || row.revoked_at) return null;
  void sql`update agent_api_keys set last_used_at = now() where id = ${row.id}`.catch(() => undefined);
  return {
    keyId: Number(row.id),
    householdId: Number(row.household_id),
    userId: String(row.user_id),
    canWrite: Boolean(row.can_write),
  };
}
