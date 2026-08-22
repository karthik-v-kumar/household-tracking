import type { LucideIcon } from "lucide-react";
import {
  Apple,
  Bath,
  Coffee,
  Milk,
  Package,
  Pill,
  ShoppingCart,
  Store,
  Warehouse,
  Leaf,
} from "lucide-react";
import type { ListColorId, ListIconId } from "@/lib/constants";

export const LIST_ICON_MAP: Record<ListIconId, LucideIcon> = {
  "shopping-cart": ShoppingCart,
  store: Store,
  warehouse: Warehouse,
  leaf: Leaf,
  pill: Pill,
  coffee: Coffee,
  apple: Apple,
  package: Package,
  bath: Bath,
  milk: Milk,
};

export const LIST_COLOR_CLASS: Record<ListColorId, string> = {
  sage: "bg-list-sage",
  clay: "bg-list-clay",
  slate: "bg-list-slate",
  olive: "bg-list-olive",
  wine: "bg-list-wine",
};

export const LIST_COLOR_TEXT: Record<ListColorId, string> = {
  sage: "text-list-sage",
  clay: "text-list-clay",
  slate: "text-list-slate",
  olive: "text-list-olive",
  wine: "text-list-wine",
};

export function isListIcon(value: string): value is ListIconId {
  return value in LIST_ICON_MAP;
}

export function isListColor(value: string): value is ListColorId {
  return value in LIST_COLOR_CLASS;
}

export function listIcon(id: string): LucideIcon {
  return isListIcon(id) ? LIST_ICON_MAP[id] : ShoppingCart;
}

export function listColor(id: string): ListColorId {
  return isListColor(id) ? id : "sage";
}
