import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { describeUpkeep, upkeepRank, DEFAULT_STOCK_LEAD_DAYS } from "@/lib/upkeep-logic";
import type { UpkeepItem } from "@/lib/types";
import {
  assertListInHousehold,
  getSqlClient,
  requireMembership,
  toIso,
} from "./access";

export type UpkeepRow = {
  id: number;
  name: string;
  interval_days: number | string;
  last_replaced_at: string | Date | null;
  spare_count: number | string;
  qty_needed: number | string;
  stock_lead_days: number | string | null;
  default_list_id: number | null;
  default_list_name: string | null;
  notes: string | null;
};

export function mapUpkeepRow(row: UpkeepRow, onAList: boolean): UpkeepItem {
  const intervalDays = Number(row.interval_days);
  const spareCount = Number(row.spare_count);
  const qtyNeeded = Math.max(1, Number(row.qty_needed) || 1);
  const stockLeadDays =
    row.stock_lead_days == null
      ? DEFAULT_STOCK_LEAD_DAYS
      : Number(row.stock_lead_days);
  const lastReplacedAt = toIso(row.last_replaced_at);
  const described = describeUpkeep({
    intervalDays,
    lastReplacedAt,
    spareCount,
    qtyNeeded,
    stockLeadDays,
  });
  return {
    id: Number(row.id),
    name: row.name,
    intervalDays,
    lastReplacedAt,
    spareCount,
    qtyNeeded,
    stockLeadDays: Number.isFinite(stockLeadDays) ? stockLeadDays : DEFAULT_STOCK_LEAD_DAYS,
    defaultListId: row.default_list_id == null ? null : Number(row.default_list_id),
    defaultListName: row.default_list_name,
    notes: row.notes,
    onAList,
    ...described,
  };
}

export async function loadUpkeep(userId: string): Promise<UpkeepItem[]> {
  const sql = await getSqlClient();
  const membership = await requireMembership(sql, userId);
  const [rows, onListRows] = await Promise.all([
    sql<UpkeepRow>`
      select u.id, u.name, u.interval_days, u.last_replaced_at, u.spare_count,
             u.qty_needed, u.stock_lead_days, u.default_list_id, u.notes,
             l.name as default_list_name
      from upkeep_items u
      left join lists l on l.id = u.default_list_id
      where u.household_id = ${membership.id}
      order by u.name asc
    `,
    sql<{ name: string }>`
      select distinct lower(name) as name
      from list_items
      where household_id = ${membership.id} and checked = false
    `,
  ]);
  const onList = new Set(onListRows.map((r) => r.name));
  return rows
    .map((row) => mapUpkeepRow(row, onList.has(row.name.toLowerCase())))
    .sort(
      (a, b) =>
        upkeepRank(a.status) - upkeepRank(b.status) || a.name.localeCompare(b.name),
    );
}

export const listUpkeep = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => loadUpkeep(context.userId));

export const addUpkeepItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(80),
        intervalDays: z.number().int().min(7).max(1095),
        qtyNeeded: z.number().int().min(1).max(12).optional(),
        spareCount: z.number().int().min(0).max(24).optional(),
        lastReplacedAt: z.string().trim().optional().nullable(),
        stockLeadDays: z.number().int().min(0).max(1095).optional(),
        defaultListId: z.number().int().positive().optional().nullable(),
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
      select id from upkeep_items
      where household_id = ${membership.id} and lower(name) = lower(${data.name})
      limit 1
    `;
    if (existing[0]) throw new Error("That filter is already tracked.");

    const last =
      data.lastReplacedAt && data.lastReplacedAt.length > 0
        ? data.lastReplacedAt
        : new Date().toISOString();

    const rows = await sql<{ id: number }>`
      insert into upkeep_items (
        household_id, name, interval_days, last_replaced_at, spare_count, qty_needed, stock_lead_days, default_list_id
      ) values (
        ${membership.id},
        ${data.name},
        ${data.intervalDays},
        ${last},
        ${data.spareCount ?? 0},
        ${data.qtyNeeded ?? 1},
        ${data.stockLeadDays ?? DEFAULT_STOCK_LEAD_DAYS},
        ${data.defaultListId ?? null}
      )
      returning id
    `;
    return { id: Number(rows[0]!.id) };
  });

export const updateUpkeepItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        itemId: z.number().int().positive(),
        name: z.string().trim().min(1).max(80).optional(),
        intervalDays: z.number().int().min(7).max(1095).optional(),
        spareCount: z.number().int().min(0).max(24).optional(),
        qtyNeeded: z.number().int().min(1).max(12).optional(),
        lastReplacedAt: z.string().trim().optional().nullable(),
        stockLeadDays: z.number().int().min(0).max(1095).optional(),
        defaultListId: z.number().int().positive().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    const existing = await sql<{ id: number }>`
      select id from upkeep_items
      where id = ${data.itemId} and household_id = ${membership.id}
      limit 1
    `;
    if (!existing[0]) throw new Error("Item not found");
    if (data.defaultListId) {
      await assertListInHousehold(sql, data.defaultListId, membership.id);
    }

    if (data.name) {
      const clash = await sql<{ id: number }>`
        select id from upkeep_items
        where household_id = ${membership.id}
          and lower(name) = lower(${data.name})
          and id <> ${data.itemId}
        limit 1
      `;
      if (clash[0]) throw new Error("That filter is already tracked.");
      await sql`
        update upkeep_items
        set name = ${data.name}, updated_at = now()
        where id = ${data.itemId} and household_id = ${membership.id}
      `;
    }
    if (typeof data.intervalDays === "number") {
      await sql`
        update upkeep_items
        set interval_days = ${data.intervalDays}, updated_at = now()
        where id = ${data.itemId} and household_id = ${membership.id}
      `;
    }
    if (typeof data.spareCount === "number") {
      await sql`
        update upkeep_items
        set spare_count = ${data.spareCount}, updated_at = now()
        where id = ${data.itemId} and household_id = ${membership.id}
      `;
    }
    if (typeof data.qtyNeeded === "number") {
      await sql`
        update upkeep_items
        set qty_needed = ${data.qtyNeeded}, updated_at = now()
        where id = ${data.itemId} and household_id = ${membership.id}
      `;
    }
    if (typeof data.lastReplacedAt !== "undefined") {
      await sql`
        update upkeep_items
        set last_replaced_at = ${data.lastReplacedAt || null}, updated_at = now()
        where id = ${data.itemId} and household_id = ${membership.id}
      `;
    }
    if (typeof data.stockLeadDays === "number") {
      await sql`
        update upkeep_items
        set stock_lead_days = ${data.stockLeadDays}, updated_at = now()
        where id = ${data.itemId} and household_id = ${membership.id}
      `;
    }
    if (typeof data.defaultListId !== "undefined") {
      await sql`
        update upkeep_items
        set default_list_id = ${data.defaultListId}, updated_at = now()
        where id = ${data.itemId} and household_id = ${membership.id}
      `;
    }
    return { ok: true as const };
  });

export const markReplaced = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ itemId: z.number().int().positive() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    const rows = await sql<{ spare_count: number | string; qty_needed: number | string }>`
      select spare_count, qty_needed from upkeep_items
      where id = ${data.itemId} and household_id = ${membership.id}
      limit 1
    `;
    if (!rows[0]) throw new Error("Item not found");
    const nextSpare = Math.max(0, Number(rows[0].spare_count) - Math.max(1, Number(rows[0].qty_needed) || 1));
    await sql`
      update upkeep_items
      set last_replaced_at = now(), spare_count = ${nextSpare}, updated_at = now()
      where id = ${data.itemId} and household_id = ${membership.id}
    `;
    return { ok: true as const, spareCount: nextSpare };
  });

export const deleteUpkeepItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ itemId: z.number().int().positive() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    await sql`
      delete from upkeep_items where id = ${data.itemId} and household_id = ${membership.id}
    `;
    return { ok: true as const };
  });

export const addNeededUpkeepToLists = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ itemIds: z.array(z.number().int().positive()).optional() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    const items = await loadUpkeep(context.userId);
    const wanted = items.filter((item) => {
      if (item.onAList) return false;
      if (data.itemIds && data.itemIds.length > 0) return data.itemIds.includes(item.id);
      return item.needToBuy;
    });

    const lists = await sql<{ id: number }>`
      select id from lists where household_id = ${membership.id} order by sort_order asc, id asc
    `;
    const warehouse = await sql<{ id: number }>`
      select id from lists
      where household_id = ${membership.id} and lower(name) = ${"warehouse"}
      limit 1
    `;
    const fallbackListId = warehouse[0]?.id ?? lists[0]?.id;
    if (!fallbackListId) throw new Error("Create a list first.");

    let added = 0;
    for (const item of wanted) {
      const listId = item.defaultListId ?? Number(fallbackListId);
      const qty = item.buyQty > 1 ? String(item.buyQty) : null;
      const existing = await sql<{ id: number }>`
        select id from list_items
        where list_id = ${listId} and household_id = ${membership.id} and lower(name) = lower(${item.name})
        limit 1
      `;
      if (existing[0]) continue;
      await sql`
        insert into list_items (household_id, list_id, name, quantity, added_by, notes)
        values (${membership.id}, ${listId}, ${item.name}, ${qty}, ${context.userId}, ${"From filters"})
      `;
      added += 1;
    }
    return { added };
  });
