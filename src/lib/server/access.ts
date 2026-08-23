import { getSql, type Sql } from "@/lib/db";
import type { HouseholdRole } from "@/lib/types";

export type MembershipRow = {
  id: number;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string | Date;
  role: HouseholdRole;
  display_name: string | null;
};

export async function getSqlClient(): Promise<Sql> {
  return getSql();
}

export async function getMembership(
  sql: Sql,
  userId: string,
): Promise<MembershipRow | null> {
  const rows = await sql<MembershipRow>`
    select h.id, h.name, h.invite_code, h.created_by, h.created_at,
           m.role, m.display_name
    from household_members m
    join households h on h.id = m.household_id
    where m.user_id = ${userId}
    limit 1
  `;
  return rows[0] ?? null;
}

export async function requireMembership(
  sql: Sql,
  userId: string,
): Promise<MembershipRow> {
  const membership = await getMembership(sql, userId);
  if (!membership) {
    const err = new Error("No household");
    (err as Error & { status?: number }).status = 409;
    throw err;
  }
  return membership;
}

export async function assertListInHousehold(
  sql: Sql,
  listId: number,
  householdId: number,
): Promise<{ id: number; name: string; icon: string; color: string; sort_order: number }> {
  const rows = await sql<{
    id: number;
    name: string;
    icon: string;
    color: string;
    sort_order: number;
  }>`
    select id, name, icon, color, sort_order
    from lists
    where id = ${listId} and household_id = ${householdId}
    limit 1
  `;
  const list = rows[0];
  if (!list) {
    const err = new Error("List not found");
    (err as Error & { status?: number }).status = 404;
    throw err;
  }
  return list;
}

export function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let raw = "";
  for (let i = 0; i < 8; i += 1) {
    raw += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export async function touchHousehold(sql: Sql, householdId: number): Promise<void> {
  await sql`update households set updated_at = now() where id = ${householdId}`;
}
