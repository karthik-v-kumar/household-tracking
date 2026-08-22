import type { CategoryId, InventoryLevel } from "@/lib/constants";
import { CATEGORIES, INVENTORY_LEVELS } from "@/lib/constants";
import { daysBetween, effectiveInventoryLevel } from "@/lib/inventory-logic";
import type { InventoryItem } from "@/lib/types";
import { toIso } from "./access";

export type InventoryRow = {
  id: number;
  name: string;
  category: string;
  level: string;
  typical_days: number | null;
  last_restocked_at: string | Date | null;
  default_list_id: number | null;
  default_list_name: string | null;
  notes: string | null;
};

function asLevel(value: string): InventoryLevel {
  return INVENTORY_LEVELS.some((l) => l.id === value) ? (value as InventoryLevel) : "ok";
}

function asCategory(value: string): CategoryId {
  return CATEGORIES.some((c) => c.id === value) ? (value as CategoryId) : "other";
}

export function mapInventoryRow(row: InventoryRow, onAList: boolean): InventoryItem {
  const typicalDays = row.typical_days == null ? null : Number(row.typical_days);
  const lastRestockedAt = toIso(row.last_restocked_at);
  const level = asLevel(row.level);
  return {
    id: Number(row.id),
    name: row.name,
    category: asCategory(row.category),
    level,
    effectiveLevel: effectiveInventoryLevel({
      level,
      typicalDays,
      lastRestockedAt,
    }),
    typicalDays,
    lastRestockedAt,
    daysSinceRestock: daysBetween(lastRestockedAt),
    defaultListId: row.default_list_id == null ? null : Number(row.default_list_id),
    defaultListName: row.default_list_name,
    notes: row.notes,
    onAList,
  };
}
