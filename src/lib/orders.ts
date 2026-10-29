import type { SupabaseClient } from "@supabase/supabase-js";
import { businessDate, ticketCall } from "./format";
import type { DayClose, Order, OrderItem, OrderType, SalesRow, TrayLine } from "./types";

export async function loadOrdersWithItems(sb: SupabaseClient, limit = 400): Promise<Order[]> {
  const ordersRes = await sb.from("orders").select("*").order("created_at", { ascending: false }).limit(limit);
  if (ordersRes.error) throw new Error(ordersRes.error.message);
  const orders = (ordersRes.data || []) as Order[];
  const ids = orders.map((o) => o.id);
  let items: OrderItem[] = [];
  if (ids.length) {
    const itemsRes = await sb.from("order_items").select("*").in("order_id", ids);
    if (itemsRes.error) throw new Error(itemsRes.error.message);
    items = (itemsRes.data || []) as OrderItem[];
  }
  const byOrder: Record<string, OrderItem[]> = {};
  items.forEach((item) => {
    (byOrder[item.order_id] || (byOrder[item.order_id] = [])).push(item);
  });
  return orders.map((order) => ({
    ...order,
    status: String(order.status || "").trim(),
    order_items: byOrder[order.id] || []
  }));
}

export function toSalesRows(orders: Order[]): SalesRow[] {
  const rows: SalesRow[] = [];
  orders.forEach((order) => {
    (order.order_items || []).forEach((item) => {
      const qty = Number(item.qty) || 0;
      const unit = Number(item.unit_price) || 0;
      rows.push({
        datetime: order.created_at,
        business_date: businessDate(order.created_at),
        table: order.table_number,
        source: order.source,
        order_type: order.order_type,
        item_name: item.name,
        qty,
        unit_price: unit,
        line_total: Math.round(qty * unit * 100) / 100,
        order_id: order.id,
        ticket_no: order.ticket_no,
        ticket: ticketCall(order),
        settled: !!order.settled,
        status: order.status,
        kitchen_notes: order.kitchen_notes || ""
      });
    });
  });
  rows.sort((a, b) => String(b.datetime).localeCompare(String(a.datetime)));
  return rows;
}

export async function insertOrder(
  sb: SupabaseClient,
  payload: {
    table_number: string;
    order_type: OrderType;
    source: "guest" | "pos";
    kitchen_notes: string;
    total: number;
    items: { name: string; qty: number; unit_price: number }[];
  }
) {
  const { data, error } = await sb
    .from("orders")
    .insert({
      table_number: payload.table_number,
      order_type: payload.order_type,
      source: payload.source,
      kitchen_notes: payload.kitchen_notes,
      total: payload.total,
      status: "preparing",
      settled: false
    })
    .select("id, ticket_no, table_number")
    .single();
  if (error) throw new Error(error.message);
  const itemsRes = await sb.from("order_items").insert(
    payload.items.map((i) => ({
      order_id: data.id,
      name: i.name,
      qty: i.qty,
      unit_price: i.unit_price
    }))
  );
  if (itemsRes.error) throw new Error(itemsRes.error.message);
  return data as Pick<Order, "id" | "ticket_no" | "table_number">;
}

export function trayAsItems(tray: TrayLine[]) {
  return tray.map((t) => ({ name: t.name, qty: t.qty, unit_price: t.price }));
}

export async function closeTableBill(sb: SupabaseClient, ids: string[]) {
  const { error } = await sb.from("orders").update({ settled: true, settled_at: new Date().toISOString() }).in("id", ids);
  if (error) throw new Error(error.message);
}

export async function loadDayClose(sb: SupabaseClient) {
  const today = businessDate();
  const { data } = await sb.from("day_closes").select("*").eq("business_date", today).maybeSingle();
  return (data || null) as DayClose | null;
}

export async function upsertDayClose(sb: SupabaseClient, rows: SalesRow[]) {
  const dine = rows.filter((r) => r.order_type === "dine_in").reduce((s, r) => s + r.line_total, 0);
  const bung = rows.filter((r) => r.order_type === "bungkus").reduce((s, r) => s + r.line_total, 0);
  const revenue = dine + bung;
  const payload = {
    business_date: businessDate(),
    dine_in_total: Math.round(dine * 100) / 100,
    bungkus_total: Math.round(bung * 100) / 100,
    line_count: rows.length,
    revenue: Math.round(revenue * 100) / 100,
    note: "Z-report"
  };
  const { error } = await sb.from("day_closes").upsert(payload, { onConflict: "business_date" });
  if (error) throw new Error(error.message);
  return payload;
}
