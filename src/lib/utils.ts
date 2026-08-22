import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isUnauthorized(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { message?: string; status?: number };
  return e.message === "Unauthorized" || e.status === 401;
}
