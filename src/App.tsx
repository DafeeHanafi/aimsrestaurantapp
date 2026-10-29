import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CATS, MENU, PROTEINS, TABLES, VEGGIES } from "./lib/menu";
import { businessDate, downloadSalesCsv, money, ticketCall, typeLabel } from "./lib/format";
import {
  closeTableBill,
  insertOrder,
  loadDayClose,
  loadOrdersWithItems,
  toSalesRows,
  trayAsItems,
  upsertDayClose
} from "./lib/orders";
import { connectBackend } from "./lib/supabase";
import type { DayClose, MenuItem, Order, OrderType, SalesRow, TrayLine, View } from "./lib/types";

function parseView(): View {
  const v = new URLSearchParams(location.search).get("view");
  if (v === "pos" || v === "kds" || v === "bill" || v === "z" || v === "accounts") return v;
  return "menu";
}

function parseTable() {
  return new URLSearchParams(location.search).get("table") || "";
}

function setQuery(view: View, table?: string) {
  const p = new URLSearchParams(location.search);
  p.set("view", view);
  if (table) p.set("table", table);
  history.replaceState({}, "", "?" + p.toString());
}

export default function App() {
  const [sb, setSb] = useState<SupabaseClient | null>(null);
  const [backendLabel, setBackendLabel] = useState("connecting");
  const [view, setView] = useState<View>(parseView);
  const [table, setTable] = useState(parseTable);
  const [toast, setToast] = useState("");
  const [lastCall, setLastCall] = useState("");
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [tray, setTray] = useState<TrayLine[]>([]);
  const [orderType, setOrderType] = useState<OrderType | "">("");
  const [notes, setNotes] = useState("");
  const [modal, setModal] = useState(false);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [posTable, setPosTable] = useState(parseTable() || "01");
  const [posType, setPosType] = useState<OrderType>("dine_in");
  const [posProtein, setPosProtein] = useState<string[]>([]);
  const [posVeg, setPosVeg] = useState<string[]>([]);
  const [tickets, setTickets] = useState<Order[]>([]);
  const [kdsFilter, setKdsFilter] = useState("preparing");
  const [kdsLoading, setKdsLoading] = useState(false);
  const [kdsError, setKdsError] = useState("");
  const [sending, setSending] = useState(false);
  const [salesRows, setSalesRows] = useState<SalesRow[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState("");
  const [salesFrom, setSalesFrom] = useState("");
  const [salesTo, setSalesTo] = useState("");
  const [billTable, setBillTable] = useState(parseTable() || "04");
  const [billOrders, setBillOrders] = useState<Order[]>([]);
  const [billLoading, setBillLoading] = useState(false);
  const [billError, setBillError] = useState("");
  const [dayClose, setDayClose] = useState<DayClose | null>(null);

  const ping = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2800);
  }, []);

  const go = useCallback((next: View, extraTable?: string) => {
    const t = extraTable || table;
    setView(next);
    if (extraTable) {
      setTable(extraTable);
      setBillTable(extraTable);
      setPosTable(extraTable);
    }
    setQuery(next, extraTable || table || undefined);
  }, [table]);

  useEffect(() => {
    const key = "aims-tray-" + (table || "none");
    try {
      setTray(JSON.parse(localStorage.getItem(key) || "[]"));
    } catch {
      setTray([]);
    }
  }, [table]);

  useEffect(() => {
    localStorage.setItem("aims-tray-" + (table || "none"), JSON.stringify(tray));
  }, [table, tray]);

  const loadTickets = useCallback(async (client: SupabaseClient) => {
    setKdsLoading(true);
    setKdsError("");
    try {
      setTickets(await loadOrdersWithItems(client, 80));
    } catch (e) {
      setKdsError(e instanceof Error ? e.message : String(e));
      setTickets([]);
    }
    setKdsLoading(false);
  }, []);

  const loadSales = useCallback(async (client: SupabaseClient) => {
    setSalesLoading(true);
    setSalesError("");
    try {
      const orders = await loadOrdersWithItems(client, 500);
      setSalesRows(toSalesRows(orders));
      setDayClose(await loadDayClose(client));
    } catch (e) {
      setSalesError(e instanceof Error ? e.message : String(e));
      setSalesRows([]);
    }
    setSalesLoading(false);
  }, []);

  const loadBill = useCallback(async (client: SupabaseClient, tbl: string) => {
    setBillLoading(true);
    setBillError("");
    try {
      const orders = await loadOrdersWithItems(client, 500);
      setBillOrders(orders.filter((o) => o.table_number === tbl));
    } catch (e) {
      setBillError(e instanceof Error ? e.message : String(e));
      setBillOrders([]);
    }
    setBillLoading(false);
  }, []);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const { sb: client, label } = await connectBackend();
      setSb(client);
      setBackendLabel(label);
      const today = businessDate();
      const from = new Date();
      from.setDate(from.getDate() - 29);
      setSalesFrom(businessDate(from.toISOString()));
      setSalesTo(today);
      const channel = client
        .channel("kds-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
          const v = parseView();
          if (v === "kds") loadTickets(client);
          if (v === "accounts" || v === "z") loadSales(client);
          if (v === "bill") loadBill(client, parseTable() || "04");
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
          const v = parseView();
          if (v === "kds") loadTickets(client);
          if (v === "accounts" || v === "z") loadSales(client);
          if (v === "bill") loadBill(client, parseTable() || "04");
        })
        .subscribe();
      unsub = () => {
        client.removeChannel(channel);
      };
      const v = parseView();
      if (v === "kds") await loadTickets(client);
      else if (v === "accounts" || v === "z") await loadSales(client);
      else if (v === "bill") await loadBill(client, parseTable() || "04");
    })();
    return () => unsub?.();
  }, [loadBill, loadSales, loadTickets]);

  useEffect(() => {
    if (!sb) return;
    if (view === "kds") loadTickets(sb);
    if (view === "accounts" || view === "z") loadSales(sb);
    if (view === "bill") loadBill(sb, billTable);
  }, [view, billTable, sb, loadBill, loadSales, loadTickets]);

  const trayCount = tray.reduce((s, i) => s + i.qty, 0);
  const trayTotal = tray.reduce((s, i) => s + i.qty * i.price, 0);
  const posTotal = posProtein.reduce((s, id) => s + (PROTEINS.find((x) => x.id === id)?.price || 0), 0) + posVeg.length;

  function addItem(item: MenuItem) {
    const option = item.options ? choice[item.id] || item.options[0] : undefined;
    const temp = item.hot != null ? choice[item.id + "-t"] || "Hot" : undefined;
    const name = [item.name, option, temp].filter(Boolean).join(" · ");
    const price = item.hot != null ? (temp === "Cold" ? item.cold! : item.hot) : item.price!;
    setTray((prev) => {
      const found = prev.find((t) => t.name === name && t.price === price);
      if (found) return prev.map((t) => (t === found ? { ...t, qty: t.qty + 1 } : t));
      return [...prev, { name, price, qty: 1 }];
    });
  }

  async function submitGuest() {
    if (!sb) return;
    if (!table) return ping("Set a table number first");
    if (!tray.length) return ping("Tray is empty");
    if (!orderType) {
      setModal(true);
      return ping("Choose Dine-In or Bungkus");
    }
    setSending(true);
    try {
      const data = await insertOrder(sb, {
        table_number: table,
        order_type: orderType,
        source: "guest",
        kitchen_notes: notes,
        total: trayTotal,
        items: trayAsItems(tray)
      });
      setTray([]);
      setNotes("");
      setOrderType("");
      setModal(false);
      const call = ticketCall(data);
      setLastCall(call);
      ping("Sent " + call + " to kitchen");
    } catch (e) {
      ping(e instanceof Error ? e.message : String(e));
    }
    setSending(false);
  }

  async function sendPlate() {
    if (!sb) return;
    if (!posProtein.length) return ping("Pick a protein");
    setSending(true);
    const items = [
      ...posProtein.map((id) => {
        const p = PROTEINS.find((x) => x.id === id)!;
        return { name: p.name, qty: 1, unit_price: p.price };
      }),
      ...posVeg.map((id) => {
        const v = VEGGIES.find((x) => x.id === id)!;
        return { name: v.name, qty: 1, unit_price: v.price };
      })
    ];
    try {
      const data = await insertOrder(sb, {
        table_number: posTable,
        order_type: posType,
        source: "pos",
        kitchen_notes: "Nasi Campur plate",
        total: posTotal,
        items
      });
      setPosProtein([]);
      setPosVeg([]);
      const call = ticketCall(data);
      setLastCall(call);
      ping("Plate " + call + " on table " + posTable);
    } catch (e) {
      ping(e instanceof Error ? e.message : String(e));
    }
    setSending(false);
  }

  const salesFiltered = useMemo(
    () =>
      salesRows.filter((r) => {
        const day = r.business_date || businessDate(r.datetime);
        if (salesFrom && day < salesFrom) return false;
        if (salesTo && day > salesTo) return false;
        return true;
      }),
    [salesRows, salesFrom, salesTo]
  );
  const today = businessDate();
  const todayRows = salesRows.filter((r) => (r.business_date || businessDate(r.datetime)) === today);

  const nav = (
    <header className="sticky top-0 z-30 backdrop-blur bg-kraft/80 border-b border-ink/10">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.25em] uppercase text-teak">Aims Solution</p>
          <h1 className="font-display text-2xl leading-none">IFM Kopitiam</h1>
          <p className="text-[10px] text-ink/50">{backendLabel}</p>
        </div>
        <nav className="flex flex-wrap gap-1 justify-end">
          {(
            [
              ["menu", "Menu", "fa-utensils"],
              ["pos", "POS", "fa-cash-register"],
              ["kds", "KDS", "fa-fire-burner"],
              ["bill", "Bills", "fa-receipt"],
              ["z", "Z", "fa-chart-simple"],
              ["accounts", "Accts", "fa-file-csv"]
            ] as const
          ).map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => go(id)}
              className={`px-3 py-2 rounded-full text-sm ${view === id ? "bg-ink text-kraft" : "bg-white/70"}`}
            >
              <i className={`fa-solid ${icon} mr-1`} />
              {label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );

  const toastEl = toast ? (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-ink text-kraft px-4 py-2 rounded-full text-sm">{toast}</div>
  ) : null;

  const lastCallBanner = lastCall ? (
    <div className="max-w-5xl mx-auto px-4 pt-4">
      <div className="bg-pandan text-white rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
        <p className="font-bold">Kitchen ticket {lastCall}</p>
        <button className="text-sm underline" onClick={() => setLastCall("")}>
          OK
        </button>
      </div>
    </div>
  ) : null;

  let page: ReactNode = null;

  if (view === "pos") {
    page = (
      <main className="max-w-5xl mx-auto px-4 py-6">
        <p className="uppercase tracking-[0.2em] text-teak text-xs">Nasi Campur counter</p>
        <h2 className="font-display text-4xl mb-4">3-second plate</h2>
        <p className="mb-4 text-sm">Tap protein and $1.00 sides, then send to the table bill. No rice charge.</p>
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-4">
          {TABLES.map((t) => (
            <button key={t} onClick={() => setPosTable(t)} className={`py-2 rounded-lg ${posTable === t ? "bg-ink text-kraft" : "bg-white"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mb-5">
          <button onClick={() => setPosType("dine_in")} className={`px-4 py-2 rounded-xl ${posType === "dine_in" ? "bg-pandan text-white" : "bg-white"}`}>
            Dine-In
          </button>
          <button onClick={() => setPosType("bungkus")} className={`px-4 py-2 rounded-xl ${posType === "bungkus" ? "bg-chili text-white" : "bg-white"}`}>
            Bungkus
          </button>
        </div>
        <h3 className="font-bold mb-2">Protein</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
          {PROTEINS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPosProtein((arr) => (arr.includes(p.id) ? arr.filter((x) => x !== p.id) : [...arr, p.id]))}
              className={`p-4 rounded-2xl text-left ${posProtein.includes(p.id) ? "bg-chili text-white" : "bg-white"}`}
            >
              <span className="block font-bold">{p.name}</span>
              {money(p.price)}
            </button>
          ))}
        </div>
        <h3 className="font-bold mb-2">Veggie / add-on · $1.00</h3>
        <div className="flex flex-wrap gap-2 mb-8">
          {VEGGIES.map((v) => (
            <button
              key={v.id}
              onClick={() => setPosVeg((arr) => (arr.includes(v.id) ? arr.filter((x) => x !== v.id) : [...arr, v.id]))}
              className={`px-4 py-2 rounded-full ${posVeg.includes(v.id) ? "chip-on" : "bg-white"}`}
            >
              {v.name}
            </button>
          ))}
        </div>
        <button onClick={sendPlate} disabled={sending} className="w-full bg-ink text-kraft rounded-2xl py-4 text-xl font-display ticket">
          Send plate · Table {posTable} · {money(posTotal)}
        </button>
        <button onClick={() => go("bill", posTable)} className="mt-3 w-full bg-white rounded-2xl py-3 font-bold">
          Open Table {posTable} bill
        </button>
      </main>
    );
  } else if (view === "kds") {
    const list = tickets.filter((t) => kdsFilter === "all" || t.status === kdsFilter);
    const next: Record<string, string> = { preparing: "ready", ready: "done" };
    page = (
      <main className="max-w-6xl mx-auto px-4 py-6">
        <h2 className="font-display text-4xl mb-4">Kitchen</h2>
        <div className="flex gap-2 mb-5">
          {["preparing", "ready", "done", "all"].map((f) => (
            <button key={f} onClick={() => setKdsFilter(f)} className={`px-3 py-1 rounded-full capitalize ${kdsFilter === f ? "chip-on" : "bg-white"}`}>
              {f}
            </button>
          ))}
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kdsLoading ? (
            <p>Loading tickets…</p>
          ) : kdsError ? (
            <p className="text-chili">{kdsError}</p>
          ) : list.length ? (
            list.map((t) => (
              <article key={t.id} className={`bg-white rounded-2xl p-4 ticket ${t.status === "preparing" ? "border-2 border-chili" : ""}`}>
                <div className="flex justify-between items-start gap-2">
                  <p className="font-display text-3xl leading-none">{ticketCall(t)}</p>
                  <p className="text-xs uppercase text-right">
                    {typeLabel(t.order_type)} · {t.source}
                  </p>
                </div>
                <ul className="mt-2 text-sm space-y-1">
                  {(t.order_items || []).map((i) => (
                    <li key={i.id}>
                      {i.qty} × {i.name}
                    </li>
                  ))}
                </ul>
                {t.kitchen_notes ? <p className="mt-2 text-chili text-sm">{t.kitchen_notes}</p> : null}
                <p className="mt-2 font-bold">{money(Number(t.total))}</p>
                {next[t.status] ? (
                  <button
                    className="mt-3 w-full bg-ink text-kraft rounded-xl py-2 capitalize"
                    onClick={async () => {
                      if (!sb) return;
                      await sb.from("orders").update({ status: next[t.status] }).eq("id", t.id);
                      await loadTickets(sb);
                    }}
                  >
                    {t.status} → {next[t.status]}
                  </button>
                ) : (
                  <p className="mt-3 text-pandan text-sm">Done</p>
                )}
              </article>
            ))
          ) : (
            <p>No tickets in this lane.</p>
          )}
        </div>
      </main>
    );
  } else if (view === "accounts") {
    const sum = salesFiltered.reduce((s, r) => s + r.line_total, 0);
    page = (
      <main className="max-w-6xl mx-auto px-4 py-6">
        <h2 className="font-display text-4xl mb-1">Accounting</h2>
        <p className="text-sm mb-4">Sold item lines from guest ala carte and POS Nasi Campur.</p>
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <label className="text-sm">
            From
            <input type="date" value={salesFrom} onChange={(e) => setSalesFrom(e.target.value)} className="ml-2 bg-white rounded-lg px-2 py-1 border border-ink/20" />
          </label>
          <label className="text-sm">
            To
            <input type="date" value={salesTo} onChange={(e) => setSalesTo(e.target.value)} className="ml-2 bg-white rounded-lg px-2 py-1 border border-ink/20" />
          </label>
          <button onClick={() => sb && loadSales(sb)} className="px-3 py-2 rounded-xl bg-white border border-ink/20 text-sm">
            Refresh
          </button>
          <button
            onClick={() => {
              downloadSalesCsv(salesFiltered, salesFrom, salesTo);
              ping("Exported " + salesFiltered.length + " sold lines");
            }}
            className="px-3 py-2 rounded-xl bg-ink text-kraft text-sm font-bold"
          >
            Export Excel CSV
          </button>
          <p className="text-sm">
            {salesFiltered.length} lines · {money(sum)}
          </p>
        </div>
        {salesLoading ? (
          <p>Loading sales…</p>
        ) : salesError ? (
          <p className="text-chili">{salesError}</p>
        ) : (
          <div className="overflow-x-auto bg-white/80 rounded-2xl border border-ink/10">
            <table className="min-w-full text-sm">
              <thead className="bg-ink text-kraft text-left">
                <tr>
                  {["Datetime", "Ticket", "Table", "Source", "Type", "Item", "Qty", "Unit", "Line", "Status", "Notes"].map((h) => (
                    <th key={h} className="px-3 py-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {salesFiltered.length ? (
                  salesFiltered.map((r) => (
                    <tr key={r.order_id + r.item_name + r.datetime} className="border-t border-ink/10">
                      <td className="px-3 py-2 whitespace-nowrap">{r.datetime}</td>
                      <td className="px-3 py-2">{r.ticket}</td>
                      <td className="px-3 py-2">{r.table}</td>
                      <td className="px-3 py-2">{r.source}</td>
                      <td className="px-3 py-2">{(r.order_type || "").replace("_", "-")}</td>
                      <td className="px-3 py-2">{r.item_name}</td>
                      <td className="px-3 py-2">{r.qty}</td>
                      <td className="px-3 py-2">{money(r.unit_price)}</td>
                      <td className="px-3 py-2 font-bold">{money(r.line_total)}</td>
                      <td className="px-3 py-2">{r.status}</td>
                      <td className="px-3 py-2">{r.kitchen_notes}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-4" colSpan={11}>
                      No sold lines in this date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    );
  } else if (view === "bill") {
    const open = billOrders.filter((o) => !o.settled);
    const closed = billOrders.filter((o) => o.settled);
    const flatten = (orders: Order[]) =>
      orders.flatMap((order) =>
        (order.order_items || []).map((item) => {
          const qty = Number(item.qty) || 0;
          const unit = Number(item.unit_price) || 0;
          return {
            key: item.id,
            ticket: ticketCall(order),
            source: order.source,
            order_type: order.order_type,
            name: item.name,
            qty,
            unit,
            line: Math.round(qty * unit * 100) / 100,
            settled: !!order.settled
          };
        })
      );
    const openLines = flatten(open);
    const closedLines = flatten(closed);
    const total = openLines.reduce((s, r) => s + r.line, 0);
    const lineRow = (r: (typeof openLines)[0]) => (
      <tr key={r.key} className={`border-t border-ink/10 ${r.settled ? "opacity-50" : ""}`}>
        <td className="px-3 py-2 font-bold">{r.ticket}</td>
        <td className="px-3 py-2">{r.source}</td>
        <td className="px-3 py-2">{typeLabel(r.order_type)}</td>
        <td className="px-3 py-2">{r.name}</td>
        <td className="px-3 py-2">{r.qty}</td>
        <td className="px-3 py-2">{money(r.unit)}</td>
        <td className="px-3 py-2 font-bold">{money(r.line)}</td>
      </tr>
    );
    page = (
      <main className="max-w-6xl mx-auto px-4 py-6">
        <h2 className="font-display text-4xl mb-1">Table bills</h2>
        <p className="text-sm mb-4">Master bill combines guest à la carte and Nasi Campur POS. Close bill settles the table. History stays.</p>
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-5">
          {TABLES.map((t) => (
            <button
              key={t}
              onClick={() => {
                setBillTable(t);
                setQuery("bill", t);
              }}
              className={`py-2 rounded-lg ${billTable === t ? "bg-ink text-kraft" : "bg-white"}`}
            >
              {t}
            </button>
          ))}
        </div>
        {billLoading ? (
          <p>Loading bill…</p>
        ) : billError ? (
          <p className="text-chili">{billError}</p>
        ) : (
          <>
            <section className="bg-white/80 rounded-2xl border border-ink/10 p-4 mb-5">
              <div className="flex flex-wrap justify-between gap-3 items-end mb-3">
                <div>
                  <p className="uppercase tracking-[0.2em] text-teak text-xs">Open bill</p>
                  <h3 className="font-display text-3xl">Table {billTable}</h3>
                </div>
                <p className="font-display text-4xl">{money(total)}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-ink/60">
                    <tr>
                      {["Ticket", "Source", "Type", "Item", "Qty", "Unit", "Line"].map((h) => (
                        <th key={h} className="px-3 py-2">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {openLines.length ? (
                      openLines.map(lineRow)
                    ) : (
                      <tr>
                        <td className="px-3 py-4" colSpan={7}>
                          No open items.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <button
                disabled={!openLines.length}
                onClick={async () => {
                  if (!sb) return;
                  const ids = open.map((o) => o.id);
                  if (!ids.length) return ping("This table bill is already closed");
                  try {
                    await closeTableBill(sb, ids);
                    ping("Table " + billTable + " bill closed · history kept");
                    await loadBill(sb, billTable);
                  } catch (e) {
                    ping(e instanceof Error ? e.message : String(e));
                  }
                }}
                className="mt-4 w-full bg-chili text-white rounded-2xl py-3 font-bold disabled:opacity-40"
              >
                Close bill · Table {billTable} · {money(total)}
              </button>
            </section>
            {closedLines.length ? (
              <section>
                <h3 className="font-bold mb-2">Settled this table (kept for accounts)</h3>
                <div className="overflow-x-auto bg-white/60 rounded-2xl border border-ink/10">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-ink/60">
                      <tr>
                        {["Ticket", "Source", "Type", "Item", "Qty", "Unit", "Line"].map((h) => (
                          <th key={h} className="px-3 py-2">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>{closedLines.map(lineRow)}</tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </>
        )}
      </main>
    );
  } else if (view === "z") {
    const byItem: Record<string, { name: string; qty: number; revenue: number }> = {};
    todayRows.forEach((r) => {
      if (!byItem[r.item_name]) byItem[r.item_name] = { name: r.item_name, qty: 0, revenue: 0 };
      byItem[r.item_name].qty += r.qty;
      byItem[r.item_name].revenue += r.line_total;
    });
    const items = Object.values(byItem).sort((a, b) => b.revenue - a.revenue);
    const dine = todayRows.filter((r) => r.order_type === "dine_in").reduce((s, r) => s + r.line_total, 0);
    const bung = todayRows.filter((r) => r.order_type === "bungkus").reduce((s, r) => s + r.line_total, 0);
    page = (
      <main className="max-w-6xl mx-auto px-4 py-6">
        <h2 className="font-display text-4xl mb-1">Z-report</h2>
        <p className="text-sm mb-4">Today {today} (Singapore). Close day stamps this snapshot.</p>
        {dayClose ? (
          <p className="mb-4 text-pandan font-bold">
            Day closed {dayClose.closed_at} · {money(Number(dayClose.revenue))}
          </p>
        ) : (
          <p className="mb-4 text-sm text-ink/70">Day still open.</p>
        )}
        <div className="grid sm:grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-2xl p-4">
            <p className="text-xs uppercase text-teak">Dine-In</p>
            <p className="font-display text-3xl">{money(dine)}</p>
          </div>
          <div className="bg-white rounded-2xl p-4">
            <p className="text-xs uppercase text-teak">Bungkus</p>
            <p className="font-display text-3xl">{money(bung)}</p>
          </div>
          <div className="bg-white rounded-2xl p-4">
            <p className="text-xs uppercase text-teak">Revenue</p>
            <p className="font-display text-3xl">{money(dine + bung)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => sb && loadSales(sb)} className="px-3 py-2 rounded-xl bg-white border border-ink/20 text-sm">
            Refresh
          </button>
          <button
            onClick={() => {
              downloadSalesCsv(todayRows, today, today);
              ping("Exported " + todayRows.length + " sold lines");
            }}
            className="px-3 py-2 rounded-xl bg-ink text-kraft text-sm font-bold"
          >
            Export today CSV
          </button>
          <button
            onClick={async () => {
              if (!sb) return;
              try {
                const payload = await upsertDayClose(sb, todayRows);
                ping("Day closed · " + payload.business_date + " · " + money(payload.revenue));
                setDayClose(await loadDayClose(sb));
              } catch (e) {
                ping(e instanceof Error ? e.message : String(e));
              }
            }}
            className="px-3 py-2 rounded-xl bg-chili text-white text-sm font-bold"
          >
            Close day
          </button>
        </div>
        {salesLoading ? (
          <p>Loading…</p>
        ) : salesError ? (
          <p className="text-chili">{salesError}</p>
        ) : (
          <div className="overflow-x-auto bg-white/80 rounded-2xl border border-ink/10">
            <table className="min-w-full text-sm">
              <thead className="bg-ink text-kraft text-left">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {items.length ? (
                  items.map((i) => (
                    <tr key={i.name} className="border-t border-ink/10">
                      <td className="px-3 py-2">{i.name}</td>
                      <td className="px-3 py-2">{i.qty}</td>
                      <td className="px-3 py-2 font-bold">{money(i.revenue)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-4" colSpan={3}>
                      No sales yet today.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    );
  } else {
    const cats = MENU.filter((c) => cat === "All" || c.cat === cat);
    page = (
      <>
        <main className="max-w-5xl mx-auto px-4 pb-52 pt-6">
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <label className="text-sm">
              Table
              <select
                value={table}
                onChange={(e) => {
                  const t = e.target.value;
                  setTable(t);
                  setQuery("menu", t || undefined);
                }}
                className="ml-2 bg-white rounded-lg px-2 py-1 border border-ink/20"
              >
                <option value="">Select</option>
                {TABLES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search menu" className="flex-1 min-w-[160px] bg-white rounded-lg px-3 py-2 border border-ink/20" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
            {CATS.map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`whitespace-nowrap px-3 py-1 rounded-full border ${cat === c ? "chip-on" : "bg-white border-ink/15"}`}>
                {c}
              </button>
            ))}
          </div>
          {cats.map((c) => {
            const items = c.items.filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase()) || (i.desc || "").toLowerCase().includes(q.toLowerCase()));
            if (!items.length) return null;
            return (
              <section key={c.cat} className="mb-8">
                <h2 className="font-display text-3xl mb-3">{c.cat}</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {items.map((item) => {
                    const drink = choice[item.id] || (item.options && item.options[0]) || "";
                    const temp = choice[item.id + "-t"] || "Hot";
                    return (
                      <article key={item.id} className="bg-white/80 border border-ink/10 rounded-2xl p-4">
                        <div className="flex justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-lg">{item.name}</h3>
                            {item.desc ? <p className="text-sm text-ink/70">{item.desc}</p> : null}
                          </div>
                          <p className="font-display text-xl">{item.hot != null ? money(item.hot) + " / " + money(item.cold!) : money(item.price!)}</p>
                        </div>
                        {item.options ? (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {item.options.map((o) => (
                              <button key={o} onClick={() => setChoice((c) => ({ ...c, [item.id]: o }))} className={`text-xs px-2 py-1 rounded-full border ${drink === o ? "chip-on" : "border-ink/20"}`}>
                                {o}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {item.hot != null ? (
                          <div className="flex gap-2 mt-3">
                            {["Hot", "Cold"].map((t) => (
                              <button key={t} onClick={() => setChoice((c) => ({ ...c, [item.id + "-t"]: t }))} className={`text-xs px-2 py-1 rounded-full border ${temp === t ? "chip-on" : "border-ink/20"}`}>
                                {t}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <button onClick={() => addItem(item)} className="mt-3 w-full bg-chili text-white rounded-xl py-2 text-sm font-bold">
                          + Add to Tray
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </main>
        <div className="fixed bottom-0 inset-x-0 z-40 border-t-4 border-chili bg-kraft/95 px-4 py-3">
          <p className="text-center font-bold text-sm mb-2">How do you want this order?</p>
          <div className="max-w-md mx-auto grid grid-cols-2 gap-2 mb-2">
            <button onClick={() => setOrderType("dine_in")} className={`py-3 rounded-2xl font-bold text-lg ${orderType === "dine_in" ? "bg-pandan text-white" : "bg-white border-2 border-ink/20"}`}>
              Dine-In
            </button>
            <button onClick={() => setOrderType("bungkus")} className={`py-3 rounded-2xl font-bold text-lg ${orderType === "bungkus" ? "bg-chili text-white" : "bg-white border-2 border-ink/20"}`}>
              Bungkus
            </button>
          </div>
          <button onClick={() => setModal(true)} className="max-w-md mx-auto block w-full bg-ink text-kraft rounded-2xl px-4 py-3 font-bold">
            <i className="fa-solid fa-bowl-food mr-2" />
            Checkout tray {trayCount} · {money(trayTotal)}
            {orderType ? " · " + (orderType === "bungkus" ? "Bungkus" : "Dine-In") : ""}
          </button>
        </div>
        {modal ? (
          <div className="fixed inset-0 bg-ink/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setModal(false)}>
            <div className="bg-kraft w-full max-w-md rounded-3xl p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-display text-2xl">Table {table || "--"} tray</h3>
                <button onClick={() => setModal(false)}>
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
              {tray.length ? (
                tray.map((t) => (
                  <div key={t.name} className="flex items-center justify-between py-2 border-b border-ink/10">
                    <div>
                      <p className="font-bold">{t.name}</p>
                      <p className="text-sm">{money(t.price)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="w-8 h-8 rounded-full bg-white" onClick={() => setTray((prev) => prev.map((x) => (x.name === t.name ? { ...x, qty: x.qty - 1 } : x)).filter((x) => x.qty > 0))}>
                        -
                      </button>
                      <span>{t.qty}</span>
                      <button className="w-8 h-8 rounded-full bg-white" onClick={() => setTray((prev) => prev.map((x) => (x.name === t.name ? { ...x, qty: x.qty + 1 } : x)))}>
                        +
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-ink/70">Nothing in the tray yet.</p>
              )}
              <p className="mt-4 font-bold">
                Dine-In or Bungkus <span className="text-chili">*</span>
              </p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button onClick={() => setOrderType("dine_in")} className={`py-4 rounded-2xl font-bold text-lg ${orderType === "dine_in" ? "bg-pandan text-white" : "bg-white border-2 border-ink/20"}`}>
                  Dine-In
                </button>
                <button onClick={() => setOrderType("bungkus")} className={`py-4 rounded-2xl font-bold text-lg ${orderType === "bungkus" ? "bg-chili text-white" : "bg-white border-2 border-ink/20"}`}>
                  Bungkus
                </button>
              </div>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full mt-3 rounded-xl p-3 text-sm" placeholder="Kitchen notes" />
              <button
                onClick={submitGuest}
                disabled={sending || !orderType}
                className={`mt-3 w-full rounded-xl py-3 font-bold ${orderType ? "bg-chili text-white" : "bg-ink/20 text-ink/50"}`}
              >
                {orderType ? "Send " + (orderType === "bungkus" ? "Bungkus" : "Dine-In") + " · " + money(trayTotal) : "Pick Dine-In or Bungkus first"}
              </button>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div>
      {nav}
      {view === "menu" || view === "pos" ? lastCallBanner : null}
      {page}
      {toastEl}
    </div>
  );
}
