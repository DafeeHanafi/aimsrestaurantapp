import type { Order, SalesRow } from "./types";

export function money(n: number) {
  return "$" + Number(n).toFixed(2);
}

export function businessDate(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}

export function ticketCall(order: Pick<Order, "ticket_no" | "table_number">) {
  const no = order?.ticket_no != null ? order.ticket_no : "";
  const table = order?.table_number || "--";
  return no === "" ? "T" + table : "T" + table + " #" + no;
}

export function typeLabel(t?: string) {
  return t === "bungkus" ? "Bungkus" : "Dine-In";
}

function csvCell(v: unknown) {
  const s = String(v == null ? "" : v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function downloadSalesCsv(rows: SalesRow[], from: string, to: string) {
  const headers = [
    "datetime",
    "ticket",
    "table",
    "source",
    "order_type",
    "item_name",
    "qty",
    "unit_price",
    "line_total",
    "order_id",
    "status",
    "settled",
    "kitchen_notes"
  ] as const;
  const lines = [headers.join(",")].concat(
    rows.map((r) =>
      headers
        .map((h) => {
          if (h === "unit_price" || h === "line_total") return Number(r[h]).toFixed(2);
          return csvCell(r[h]);
        })
        .join(",")
    )
  );
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "aims-sales-" + (from || "all") + "-to-" + (to || "all") + ".csv";
  a.click();
  URL.revokeObjectURL(a.href);
}
