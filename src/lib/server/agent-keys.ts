import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSqlClient, requireMembership, toIso } from "./access";
import { generateAgentKey, hashAgentKey, keyPrefix } from "./agent-auth";

export const listAgentKeys = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    const rows = await sql<{
      id: number;
      label: string;
      key_prefix: string;
      can_write: boolean;
      created_at: string | Date;
      last_used_at: string | Date | null;
      revoked_at: string | Date | null;
    }>`
      select id, label, key_prefix, can_write, created_at, last_used_at, revoked_at
      from agent_api_keys
      where household_id = ${membership.id}
      order by created_at desc
    `;
    return rows.map((row) => ({
      id: Number(row.id),
      label: row.label,
      prefix: row.key_prefix,
      canWrite: Boolean(row.can_write),
      createdAt: toIso(row.created_at),
      lastUsedAt: toIso(row.last_used_at),
      revokedAt: toIso(row.revoked_at),
    }));
  });

export const createAgentKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ label: z.string().trim().min(1).max(40).optional() }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    const rawKey = generateAgentKey();
    const label = data.label?.trim() || "Assistant";
    const rows = await sql<{ id: number; created_at: string | Date }>`
      insert into agent_api_keys (household_id, user_id, label, key_prefix, key_hash, can_write)
      values (
        ${membership.id},
        ${context.userId},
        ${label},
        ${keyPrefix(rawKey)},
        ${hashAgentKey(rawKey)},
        ${true}
      )
      returning id, created_at
    `;
    return {
      id: Number(rows[0]!.id),
      label,
      prefix: keyPrefix(rawKey),
      rawKey,
      createdAt: toIso(rows[0]!.created_at),
    };
  });

export const revokeAgentKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ keyId: z.number().int().positive() }).parse(input))
  .handler(async ({ context, data }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    const rows = await sql<{ id: number }>`
      update agent_api_keys
      set revoked_at = now()
      where id = ${data.keyId}
        and household_id = ${membership.id}
        and revoked_at is null
      returning id
    `;
    if (!rows[0]) throw new Error("Key not found");
    return { ok: true as const };
  });
