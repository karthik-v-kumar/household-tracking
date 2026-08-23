import { daysBetween } from "@/lib/inventory-logic";

export type UpkeepStatus = "due" | "soon" | "buy" | "ok";

/** Days before a change to put a spare on a list. 0 = keep one on the shelf. */
export const DEFAULT_STOCK_LEAD_DAYS = 30;

export function describeUpkeep(input: {
  intervalDays: number;
  lastReplacedAt: string | null;
  spareCount: number;
  qtyNeeded: number;
  stockLeadDays?: number | null;
}): {
  status: UpkeepStatus;
  daysUntil: number | null;
  daysSince: number | null;
  needToBuy: boolean;
  buyQty: number;
  stockFromAt: string | null;
} {
  const qty = Math.max(1, input.qtyNeeded);
  const spare = Math.max(0, input.spareCount);
  const daysSince = daysBetween(input.lastReplacedAt);
  const daysUntil =
    daysSince == null ? null : input.intervalDays - daysSince;
  const lead = normalizeStockLead(input.stockLeadDays, input.intervalDays);
  const always = lead <= 0;
  const inWindow = daysUntil != null && daysUntil <= Math.max(lead, 0);
  const short = spare < qty;
  const needToBuy = short && (always || inWindow);
  const buyQty = needToBuy ? Math.max(0, qty - spare) : 0;
  const stockFromAt = stockFromDate(input.lastReplacedAt, input.intervalDays, lead);

  let status: UpkeepStatus = "ok";
  if (daysUntil != null && daysUntil <= 0) status = "due";
  else if (daysUntil != null && daysUntil <= 14) status = "soon";
  else if (needToBuy) status = "buy";

  return { status, daysUntil, daysSince, needToBuy, buyQty, stockFromAt };
}

export function normalizeStockLead(value: number | null | undefined, intervalDays: number): number {
  if (value == null || Number.isNaN(value)) return DEFAULT_STOCK_LEAD_DAYS;
  if (value <= 0) return 0;
  return Math.min(Math.round(value), Math.max(1, intervalDays));
}

export function stockFromDate(
  lastReplacedAt: string | null,
  intervalDays: number,
  stockLeadDays: number,
): string | null {
  if (!lastReplacedAt || stockLeadDays <= 0) return null;
  const start = new Date(lastReplacedAt);
  if (Number.isNaN(start.getTime())) return null;
  const from = new Date(start);
  from.setDate(from.getDate() + intervalDays - stockLeadDays);
  return from.toISOString();
}

export function upkeepRank(status: UpkeepStatus): number {
  return { due: 0, soon: 1, buy: 2, ok: 3 }[status];
}

export function formatUpkeepDue(daysUntil: number | null): string {
  if (daysUntil == null) return "Set last changed to start the clock";
  if (daysUntil < 0) return `Due ${-daysUntil}d ago`;
  if (daysUntil === 0) return "Due today";
  if (daysUntil >= 365) {
    const years = Math.round((daysUntil / 365) * 10) / 10;
    return `Due in ${years}y`;
  }
  return `Due in ${daysUntil}d`;
}
