import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { CATEGORIES, INVENTORY_LEVELS } from "@/lib/constants";
import { levelRank } from "@/lib/inventory-logic";
import type { InventoryItem } from "@/lib/types";
import {
  assertListInHousehold,
  getSqlClient,
  requireMembership,
} from "./access";
import { mapInventoryRow, type InventoryRow } from "./inventory-map";

function asLevel(value: string) {
  return INVENTORY_LEVELS.some((l) => l.id === value) ? value : "ok";
}

function asCategory(value: string) {
  return CATEGORIES.some((c) => c.id === value) ? value : "other";
}

async function loadInventory(userId: string): Promise<InventoryItem[]> {
  const sql = await getSqlClient();
  const membership = await requireMembership(sql, userId);
  const [rows, onListRows] = await Promise.all([
    sql<InventoryRow>`
      select inv.id, inv.name, inv.category, inv.level, inv.typical_days,
             inv.last_restocked_at, inv.default_list_id, inv.notes,
             l.name as default_list_name
      from inventory_items inv
      left join lists l on l.id = inv.default_list_id
      where inv.household_id = ${membership.id}
      order by inv.name asc
    `,
    sql<{ name: string }>`
      select distinct lower(name) as name
      from list_items
      where household_id = ${membership.id} and checked = false
    `,
  ]);
  const onList = new Set(onListRows.map((r) => r.name));
  return rows
    .map((row) => mapInventoryRow(row, onList.has(row.name.toLowerCase())))
    .sort(
      (a, b) =>
        levelRank(a.effectiveLevel) - levelRank(b.effectiveLevel) || a.name.localeCompare(b.name),
    );
}

export const listInventory = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => loadInventory(context.userId));

export const addInventoryItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(80),
        category: z.string().optional(),
        level: z.string().optional(),
        typicalDays: z.number().int().min(1).max(730).optional().nullable(),
        defaultListId: z.number().int().positive().optional().nullable(),
        notes: z.string().trim().max(160).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    if (data.defaultListId) {
      await assertListInHousehold(sql, data.defaultListId, membership.id);
    }

    const existing = await sql<{ id: number }>`
      select id from inventory_items
      where household_id = ${membership.id} and lower(name) = lower(${data.name})
      limit 1
    `;
    if (existing[0]) throw new Error("That item is already in inventory.");

    const level = asLevel(data.level ?? "ok");
    const restocked = level === "full" || level === "ok";
    const rows = await sql<{ id: number }>`
      insert into inventory_items (
        household_id, name, category, level, typical_days, last_restocked_at, default_list_id, notes
      ) values (
        ${membership.id},
        ${data.name},
        ${asCategory(data.category ?? "household")},
        ${level},
        ${data.typicalDays ?? null},
        ${restocked ? new Date().toISOString() : null},
        ${data.defaultListId ?? null},
        ${data.notes ?? null}
      )
      returning id
    `;
    return { id: Number(rows[0]!.id) };
  });

export const updateInventoryItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        itemId: z.number().int().positive(),
        level: z.string().optional(),
        typicalDays: z.number().int().min(1).max(730).optional().nullable(),
        defaultListId: z.number().int().positive().optional().nullable(),
        notes: z.string().trim().max(160).optional().nullable(),
        category: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    const existing = await sql<{ id: number; level: string }>`
      select id, level from inventory_items
      where id = ${data.itemId} and household_id = ${membership.id}
      limit 1
    `;
    if (!existing[0]) throw new Error("Item not found");
    if (data.defaultListId) {
      await assertListInHousehold(sql, data.defaultListId, membership.id);
    }

    if (data.level) {
      const level = asLevel(data.level);
      const restock = level === "full";
      if (restock) {
        await sql`
          update inventory_items
          set level = ${level}, last_restocked_at = now(), updated_at = now()
          where id = ${data.itemId} and household_id = ${membership.id}
        `;
      } else {
        await sql`
          update inventory_items
          set level = ${level}, updated_at = now()
          where id = ${data.itemId} and household_id = ${membership.id}
        `;
      }
    }
    if (typeof data.typicalDays !== "undefined") {
      await sql`
        update inventory_items
        set typical_days = ${data.typicalDays}, updated_at = now()
        where id = ${data.itemId} and household_id = ${membership.id}
      `;
    }
    if (typeof data.defaultListId !== "undefined") {
      await sql`
        update inventory_items
        set default_list_id = ${data.defaultListId}, updated_at = now()
        where id = ${data.itemId} and household_id = ${membership.id}
      `;
    }
    if (typeof data.notes !== "undefined") {
      await sql`
        update inventory_items
        set notes = ${data.notes}, updated_at = now()
        where id = ${data.itemId} and household_id = ${membership.id}
      `;
    }
    if (data.category) {
      await sql`
        update inventory_items
        set category = ${asCategory(data.category)}, updated_at = now()
        where id = ${data.itemId} and household_id = ${membership.id}
      `;
    }
    return { ok: true as const };
  });

export const deleteInventoryItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ itemId: z.number().int().positive() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    await sql`
      delete from inventory_items where id = ${data.itemId} and household_id = ${membership.id}
    `;
    return { ok: true as const };
  });

export const addLowInventoryToLists = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ itemIds: z.array(z.number().int().positive()).optional() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    const items = await loadInventory(context.userId);
    const wanted = items.filter((item) => {
      if (item.onAList) return false;
      if (data.itemIds && data.itemIds.length > 0) return data.itemIds.includes(item.id);
      return item.effectiveLevel === "low" || item.effectiveLevel === "out";
    });

    const lists = await sql<{ id: number }>`
      select id from lists where household_id = ${membership.id} order by sort_order asc, id asc limit 1
    `;
    const fallbackListId = lists[0]?.id;
    if (!fallbackListId) throw new Error("Create a list first.");

    let added = 0;
    for (const item of wanted) {
      const listId = item.defaultListId ?? Number(fallbackListId);
      const existing = await sql<{ id: number }>`
        select id from list_items
        where list_id = ${listId} and household_id = ${membership.id} and lower(name) = lower(${item.name})
        limit 1
      `;
      if (existing[0]) continue;
      await sql`
        insert into list_items (household_id, list_id, name, added_by, notes)
        values (${membership.id}, ${listId}, ${item.name}, ${context.userId}, ${"From inventory"})
      `;
      added += 1;
    }
    return { added };
  });
