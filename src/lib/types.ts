import type { CategoryId, InventoryLevel, ListColorId, ListIconId } from "./constants";
import type { UpkeepStatus } from "./upkeep-logic";

export type HouseholdRole = "owner" | "member";

export type Household = {
  id: number;
  name: string;
  inviteCode: string;
  role: HouseholdRole;
  createdAt: string;
};

export type HouseholdMember = {
  userId: string;
  role: HouseholdRole;
  displayName: string;
  imageUrl: string | null;
  joinedAt: string;
  isYou: boolean;
};

export type ShoppingList = {
  id: number;
  name: string;
  icon: ListIconId;
  color: ListColorId;
  sortOrder: number;
  uncheckedCount: number;
  totalCount: number;
};

export type ListItem = {
  id: number;
  listId: number;
  catalogItemId: number | null;
  name: string;
  quantity: string | null;
  notes: string | null;
  checked: boolean;
  isStaple: boolean;
  addedBy: string;
  addedByName: string;
  createdAt: string;
};

export type CatalogItem = {
  id: number;
  name: string;
  category: CategoryId;
  defaultListId: number | null;
  isStaple: boolean;
};

export type InventoryItem = {
  id: number;
  name: string;
  category: CategoryId;
  level: InventoryLevel;
  effectiveLevel: InventoryLevel;
  typicalDays: number | null;
  lastRestockedAt: string | null;
  daysSinceRestock: number | null;
  defaultListId: number | null;
  defaultListName: string | null;
  notes: string | null;
  onAList: boolean;
};

export type UpkeepItem = {
  id: number;
  name: string;
  intervalDays: number;
  lastReplacedAt: string | null;
  spareCount: number;
  qtyNeeded: number;
  defaultListId: number | null;
  defaultListName: string | null;
  notes: string | null;
  onAList: boolean;
  status: UpkeepStatus;
  daysUntil: number | null;
  daysSince: number | null;
  needToBuy: boolean;
  buyQty: number;
};

export type Overview = {
  household: Household;
  members: HouseholdMember[];
  lists: ShoppingList[];
  lowInventory: InventoryItem[];
  dueUpkeep: UpkeepItem[];
};

export type ListDetail = {
  list: ShoppingList;
  items: ListItem[];
  usuals: { id: number; name: string; alreadyOnList: boolean }[];
};
