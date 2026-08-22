import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { DEFAULT_LISTS } from "@/lib/constants";
import type { Household, HouseholdMember, Overview } from "@/lib/types";
import {
  generateInviteCode,
  getMembership,
  getSqlClient,
  requireMembership,
  toIso,
} from "./access";
import { getOverviewData } from "./lists";

function mapHousehold(
  row: {
    id: number;
    name: string;
    invite_code: string;
    created_at: string | Date;
    role: string;
  },
): Household {
  return {
    id: Number(row.id),
    name: row.name,
    inviteCode: row.invite_code,
    role: row.role === "owner" ? "owner" : "member",
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  };
}

export const getMyHousehold = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSqlClient();
    const membership = await getMembership(sql, context.userId);
    if (!membership) return null;
    return mapHousehold(membership);
  });

export const getOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Overview | null> => {
    const sql = await getSqlClient();
    const membership = await getMembership(sql, context.userId);
    if (!membership) return null;
    return getOverviewData(sql, context.userId, membership);
  });

export const createHousehold = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ name: z.string().trim().min(1).max(60) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSqlClient();
    const existing = await getMembership(sql, context.userId);
    if (existing) {
      throw new Error("You already belong to a household. Leave it first to start a new one.");
    }

    let created: { id: number; name: string; invite_code: string; created_at: string | Date } | undefined;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const code = generateInviteCode();
      try {
        const rows = await sql<{
          id: number;
          name: string;
          invite_code: string;
          created_at: string | Date;
        }>`
          insert into households (name, invite_code, created_by)
          values (${data.name}, ${code}, ${context.userId})
          returning id, name, invite_code, created_at
        `;
        created = rows[0];
        break;
      } catch {
        // Unique invite_code collision — retry.
      }
    }
    if (!created) throw new Error("Could not create household. Try again.");

    await sql`
      insert into household_members (household_id, user_id, role)
      values (${created.id}, ${context.userId}, ${"owner"})
    `;

    for (const [index, list] of DEFAULT_LISTS.entries()) {
      await sql`
        insert into lists (household_id, name, icon, color, sort_order)
        values (${created.id}, ${list.name}, ${list.icon}, ${list.color}, ${index})
      `;
    }

    return mapHousehold({ ...created, role: "owner" });
  });

export const joinHousehold = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ code: z.string().trim().min(4).max(20) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSqlClient();
    const existing = await getMembership(sql, context.userId);
    if (existing) {
      throw new Error("You already belong to a household. Leave it first to join another.");
    }

    const code = data.code.toUpperCase().replace(/\s+/g, "");
    const normalized = code.includes("-")
      ? code
      : `${code.slice(0, 4)}-${code.slice(4)}`;

    const households = await sql<{
      id: number;
      name: string;
      invite_code: string;
      created_at: string | Date;
    }>`
      select id, name, invite_code, created_at
      from households
      where invite_code = ${normalized} or invite_code = ${code}
      limit 1
    `;
    const household = households[0];
    if (!household) throw new Error("That invite code was not found.");

    await sql`
      insert into household_members (household_id, user_id, role)
      values (${household.id}, ${context.userId}, ${"member"})
    `;

    return mapHousehold({ ...household, role: "member" });
  });

export const renameHousehold = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ name: z.string().trim().min(1).max(60) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    await sql`
      update households set name = ${data.name} where id = ${membership.id}
    `;
    return { ok: true as const };
  });

export const regenerateInviteCode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    if (membership.role !== "owner") throw new Error("Only the owner can refresh the invite code.");

    let code = generateInviteCode();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        await sql`
          update households set invite_code = ${code} where id = ${membership.id}
        `;
        return { inviteCode: code };
      } catch {
        code = generateInviteCode();
      }
    }
    throw new Error("Could not refresh the invite code.");
  });

export const leaveHousehold = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);

    await sql`
      delete from household_members
      where household_id = ${membership.id} and user_id = ${context.userId}
    `;

    const remaining = await sql<{ user_id: string; role: string; joined_at: string | Date }>`
      select user_id, role, joined_at
      from household_members
      where household_id = ${membership.id}
      order by joined_at asc
    `;

    if (remaining.length === 0) {
      await sql`delete from households where id = ${membership.id}`;
    } else if (membership.role === "owner" && remaining.every((m) => m.role !== "owner")) {
      const nextOwner = remaining[0]!;
      await sql`
        update household_members
        set role = ${"owner"}
        where household_id = ${membership.id} and user_id = ${nextOwner.user_id}
      `;
    }

    return { ok: true as const };
  });

export const listMembers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<HouseholdMember[]> => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    const rows = await sql<{
      user_id: string;
      role: string;
      display_name: string | null;
      joined_at: string | Date;
      name: string | null;
      image: string | null;
    }>`
      select m.user_id, m.role, m.display_name, m.joined_at, u.name, u.image
      from household_members m
      left join "user" u on u.id = m.user_id
      where m.household_id = ${membership.id}
      order by m.joined_at asc
    `;
    return rows.map((row) => ({
      userId: row.user_id,
      role: row.role === "owner" ? "owner" : "member",
      displayName: row.display_name || row.name || "Household member",
      imageUrl: row.image,
      joinedAt: toIso(row.joined_at) ?? new Date().toISOString(),
      isYou: row.user_id === context.userId,
    }));
  });
