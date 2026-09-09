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
