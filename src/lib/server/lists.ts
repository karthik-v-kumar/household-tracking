import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { LIST_COLORS, LIST_ICONS } from "@/lib/constants";
import { levelRank } from "@/lib/inventory-logic";
import type {
  CatalogItem,
  Household,
  HouseholdMember,
  InventoryItem,
  ListDetail,
  ListItem,
  Overview,
  ShoppingList,
} from "@/lib/types";
import type { Sql } from "@/lib/db";
import {
  assertListInHousehold,
  getSqlClient,
  requireMembership,
  toIso,
  type MembershipRow,
} from "./access";
import { mapInventoryRow, type InventoryRow } from "./inventory-map";

function asListIcon(value: string) {
  return value in Object.fromEntries(LIST_ICONS.map((i) => [i.id, true]))
    ? (value as ShoppingList["icon"])
    : ("shopping-cart" as const);
}

function asListColor(value: string) {
  return value in Object.fromEntries(LIST_COLORS.map((c) => [c.id, true]))
    ? (value as ShoppingList["color"])
    : ("sage" as const);
}

type ListCountRow = {
  id: number;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  unchecked_count: number | string;
  total_count: number | string;
};

function mapShoppingList(row: ListCountRow): ShoppingList {
  return {
    id: Number(row.id),
    name: row.name,
    icon: asListIcon(row.icon),
    color: asListColor(row.color),
    sortOrder: Number(row.sort_order),
    uncheckedCount: Number(row.unchecked_count),
    totalCount: Number(row.total_count),
  };
}

async function loadLists(sql: Sql, householdId: number): Promise<ShoppingList[]> {
  const rows = await sql<ListCountRow>`
    select l.id, l.name, l.icon, l.color, l.sort_order,
           coalesce(sum(case when i.checked = false then 1 else 0 end), 0) as unchecked_count,
           coalesce(count(i.id), 0) as total_count
    from lists l
    left join list_items i on i.list_id = l.id
    where l.household_id = ${householdId}
    group by l.id
    order by l.sort_order asc, l.id asc
  `;
  return rows.map(mapShoppingList);
}

async function loadMembers(
  sql: Sql,
  householdId: number,
  userId: string,
): Promise<HouseholdMember[]> {
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
    where m.household_id = ${householdId}
    order by m.joined_at asc
  `;
  return rows.map((row) => ({
    userId: row.user_id,
    role: row.role === "owner" ? "owner" : "member",
    displayName: row.display_name || row.name || "Household member",
    imageUrl: row.image,
    joinedAt: toIso(row.joined_at) ?? new Date().toISOString(),
    isYou: row.user_id === userId,
  }));
}

export async function getOverviewData(
  sql: Sql,
  userId: string,
  membership: MembershipRow,
): Promise<Overview> {
  const [lists, members, inventoryRows, onListRows] = await Promise.all([
    loadLists(sql, membership.id),
    loadMembers(sql, membership.id, userId),
    sql<InventoryRow>`
      select inv.*, l.name as default_list_name
      from inventory_items inv
      left join lists l on l.id = inv.default_list_id
      where inv.household_id = ${membership.id}
    `,
    sql<{ name: string }>`
      select distinct lower(name) as name
      from list_items
      where household_id = ${membership.id} and checked = false
    `,
  ]);

  const onList = new Set(onListRows.map((r) => r.name));
  const lowInventory = inventoryRows
    .map((row) => mapInventoryRow(row, onList.has(row.name.toLowerCase())))
    .filter((item) => item.effectiveLevel === "low" || item.effectiveLevel === "out")
    .sort((a, b) => levelRank(a.effectiveLevel) - levelRank(b.effectiveLevel) || a.name.localeCompare(b.name));

  const household: Household = {
    id: Number(membership.id),
    name: membership.name,
    inviteCode: membership.invite_code,
    role: membership.role === "owner" ? "owner" : "member",
    createdAt: toIso(membership.created_at) ?? new Date().toISOString(),
  };

  return { household, members, lists, lowInventory };
}

export const createList = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(40),
        icon: z.string().min(1).max(40),
        color: z.string().min(1).max(20),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    const icon = asListIcon(data.icon);
    const color = asListColor(data.color);
    const max = await sql<{ n: number | string }>`
      select coalesce(max(sort_order), -1) as n from lists where household_id = ${membership.id}
    `;
    const sortOrder = Number(max[0]?.n ?? -1) + 1;
    const rows = await sql<{ id: number }>`
      insert into lists (household_id, name, icon, color, sort_order)
      values (${membership.id}, ${data.name}, ${icon}, ${color}, ${sortOrder})
      returning id
    `;
    return { id: Number(rows[0]!.id) };
  });

export const updateList = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        listId: z.number().int().positive(),
        name: z.string().trim().min(1).max(40),
        icon: z.string().min(1).max(40),
        color: z.string().min(1).max(20),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    await assertListInHousehold(sql, data.listId, membership.id);
    await sql`
      update lists
      set name = ${data.name}, icon = ${asListIcon(data.icon)}, color = ${asListColor(data.color)}
      where id = ${data.listId} and household_id = ${membership.id}
    `;
    return { ok: true as const };
  });

export const deleteList = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ listId: z.number().int().positive() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    await assertListInHousehold(sql, data.listId, membership.id);
    await sql`delete from lists where id = ${data.listId} and household_id = ${membership.id}`;
    return { ok: true as const };
  });

export const getListDetail = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ listId: z.number().int().positive() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<ListDetail> => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    const lists = await loadLists(sql, membership.id);
    const list = lists.find((l) => l.id === data.listId);
    if (!list) throw new Error("List not found");

    const itemRows = await sql<{
      id: number;
      list_id: number;
      catalog_item_id: number | null;
      name: string;
      quantity: string | null;
      notes: string | null;
      checked: boolean;
      is_staple: boolean;
      added_by: string;
      created_at: string | Date;
      added_by_name: string | null;
    }>`
      select i.id, i.list_id, i.catalog_item_id, i.name, i.quantity, i.notes,
             i.checked, i.is_staple, i.added_by, i.created_at, u.name as added_by_name
      from list_items i
      left join "user" u on u.id = i.added_by
      where i.list_id = ${data.listId} and i.household_id = ${membership.id}
      order by i.checked asc, i.id desc
    `;

    const items: ListItem[] = itemRows.map((row) => ({
      id: Number(row.id),
      listId: Number(row.list_id),
      catalogItemId: row.catalog_item_id == null ? null : Number(row.catalog_item_id),
      name: row.name,
      quantity: row.quantity,
      notes: row.notes,
      checked: Boolean(row.checked),
      isStaple: Boolean(row.is_staple),
      addedBy: row.added_by,
      addedByName: row.added_by_name || "Someone",
      createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    }));

    const usualRows = await sql<{ id: number; name: string }>`
      select id, name
      from catalog_items
      where household_id = ${membership.id}
        and is_staple = true
        and (default_list_id = ${data.listId} or default_list_id is null)
      order by name asc
    `;
    const onList = new Set(items.filter((i) => !i.checked).map((i) => i.name.toLowerCase()));
    const usuals = usualRows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      alreadyOnList: onList.has(row.name.toLowerCase()),
    }));

    return { list, items, usuals };
  });

async function upsertCatalog(
  sql: Sql,
  householdId: number,
  name: string,
  listId: number,
  asStaple: boolean,
): Promise<number> {
  const existing = await sql<{ id: number; is_staple: boolean; default_list_id: number | null }>`
    select id, is_staple, default_list_id
    from catalog_items
    where household_id = ${householdId} and lower(name) = lower(${name})
    limit 1
  `;
  const found = existing[0];
  if (found) {
    if (asStaple && (!found.is_staple || found.default_list_id == null)) {
      await sql`
        update catalog_items
        set is_staple = true,
            default_list_id = coalesce(default_list_id, ${listId})
        where id = ${found.id} and household_id = ${householdId}
      `;
    }
    return Number(found.id);
  }
  const inserted = await sql<{ id: number }>`
    insert into catalog_items (household_id, name, default_list_id, is_staple)
    values (${householdId}, ${name}, ${asStaple ? listId : null}, ${asStaple})
    returning id
  `;
  return Number(inserted[0]!.id);
}

export const addListItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        listId: z.number().int().positive(),
        name: z.string().trim().min(1).max(80),
        quantity: z.string().trim().max(30).optional().nullable(),
        notes: z.string().trim().max(160).optional().nullable(),
        isStaple: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    await assertListInHousehold(sql, data.listId, membership.id);
    const name = data.name.trim();
    const catalogId = await upsertCatalog(
      sql,
      membership.id,
      name,
      data.listId,
      Boolean(data.isStaple),
    );

    const existing = await sql<{ id: number; checked: boolean }>`
      select id, checked from list_items
      where list_id = ${data.listId} and household_id = ${membership.id} and lower(name) = lower(${name})
      limit 1
    `;
    const found = existing[0];
    if (found) {
      if (found.checked) {
        await sql`
          update list_items
          set checked = false,
              quantity = ${data.quantity || null},
              notes = ${data.notes || null},
              is_staple = ${Boolean(data.isStaple) || false},
              catalog_item_id = ${catalogId}
          where id = ${found.id} and household_id = ${membership.id}
        `;
        return { id: Number(found.id), revived: true };
      }
      return { id: Number(found.id), already: true };
    }

    const rows = await sql<{ id: number }>`
      insert into list_items (
        household_id, list_id, catalog_item_id, name, quantity, notes, is_staple, added_by
      ) values (
        ${membership.id}, ${data.listId}, ${catalogId}, ${name},
        ${data.quantity || null}, ${data.notes || null}, ${Boolean(data.isStaple)}, ${context.userId}
      )
      returning id
    `;
    return { id: Number(rows[0]!.id), already: false };
  });

export const toggleListItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ itemId: z.number().int().positive(), checked: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    await sql`
      update list_items
      set checked = ${data.checked}
      where id = ${data.itemId} and household_id = ${membership.id}
    `;
    return { ok: true as const };
  });

export const updateListItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        itemId: z.number().int().positive(),
        quantity: z.string().trim().max(30).optional().nullable(),
        notes: z.string().trim().max(160).optional().nullable(),
        isStaple: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    const rows = await sql<{ id: number; name: string; list_id: number; catalog_item_id: number | null }>`
      select id, name, list_id, catalog_item_id from list_items
      where id = ${data.itemId} and household_id = ${membership.id}
      limit 1
    `;
    const item = rows[0];
    if (!item) throw new Error("Item not found");

    if (typeof data.quantity !== "undefined") {
      await sql`
        update list_items
        set quantity = ${data.quantity || null}
        where id = ${item.id} and household_id = ${membership.id}
      `;
    }
    if (typeof data.notes !== "undefined") {
      await sql`
        update list_items
        set notes = ${data.notes || null}
        where id = ${item.id} and household_id = ${membership.id}
      `;
    }

    if (typeof data.isStaple === "boolean") {
      await sql`
        update list_items
        set is_staple = ${data.isStaple}
        where id = ${item.id} and household_id = ${membership.id}
      `;
      if (item.catalog_item_id) {
        await sql`
          update catalog_items
          set is_staple = ${data.isStaple},
              default_list_id = case when ${data.isStaple} then coalesce(default_list_id, ${item.list_id}) else default_list_id end
          where id = ${item.catalog_item_id} and household_id = ${membership.id}
        `;
      }
    }
    return { ok: true as const };
  });

export const deleteListItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ itemId: z.number().int().positive() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    await sql`
      delete from list_items where id = ${data.itemId} and household_id = ${membership.id}
    `;
    return { ok: true as const };
  });

export const clearCheckedItems = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ listId: z.number().int().positive() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    await assertListInHousehold(sql, data.listId, membership.id);

    const bought = await sql<{ name: string }>`
      select name from list_items
      where list_id = ${data.listId} and household_id = ${membership.id} and checked = true
    `;

    for (const item of bought) {
      await sql`
        update inventory_items
        set level = ${"full"},
            last_restocked_at = now(),
            updated_at = now()
        where household_id = ${membership.id} and lower(name) = lower(${item.name})
      `;
    }

    await sql`
      delete from list_items
      where list_id = ${data.listId} and household_id = ${membership.id} and checked = true
    `;

    return { cleared: bought.length };
  });

export const addUsualsToList = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ listId: z.number().int().positive() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    await assertListInHousehold(sql, data.listId, membership.id);

    const usuals = await sql<{ id: number; name: string }>`
      select id, name from catalog_items
      where household_id = ${membership.id}
        and is_staple = true
        and (default_list_id = ${data.listId} or default_list_id is null)
    `;

    const existing = await sql<{ name: string }>`
      select lower(name) as name from list_items
      where list_id = ${data.listId} and household_id = ${membership.id}
    `;
    const have = new Set(existing.map((r) => r.name));

    let added = 0;
    for (const usual of usuals) {
      if (have.has(usual.name.toLowerCase())) continue;
      await sql`
        insert into list_items (
          household_id, list_id, catalog_item_id, name, is_staple, added_by
        ) values (
          ${membership.id}, ${data.listId}, ${usual.id}, ${usual.name}, true, ${context.userId}
        )
      `;
      added += 1;
    }
    return { added };
  });

export const searchCatalog = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        q: z.string().trim().max(80),
        listId: z.number().int().positive().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<CatalogItem[]> => {
    const sql = await getSqlClient();
    const membership = await requireMembership(sql, context.userId);
    const rows = data.q
      ? await sql<{
          id: number;
          name: string;
          category: string;
          default_list_id: number | null;
          is_staple: boolean;
        }>`
          select id, name, category, default_list_id, is_staple
          from catalog_items
          where household_id = ${membership.id} and name ilike ${`%${data.q}%`}
          order by is_staple desc, name asc
          limit 8
        `
      : await sql<{
          id: number;
          name: string;
          category: string;
          default_list_id: number | null;
          is_staple: boolean;
        }>`
          select id, name, category, default_list_id, is_staple
          from catalog_items
          where household_id = ${membership.id} and is_staple = true
          order by name asc
          limit 12
        `;
    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      category: (row.category as CatalogItem["category"]) || "other",
      defaultListId: row.default_list_id == null ? null : Number(row.default_list_id),
      isStaple: Boolean(row.is_staple),
    }));
  });

