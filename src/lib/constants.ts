export const APP_NAME = "Stocked";
export const APP_TAGLINE = "Weekend lists. A pantry that remembers.";

export const LIST_COLORS = [
  { id: "sage", label: "Sage" },
  { id: "clay", label: "Clay" },
  { id: "slate", label: "Slate" },
  { id: "olive", label: "Olive" },
  { id: "wine", label: "Wine" },
] as const;

export type ListColorId = (typeof LIST_COLORS)[number]["id"];

export const LIST_ICONS = [
  { id: "shopping-cart", label: "Cart" },
  { id: "store", label: "Store" },
  { id: "warehouse", label: "Warehouse" },
  { id: "leaf", label: "Produce" },
  { id: "pill", label: "Pharmacy" },
  { id: "coffee", label: "Cafe" },
  { id: "apple", label: "Market" },
  { id: "package", label: "Bulk" },
  { id: "bath", label: "Home" },
  { id: "milk", label: "Dairy" },
  { id: "shopping-bag", label: "Shop" },
  { id: "map-pin", label: "Errand" },
  { id: "wrench", label: "Hardware" },
  { id: "car", label: "Auto" },
  { id: "heart", label: "Pets" },
] as const;

export type ListIconId = (typeof LIST_ICONS)[number]["id"];

export const CATEGORIES = [
  { id: "produce", label: "Produce" },
  { id: "dairy", label: "Dairy" },
  { id: "meat", label: "Meat & seafood" },
  { id: "pantry", label: "Pantry" },
  { id: "frozen", label: "Frozen" },
  { id: "household", label: "Household" },
  { id: "personal", label: "Personal care" },
  { id: "other", label: "Other" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const INVENTORY_LEVELS = [
  { id: "full", label: "Full" },
  { id: "ok", label: "Okay" },
  { id: "low", label: "Low" },
  { id: "out", label: "Out" },
] as const;

export type InventoryLevel = (typeof INVENTORY_LEVELS)[number]["id"];

export const DEFAULT_LISTS: { name: string; icon: ListIconId; color: ListColorId }[] = [
  { name: "Grocery", icon: "shopping-cart", color: "sage" },
  { name: "Warehouse", icon: "warehouse", color: "clay" },
  { name: "Pharmacy", icon: "pill", color: "slate" },
];

export const QUICK_INVENTORY = [
  { name: "Toilet paper", category: "household" as const, typicalDays: 45 },
  { name: "Paper towels", category: "household" as const, typicalDays: 40 },
  { name: "Dish soap", category: "household" as const, typicalDays: 60 },
  { name: "Mouthwash", category: "personal" as const, typicalDays: 50 },
  { name: "Laundry detergent", category: "household" as const, typicalDays: 70 },
  { name: "Trash bags", category: "household" as const, typicalDays: 35 },
];

export const REPLACE_INTERVALS = [
  { days: 30, label: "Every month" },
  { days: 60, label: "Every 2 months" },
  { days: 90, label: "Every 3 months" },
  { days: 180, label: "Every 6 months" },
  { days: 365, label: "Every year" },
] as const;

export const QUICK_FILTERS = [
  { name: "Furnace air filter", intervalDays: 90, qtyNeeded: 1 },
  { name: "Air purifier filter", intervalDays: 180, qtyNeeded: 1 },
  { name: "Fridge water filter", intervalDays: 180, qtyNeeded: 1 },
  { name: "Vacuum filter", intervalDays: 180, qtyNeeded: 1 },
  { name: "Air fryer filter", intervalDays: 90, qtyNeeded: 1 },
  { name: "Tesla Model Y cabin filter", intervalDays: 365, qtyNeeded: 2 },
] as const;
