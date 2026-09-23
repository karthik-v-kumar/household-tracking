import { z } from "zod";
import { CATEGORIES, INVENTORY_LEVELS, LIST_COLORS, LIST_ICONS } from "@/lib/constants";
import { DEFAULT_STOCK_LEAD_DAYS } from "@/lib/upkeep-logic";
import type { Sql } from "@/lib/db";
import {
  assertListInHousehold,
  getMembership,
  getSqlClient,
  touchHousehold,
} from "./access";
import { lookupAgentKey, readBearer, type AgentPrincipal } from "./agent-auth";
import { getOverviewData } from "./lists";
import { mapInventoryRow, type InventoryRow } from "./inventory-map";
import { loadUpkeep } from "./upkeep";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, x-stocked-key",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "cache-control": "no-store",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });
}

function asIcon(value: string | undefined) {
  return value && LIST_ICONS.some((icon) => icon.id === value) ? value : "shopping-cart";
}

function asColor(value: string | undefined) {
  return value && LIST_COLORS.some((color) => color.id === value) ? value : "sage";
}

function asLevel(value: string | undefined) {
  return value && INVENTORY_LEVELS.some((level) => level.id === value) ? value : "ok";
}

function asCategory(value: string | undefined) {
  return value && CATEGORIES.some((category) => category.id === value) ? value : "other";
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) return {};
  const value = JSON.parse(text) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("JSON object required");
  }
  return value as Record<string, unknown>;
}

function segments(request: Request): string[] {
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  const rest = path.startsWith("/api/agent") ? path.slice("/api/agent".length) : "";
  return rest.split("/").filter(Boolean);
}

async function loadInventory(sql: Sql, householdId: number) {
  const [rows, onListRows] = await Promise.all([
    sql<InventoryRow>`
      select inv.id, inv.name, inv.category, inv.level, inv.typical_days,
             inv.last_restocked_at, inv.default_list_id, inv.notes,
             l.name as default_list_name
      from inventory_items inv
      left join lists l on l.id = inv.default_list_id
      where inv.household_id = ${householdId}
      order by inv.name asc
    `,
    sql<{ name: string }>`
      select distinct lower(name) as name
      from list_items
      where household_id = ${householdId} and checked = false
    `,
  ]);
  const onList = new Set(onListRows.map((row) => row.name));
  return rows.map((row) => mapInventoryRow(row, onList.has(row.name.toLowerCase())));
}

async function findListId(sql: Sql, householdId: number, listId?: number, listName?: string) {
  if (listId) {
    const list = await assertListInHousehold(sql, listId, householdId);
    return list;
  }
  if (!listName?.trim()) throw new Error("listId or listName is required");
  const rows = await sql<{ id: number; name: string }>`
    select id, name from lists
    where household_id = ${householdId} and lower(name) = lower(${listName.trim()})
    limit 1
  `;
  const list = rows[0];
  if (!list) throw new Error(`No list named ${listName.trim()}`);
  return assertListInHousehold(sql, Number(list.id), householdId);
}

export async function handleAgentRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const token = readBearer(request);
  if (!token) return json({ error: "Missing API key" }, 401);

  let sql: Sql;
  try {
    sql = await getSqlClient();
  } catch (err) {
    console.error("[agent] db", err);
    return json({ error: "Database unavailable" }, 500);
  }

  let principal: AgentPrincipal | null;
  try {
    principal = await lookupAgentKey(sql, token);
  } catch (err) {
    console.error("[agent] lookup", err);
    return json({ error: "Could not check API key" }, 500);
  }
  if (!principal) return json({ error: "Invalid API key" }, 401);

  const membership = await getMembership(sql, principal.userId);
  if (!membership || Number(membership.id) !== principal.householdId) {
    return json({ error: "Invalid API key" }, 401);
  }

  const write = request.method !== "GET" && request.method !== "HEAD";
  if (write && !principal.canWrite) return json({ error: "This key is read-only" }, 403);

  const parts = segments(request);
  try {
    return await dispatch(request, sql, principal.userId, membership, parts);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    const status = message === "List not found" || message.startsWith("No list") ? 404 : 400;
    return json({ error: message }, status);
  }
}

async function dispatch(
  request: Request,
  sql: Sql,
  userId: string,
  membership: NonNullable<Awaited<ReturnType<typeof getMembership>>>,
  parts: string[],
): Promise<Response> {
  const householdId = Number(membership.id);
  const method = request.method;

  if (parts.length === 1 && parts[0] === "health" && method === "GET") {
    return json({ ok: true, write: true, household: membership.name });
  }

  if (parts.length === 1 && parts[0] === "household" && method === "GET") {
    const overview = await getOverviewData(sql, userId, membership);
    const inventory = await loadInventory(sql, householdId);
    const filters = await loadUpkeep(userId);
    return json({
      household: { id: overview.household.id, name: overview.household.name },
      members: overview.members.map((member) => ({
        name: member.displayName,
        role: member.role,
      })),
      lists: overview.lists,
      usuals: overview.usuals,
      inventory,
      filters,
      lowInventory: overview.lowInventory,
      dueFilters: overview.dueUpkeep,
    });
  }

  if (parts[0] === "lists" && parts.length === 1 && method === "GET") {
    const overview = await getOverviewData(sql, userId, membership);
    return json({ lists: overview.lists });
  }

  if (parts[0] === "lists" && parts.length === 1 && method === "POST") {
    const body = z
      .object({
        name: z.string().trim().min(1).max(40),
        icon: z.string().max(40).optional(),
        color: z.string().max(20).optional(),
      })
      .parse(await readJson(request));
    const max = await sql<{ n: number | string }>`
      select coalesce(max(sort_order), -1) as n from lists where household_id = ${householdId}
    `;
    const rows = await sql<{ id: number }>`
      insert into lists (household_id, name, icon, color, sort_order)
      values (
        ${householdId},
        ${body.name},
        ${asIcon(body.icon)},
        ${asColor(body.color)},
        ${Number(max[0]?.n ?? -1) + 1}
      )
      returning id
    `;
    await touchHousehold(sql, householdId);
    return json({ id: Number(rows[0]!.id), name: body.name }, 201);
  }

  if (parts[0] === "lists" && parts.length === 2 && method === "GET") {
    const list = await assertListInHousehold(sql, Number(parts[1]), householdId);
    const items = await sql<{
      id: number;
      name: string;
      quantity: string | null;
      notes: string | null;
      checked: boolean;
      is_staple: boolean;
    }>`
      select id, name, quantity, notes, checked, is_staple
      from list_items
      where list_id = ${list.id} and household_id = ${householdId}
      order by checked asc, id desc
    `;
    return json({
      list: { id: Number(list.id), name: list.name, icon: list.icon, color: list.color },
      items: items.map((item) => ({
        id: Number(item.id),
        name: item.name,
        quantity: item.quantity,
        notes: item.notes,
        checked: Boolean(item.checked),
        staple: Boolean(item.is_staple),
      })),
    });
  }

  if (parts[0] === "lists" && parts.length === 2 && method === "PATCH") {
    const listId = Number(parts[1]);
    await assertListInHousehold(sql, listId, householdId);
    const body = z
      .object({
        name: z.string().trim().min(1).max(40).optional(),
        icon: z.string().max(40).optional(),
        color: z.string().max(20).optional(),
      })
      .parse(await readJson(request));
    const current = await sql<{ name: string; icon: string; color: string }>`
      select name, icon, color from lists where id = ${listId} and household_id = ${householdId}
    `;
    const row = current[0];
    if (!row) return json({ error: "List not found" }, 404);
    await sql`
      update lists
      set name = ${body.name ?? row.name},
          icon = ${body.icon ? asIcon(body.icon) : row.icon},
          color = ${body.color ? asColor(body.color) : row.color}
      where id = ${listId} and household_id = ${householdId}
    `;
    await touchHousehold(sql, householdId);
    return json({ ok: true });
  }

  if (parts[0] === "lists" && parts.length === 2 && method === "DELETE") {
    const listId = Number(parts[1]);
    await assertListInHousehold(sql, listId, householdId);
    await sql`delete from lists where id = ${listId} and household_id = ${householdId}`;
    await touchHousehold(sql, householdId);
    return json({ ok: true });
  }

  if (parts[0] === "lists" && parts.length === 3 && parts[2] === "items" && method === "POST") {
    const body = z
      .object({
        name: z.string().trim().min(1).max(80),
        quantity: z.string().trim().max(30).nullable().optional(),
        notes: z.string().trim().max(160).nullable().optional(),
        staple: z.boolean().optional(),
      })
      .parse(await readJson(request));
    return addItem(sql, membership, userId, Number(parts[1]), undefined, body);
  }

  if (parts[0] === "items" && parts.length === 1 && method === "POST") {
    const body = z
      .object({
        listId: z.number().int().positive().optional(),
        listName: z.string().trim().min(1).max(40).optional(),
        name: z.string().trim().min(1).max(80),
        quantity: z.string().trim().max(30).nullable().optional(),
        notes: z.string().trim().max(160).nullable().optional(),
        staple: z.boolean().optional(),
      })
      .parse(await readJson(request));
    return addItem(sql, membership, userId, body.listId, body.listName, body);
  }

  if (parts[0] === "items" && parts.length === 2 && method === "PATCH") {
    const itemId = Number(parts[1]);
    const body = z
      .object({
        quantity: z.string().trim().max(30).nullable().optional(),
        notes: z.string().trim().max(160).nullable().optional(),
        checked: z.boolean().optional(),
        staple: z.boolean().optional(),
      })
      .parse(await readJson(request));
    const existing = await sql<{ id: number }>`
      select id from list_items where id = ${itemId} and household_id = ${householdId} limit 1
    `;
    if (!existing[0]) return json({ error: "Item not found" }, 404);
    if (typeof body.quantity !== "undefined") {
      await sql`update list_items set quantity = ${body.quantity || null} where id = ${itemId} and household_id = ${householdId}`;
    }
    if (typeof body.notes !== "undefined") {
      await sql`update list_items set notes = ${body.notes || null} where id = ${itemId} and household_id = ${householdId}`;
    }
    if (typeof body.checked === "boolean") {
      await sql`update list_items set checked = ${body.checked} where id = ${itemId} and household_id = ${householdId}`;
    }
    if (typeof body.staple === "boolean") {
      await sql`update list_items set is_staple = ${body.staple} where id = ${itemId} and household_id = ${householdId}`;
    }
    await touchHousehold(sql, householdId);
    return json({ ok: true });
  }

  if (parts[0] === "items" && parts.length === 2 && method === "DELETE") {
    const itemId = Number(parts[1]);
    const rows = await sql<{ id: number }>`
      delete from list_items where id = ${itemId} and household_id = ${householdId} returning id
    `;
    if (!rows[0]) return json({ error: "Item not found" }, 404);
    await touchHousehold(sql, householdId);
    return json({ ok: true });
  }

  if (parts[0] === "inventory" && parts.length === 1 && method === "GET") {
    return json({ inventory: await loadInventory(sql, householdId) });
  }

  if (parts[0] === "inventory" && parts.length === 1 && method === "POST") {
    const body = z
      .object({
        name: z.string().trim().min(1).max(80),
        category: z.string().optional(),
        level: z.string().optional(),
        typicalDays: z.number().int().min(1).max(730).nullable().optional(),
        defaultListId: z.number().int().positive().nullable().optional(),
        notes: z.string().trim().max(160).nullable().optional(),
      })
      .parse(await readJson(request));
    if (body.defaultListId) await assertListInHousehold(sql, body.defaultListId, householdId);
    const clash = await sql<{ id: number }>`
      select id from inventory_items
      where household_id = ${householdId} and lower(name) = lower(${body.name})
      limit 1
    `;
    if (clash[0]) return json({ error: "That item is already in inventory.", id: Number(clash[0].id) }, 409);
    const level = asLevel(body.level);
    const rows = await sql<{ id: number }>`
      insert into inventory_items (
        household_id, name, category, level, typical_days, last_restocked_at, default_list_id, notes
      ) values (
        ${householdId},
        ${body.name},
        ${asCategory(body.category)},
        ${level},
        ${body.typicalDays ?? null},
        ${level === "full" || level === "ok" ? new Date().toISOString() : null},
        ${body.defaultListId ?? null},
        ${body.notes ?? null}
      )
      returning id
    `;
    await touchHousehold(sql, householdId);
    const { notifyPantryChange } = await import("./push-send");
    await notifyPantryChange(sql, {
      membership,
      actorUserId: userId,
      itemName: body.name,
      detail: `added ${body.name} to pantry`,
    });
    return json({ id: Number(rows[0]!.id) }, 201);
  }

  if (parts[0] === "inventory" && parts.length === 2 && method === "PATCH") {
    const itemId = Number(parts[1]);
    const body = z
      .object({
        name: z.string().trim().min(1).max(80).optional(),
        category: z.string().optional(),
        level: z.string().optional(),
        typicalDays: z.number().int().min(1).max(730).nullable().optional(),
        defaultListId: z.number().int().positive().nullable().optional(),
        lastRestockedAt: z.string().trim().nullable().optional(),
        notes: z.string().trim().max(160).nullable().optional(),
      })
      .parse(await readJson(request));
    const existing = await sql<{ id: number; level: string; name: string }>`
      select id, level, name from inventory_items
      where id = ${itemId} and household_id = ${householdId}
      limit 1
    `;
    if (!existing[0]) return json({ error: "Item not found" }, 404);
    if (body.defaultListId) await assertListInHousehold(sql, body.defaultListId, householdId);
    if (body.name) {
      await sql`update inventory_items set name = ${body.name}, updated_at = now() where id = ${itemId} and household_id = ${householdId}`;
    }
    if (body.level) {
      const level = asLevel(body.level);
      if (level === "full") {
        await sql`update inventory_items set level = ${level}, last_restocked_at = now(), updated_at = now() where id = ${itemId} and household_id = ${householdId}`;
      } else {
        await sql`update inventory_items set level = ${level}, updated_at = now() where id = ${itemId} and household_id = ${householdId}`;
      }
    }
    if (typeof body.typicalDays !== "undefined") {
      await sql`update inventory_items set typical_days = ${body.typicalDays}, updated_at = now() where id = ${itemId} and household_id = ${householdId}`;
    }
    if (typeof body.defaultListId !== "undefined") {
      await sql`update inventory_items set default_list_id = ${body.defaultListId}, updated_at = now() where id = ${itemId} and household_id = ${householdId}`;
    }
    if (typeof body.lastRestockedAt !== "undefined") {
      await sql`update inventory_items set last_restocked_at = ${body.lastRestockedAt || null}, updated_at = now() where id = ${itemId} and household_id = ${householdId}`;
    }
    if (typeof body.notes !== "undefined") {
      await sql`update inventory_items set notes = ${body.notes}, updated_at = now() where id = ${itemId} and household_id = ${householdId}`;
    }
    if (body.category) {
      await sql`update inventory_items set category = ${asCategory(body.category)}, updated_at = now() where id = ${itemId} and household_id = ${householdId}`;
    }
    await touchHousehold(sql, householdId);
    if (body.level) {
      const level = asLevel(body.level);
      if ((level === "low" || level === "out") && existing[0].level !== level) {
        const { notifyPantryChange } = await import("./push-send");
        await notifyPantryChange(sql, {
          membership,
          actorUserId: userId,
          itemName: body.name ?? existing[0].name,
          detail:
            level === "out"
              ? `marked ${body.name ?? existing[0].name} out`
              : `marked ${body.name ?? existing[0].name} low`,
        });
      }
    }
    return json({ ok: true });
  }

  if (parts[0] === "inventory" && parts.length === 2 && method === "DELETE") {
    const rows = await sql<{ id: number }>`
      delete from inventory_items
      where id = ${Number(parts[1])} and household_id = ${householdId}
      returning id
    `;
    if (!rows[0]) return json({ error: "Item not found" }, 404);
    await touchHousehold(sql, householdId);
    return json({ ok: true });
  }

  if (parts[0] === "filters" && parts.length === 1 && method === "GET") {
    return json({ filters: await loadUpkeep(userId) });
  }

  if (parts[0] === "filters" && parts.length === 1 && method === "POST") {
    const body = z
      .object({
        name: z.string().trim().min(1).max(80),
        intervalDays: z.number().int().min(7).max(1095),
        qtyNeeded: z.number().int().min(1).max(12).optional(),
        spareCount: z.number().int().min(0).max(24).optional(),
        lastReplacedAt: z.string().trim().nullable().optional(),
        stockLeadDays: z.number().int().min(0).max(1095).optional(),
        defaultListId: z.number().int().positive().nullable().optional(),
      })
      .parse(await readJson(request));
    if (body.defaultListId) await assertListInHousehold(sql, body.defaultListId, householdId);
    const clash = await sql<{ id: number }>`
      select id from upkeep_items
      where household_id = ${householdId} and lower(name) = lower(${body.name})
      limit 1
    `;
    if (clash[0]) return json({ error: "That filter is already tracked.", id: Number(clash[0].id) }, 409);
    const last =
      body.lastReplacedAt === undefined
        ? new Date().toISOString()
        : body.lastReplacedAt && body.lastReplacedAt.length > 0
          ? body.lastReplacedAt
          : null;
    const rows = await sql<{ id: number }>`
      insert into upkeep_items (
        household_id, name, interval_days, last_replaced_at, spare_count, qty_needed, stock_lead_days, default_list_id
      ) values (
        ${householdId},
        ${body.name},
        ${body.intervalDays},
        ${last},
        ${body.spareCount ?? 0},
        ${body.qtyNeeded ?? 1},
        ${body.stockLeadDays ?? DEFAULT_STOCK_LEAD_DAYS},
        ${body.defaultListId ?? null}
      )
      returning id
    `;
    await touchHousehold(sql, householdId);
    return json({ id: Number(rows[0]!.id) }, 201);
  }

  if (parts[0] === "filters" && parts.length === 2 && method === "PATCH") {
    const itemId = Number(parts[1]);
    const body = z
      .object({
        name: z.string().trim().min(1).max(80).optional(),
        intervalDays: z.number().int().min(7).max(1095).optional(),
        qtyNeeded: z.number().int().min(1).max(12).optional(),
        spareCount: z.number().int().min(0).max(24).optional(),
        lastReplacedAt: z.string().trim().nullable().optional(),
        stockLeadDays: z.number().int().min(0).max(1095).optional(),
        defaultListId: z.number().int().positive().nullable().optional(),
      })
      .parse(await readJson(request));
    const existing = await sql<{ id: number }>`
      select id from upkeep_items where id = ${itemId} and household_id = ${householdId} limit 1
    `;
    if (!existing[0]) return json({ error: "Filter not found" }, 404);
    if (body.defaultListId) await assertListInHousehold(sql, body.defaultListId, householdId);
    if (body.name) {
      await sql`update upkeep_items set name = ${body.name}, updated_at = now() where id = ${itemId} and household_id = ${householdId}`;
    }
    if (typeof body.intervalDays === "number") {
      await sql`update upkeep_items set interval_days = ${body.intervalDays}, updated_at = now() where id = ${itemId} and household_id = ${householdId}`;
    }
    if (typeof body.qtyNeeded === "number") {
      await sql`update upkeep_items set qty_needed = ${body.qtyNeeded}, updated_at = now() where id = ${itemId} and household_id = ${householdId}`;
    }
    if (typeof body.spareCount === "number") {
      await sql`update upkeep_items set spare_count = ${body.spareCount}, updated_at = now() where id = ${itemId} and household_id = ${householdId}`;
    }
    if (typeof body.lastReplacedAt !== "undefined") {
      await sql`update upkeep_items set last_replaced_at = ${body.lastReplacedAt || null}, updated_at = now() where id = ${itemId} and household_id = ${householdId}`;
    }
    if (typeof body.stockLeadDays === "number") {
      await sql`update upkeep_items set stock_lead_days = ${body.stockLeadDays}, updated_at = now() where id = ${itemId} and household_id = ${householdId}`;
    }
    if (typeof body.defaultListId !== "undefined") {
      await sql`update upkeep_items set default_list_id = ${body.defaultListId}, updated_at = now() where id = ${itemId} and household_id = ${householdId}`;
    }
    await touchHousehold(sql, householdId);
    return json({ ok: true });
  }

  if (parts[0] === "filters" && parts.length === 2 && method === "DELETE") {
    const rows = await sql<{ id: number }>`
      delete from upkeep_items
      where id = ${Number(parts[1])} and household_id = ${householdId}
      returning id
    `;
    if (!rows[0]) return json({ error: "Filter not found" }, 404);
    await touchHousehold(sql, householdId);
    return json({ ok: true });
  }

  return json({ error: "Not found" }, 404);
}

async function addItem(
  sql: Sql,
  membership: NonNullable<Awaited<ReturnType<typeof getMembership>>>,
  userId: string,
  listId: number | undefined,
  listName: string | undefined,
  body: { name: string; quantity?: string | null; notes?: string | null; staple?: boolean },
) {
  const householdId = Number(membership.id);
  const list = await findListId(sql, householdId, listId, listName);
  const existing = await sql<{ id: number; checked: boolean }>`
    select id, checked from list_items
    where list_id = ${list.id} and household_id = ${householdId} and lower(name) = lower(${body.name})
    limit 1
  `;
  const found = existing[0];
  if (found && !found.checked) return json({ id: Number(found.id), already: true });
  if (found && found.checked) {
    await sql`
      update list_items
      set checked = false, quantity = ${body.quantity || null}, notes = ${body.notes || null}, is_staple = ${Boolean(body.staple)}
      where id = ${found.id} and household_id = ${householdId}
    `;
    await touchHousehold(sql, householdId);
    const { notifyListAdd } = await import("./push-send");
    await notifyListAdd(sql, {
      membership,
      actorUserId: userId,
      listId: Number(list.id),
      listName: list.name,
      itemName: body.name,
    });
    return json({ id: Number(found.id), revived: true });
  }
  const rows = await sql<{ id: number }>`
    insert into list_items (household_id, list_id, name, quantity, notes, is_staple, added_by)
    values (
      ${householdId}, ${list.id}, ${body.name}, ${body.quantity || null}, ${body.notes || null},
      ${Boolean(body.staple)}, ${userId}
    )
    returning id
  `;
  await touchHousehold(sql, householdId);
  const { notifyListAdd } = await import("./push-send");
  await notifyListAdd(sql, {
    membership,
    actorUserId: userId,
    listId: Number(list.id),
    listName: list.name,
    itemName: body.name,
  });
  return json({ id: Number(rows[0]!.id) }, 201);
}
