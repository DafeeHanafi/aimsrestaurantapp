import { TABLES } from "./menu";

export function normalizeTable(raw: string | null | undefined) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  const t = digits.padStart(2, "0").slice(-2);
  return TABLES.includes(t) ? t : "";
}

export function isOpenTable(raw: string | null | undefined) {
  return TABLES.includes(normalizeTable(raw));
}
