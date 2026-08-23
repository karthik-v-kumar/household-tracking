/** YYYY-MM-DD for `<input type="date">`. */
export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Noon local, so a picked calendar day doesn't slip a timezone. */
export function fromDateInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return new Date().toISOString();
  const local = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(local.getTime())) return new Date().toISOString();
  return local.toISOString();
}

export function formatShortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
