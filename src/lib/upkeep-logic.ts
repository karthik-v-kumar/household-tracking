import { daysBetween } from "@/lib/inventory-logic";

export type UpkeepStatus = "due" | "soon" | "buy" | "ok";

export function describeUpkeep(input: {
  intervalDays: number;
  lastReplacedAt: string | null;
  spareCount: number;
  qtyNeeded: number;
}): {
  status: UpkeepStatus;
  daysUntil: number | null;
  daysSince: number | null;
  needToBuy: boolean;
  buyQty: number;
} {
  const qty = Math.max(1, input.qtyNeeded);
  const spare = Math.max(0, input.spareCount);
  const daysSince = daysBetween(input.lastReplacedAt);
  const daysUntil =
    daysSince == null ? null : input.intervalDays - daysSince;
  const needToBuy = spare < qty;
  const buyQty = Math.max(0, qty - spare);

  let status: UpkeepStatus = "ok";
  if (daysUntil != null && daysUntil <= 0) status = "due";
  else if (daysUntil != null && daysUntil <= 14) status = "soon";
  else if (needToBuy) status = "buy";

  return { status, daysUntil, daysSince, needToBuy, buyQty };
}

export function upkeepRank(status: UpkeepStatus): number {
  return { due: 0, soon: 1, buy: 2, ok: 3 }[status];
}

export function formatUpkeepDue(daysUntil: number | null): string {
  if (daysUntil == null) return "Set last changed to start the clock";
  if (daysUntil < 0) return `Due ${-daysUntil}d ago`;
  if (daysUntil === 0) return "Due today";
  return `Due in ${daysUntil}d`;
}
