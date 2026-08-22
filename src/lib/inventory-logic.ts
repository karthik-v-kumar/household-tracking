import type { InventoryLevel } from "@/lib/constants";

export function daysBetween(from: string | Date | null, to = new Date()): number | null {
  if (!from) return null;
  const start = from instanceof Date ? from : new Date(from);
  if (Number.isNaN(start.getTime())) return null;
  return Math.max(0, Math.floor((to.getTime() - start.getTime()) / 86_400_000));
}

export function effectiveInventoryLevel(input: {
  level: string;
  typicalDays: number | null;
  lastRestockedAt: string | Date | null;
}): InventoryLevel {
  const base = (["full", "ok", "low", "out"] as const).includes(input.level as InventoryLevel)
    ? (input.level as InventoryLevel)
    : "ok";
  if (base === "out") return "out";
  const days = daysBetween(input.lastRestockedAt);
  if (days == null || !input.typicalDays || input.typicalDays <= 0) return base;
  if (days >= input.typicalDays) return "out";
  if (days >= Math.round(input.typicalDays * 0.7)) {
    return base === "full" || base === "ok" ? "low" : base;
  }
  return base;
}

export function levelRank(level: InventoryLevel): number {
  return { out: 0, low: 1, ok: 2, full: 3 }[level];
}
