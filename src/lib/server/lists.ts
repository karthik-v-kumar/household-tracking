import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { LIST_COLORS, LIST_ICONS } from "@/lib/constants";
import { levelRank } from "@/lib/inventory-logic";
import { upkeepRank } from "@/lib/upkeep-logic";
import type {
  CatalogItem,
  Household,
  HouseholdMember,
  InventoryItem,
  ListDetail,
  ListItem,
  Overview,
  ShoppingList,
  Usual,
} from "@/lib/types";
import type { Sql } from "@/lib/db";
import {
  assertListInHousehold,
  getSqlClient,
  requireMembership,
  toIso,
  touchHousehold,
  type MembershipRow,
} from "./access";
import { mapInventoryRow, type InventoryRow } from "./inventory-map";
import { mapUpkeepRow, type UpkeepRow } from "./upkeep";

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

async function loadUsuals(
  sql: Sql,
  householdId: number,
  onList: Set<string>,
): Promise<Usual[]> {
  const rows = await sql<{
    id: number;
    name: string;
    default_list_id: number | null;
    default_list_name: string | null;
  }>`
    select c.id, c.name, c.default_list_id, l.name as default_list_name
    from catalog_items c
    left join lists l on l.id = c.default_list_id
    where c.household_id = ${householdId} and c.is_staple = true
    order by c.name asc
  `;
  return rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    defaultListId: row.default_list_id == null ? null : Number(row.default_list_id),
    defaultListName: row.default_list_name,
    alreadyOnList: onList.has(row.name.toLowerCase()),
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

  let upkeepRows: UpkeepRow[] = [];
  try {
    upkeepRows = await sql<UpkeepRow>`
      select u.id, u.name, u.interval_days, u.last_replaced_at, u.spare_count,
             u.qty_needed, u.stock_lead_days, u.default_list_id, u.notes,
             l.name as default_list_name
      from upkeep_items u
      left join lists l on l.id = u.default_list_id
      where u.household_id = ${membership.id}
    `;
  } catch {
    upkeepRows = [];
  }

  const onList = new Set(onListRows.map((r) => r.name));
  const lowInventory = inventoryRows
    .map((row) => mapInventoryRow(row, onList.has(row.name.toLowerCase())))
    .filter((item) => (item.effectiveLevel === "low" || item.effectiveLevel === "out") && !item.onAList)
    .sort((a, b) => levelRank(a.effectiveLevel) - levelRank(b.effectiveLevel) || a.name.localeCompare(b.name));

  const dueUpkeep = upkeepRows
    .map((row) => mapUpkeepRow(row, onList.has(row.name.toLowerCase())))
    .filter((item) => item.status !== "ok")
    .sort((a, b) => upkeepRank(a.status) - upkeepRank(b.status) || a.name.localeCompare(b.name));

  const household: Household = {
    id: Number(membership.id),
    name: membership.name,
    inviteCode: membership.invite_code,
    role: membership.role === "owner" ? "owner" : "member",
    createdAt: toIso(membership.created_at) ?? new Date().toISOString(),
  };

  return { household, members, lists, lowInventory, dueUpkeep, usuals: await loadUsuals(sql, membership.id, onList) };
}
