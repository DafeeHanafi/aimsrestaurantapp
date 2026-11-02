import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CATS,
  MENU,
  PACKING,
  PACKING_NAME,
  TABLES,
  campurItems,
  campurTotal,
  defaultCampurCatalog,
  loadCampurCatalog,
  newCampurId,
  packingCount,
  packingFee,
  packingLine,
  saveCampurCatalog,
  type CampurItem
} from "./lib/menu";
import { campurSoldKey, isSold, loadSoldOut, menuSoldKey, saveSoldOut } from "./lib/floorBoard";
import { businessDate, downloadSalesCsv, kitchenWord, money, ticketCall, typeLabel } from "./lib/format";
import {
  closeTableBill,
  insertOrder,
  loadDayClose,
  loadOpenOrdersForTable,
  loadOrdersWithItems,
  toSalesRows,
  trayAsItems,
  upsertDayClose
} from "./lib/orders";
import { lockStaff, staffUnlocked, unlockStaff } from "./lib/staffGate";
import { connectBackend } from "./lib/supabase";
import { normalizeTable } from "./lib/tableSession";
import type { DayClose, MenuItem, Order, OrderType, SalesRow, TrayLine, View } from "./lib/types";

function AimsMark({ size = 88 }: { size?: number }) {
  return <img src="/aims-logo.svg" alt="Aims Solution" width={size} height={size} className="aims-logo" />;
}

function isStaffView(v: View) {
  return v === "pos" || v === "kds" || v === "bill" || v === "z" || v === "accounts";
}

function parseView(): View {
  const v = new URLSearchParams(location.search).get("view");
  if (v === "staff" || v === "pos") return "pos";
  if (v === "kds" || v === "bill" || v === "z" || v === "accounts") return v;
  return "menu";
}

function parseTable() {
  return normalizeTable(new URLSearchParams(location.search).get("table"));
}

function setQuery(view: View, table?: string) {
  const p = new URLSearchParams(location.search);
  if (isStaffView(view)) p.set("view", view);
  else p.delete("view");
  const safeTable = normalizeTable(table);
  if (safeTable) p.set("table", safeTable);
  else p.delete("table");
  const q = p.toString();
  history.replaceState({}, "", q ? "?" + q : location.pathname);
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
  const [posQty, setPosQty] = useState<Record<string, number>>({});
  const [posExtra, setPosExtra] = useState<Record<string, number>>({});
  const [campur, setCampur] = useState(loadCampurCatalog);
  const [editCampur, setEditCampur] = useState(false);
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
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [guestTickets, setGuestTickets] = useState<Order[]>([]);
  const [posTickets, setPosTickets] = useState<Order[]>([]);
  const [soldOut, setSoldOut] = useState<string[]>(loadSoldOut);
  const [guestConfirm, setGuestConfirm] = useState(false);
  const [posConfirm, setPosConfirm] = useState(false);
  const [guestSplash, setGuestSplash] = useState(() => parseView() === "menu");
  const [staffOk, setStaffOk] = useState(staffUnlocked);
  const [staffPw, setStaffPw] = useState("");
  const [staffErr, setStaffErr] = useState("");
  const sendingRef = useRef(false);
  const floorRef = useRef<{ send: (args: { type: "broadcast"; event: string; payload: { ids: string[] } }) => Promise<unknown> } | null>(null);
  const viewRef = useRef(view);
  const billTableRef = useRef(billTable);
  const tableRef = useRef(table);
  viewRef.current = view;
  billTableRef.current = billTable;
  tableRef.current = table;

  const ping = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2800);
  }, []);

  const go = useCallback((next: View, extraTable?: string) => {
    const t = normalizeTable(extraTable || table);
    setView(next);
    if (extraTable) {
      setTable(t);
      setBillTable(t || "01");
      setPosTable(t || "01");
    }
    setQuery(next, t || undefined);
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

  const loadGuestOpen = useCallback(async (client: SupabaseClient, tbl: string) => {
    const safe = normalizeTable(tbl);
    if (!safe) {
      setGuestTickets([]);
      return;
    }
    try {
      setGuestTickets(await loadOpenOrdersForTable(client, safe));
    } catch {
      setGuestTickets([]);
    }
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
      let tick: number | undefined;
      const refreshLive = () => {
        window.clearTimeout(tick);
        tick = window.setTimeout(() => {
          const v = viewRef.current;
          if (v === "kds") loadTickets(client);
          if (v === "accounts" || v === "z") loadSales(client);
          if (v === "bill") loadBill(client, billTableRef.current);
          if (v === "menu" && tableRef.current) loadGuestOpen(client, tableRef.current);
        }, 250);
      };
      const channel = client
        .channel("kds-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refreshLive)
        .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, refreshLive)
        .subscribe();
      const floor = client
        .channel("floor-board")
        .on("broadcast", { event: "sold-out" }, ({ payload }) => {
          const ids = Array.isArray(payload?.ids) ? payload.ids.map(String) : [];
          saveSoldOut(ids);
          setSoldOut(ids);
        })
        .on("broadcast", { event: "ask" }, () => {
          floor.send({ type: "broadcast", event: "sold-out", payload: { ids: loadSoldOut() } });
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setSoldOut(loadSoldOut());
            floor.send({ type: "broadcast", event: "ask", payload: {} });
          }
        });
      floorRef.current = floor;
      unsub = () => {
        window.clearTimeout(tick);
        floorRef.current = null;
        client.removeChannel(channel);
        client.removeChannel(floor);
      };
      const v = parseView();
      if (v === "kds") await loadTickets(client);
      else if (v === "accounts" || v === "z") await loadSales(client);
      else if (v === "bill") await loadBill(client, billTableRef.current);
      else if (v === "menu" && tableRef.current) await loadGuestOpen(client, tableRef.current);
    })();
    return () => unsub?.();
  }, [loadBill, loadGuestOpen, loadSales, loadTickets]);

  useEffect(() => {
    if (!sb) return;
    if (view === "kds") loadTickets(sb);
    if (view === "accounts" || view === "z") loadSales(sb);
    if (view === "bill") loadBill(sb, billTable);
    if (view === "menu" && table) loadGuestOpen(sb, table);
    if (view === "pos") {
      const safe = normalizeTable(posTable);
      if (safe) loadOpenOrdersForTable(sb, safe).then(setPosTickets).catch(() => setPosTickets([]));
      else setPosTickets([]);
    }
  }, [view, billTable, table, posTable, sb, loadBill, loadGuestOpen, loadSales, loadTickets]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    saveCampurCatalog(campur);
  }, [campur]);

  useEffect(() => {
    setGuestConfirm(false);
  }, [tray, orderType, table]);

  useEffect(() => {
    setPosConfirm(false);
  }, [posQty, posTable, posType]);

  useEffect(() => {
    if (!guestSplash) return;
    const t = window.setTimeout(() => setGuestSplash(false), 2400);
    return () => window.clearTimeout(t);
  }, [guestSplash]);

  const trayTotal = tray.reduce((s, i) => s + i.qty * i.price, 0);
  const campurLines = campur.proteins.concat(campur.addons);
  const posTotal = campurLines.reduce((s, p) => s + campurTotal(p, posExtra[p.id] || 0, posQty[p.id] || 0, campur.extraPrice), 0);
  const posItemCount = campurLines.reduce((s, i) => s + (posQty[i.id] || 0), 0);
  const guestPackCount = packingCount(tray);
  const guestPacking = packingFee(orderType, guestPackCount);
  const posPacking = packingFee(posType, posItemCount);
  const guestTotal = trayTotal + guestPacking;
  const posGrand = posTotal + posPacking;

  function pickOrderType(next: OrderType, staff = false) {
    if (staff) setPosType(next);
    else setOrderType(next);
    if (next === "bungkus") {
      ping("Bungkus adds 30¢ packing per item. Canned drinks have no packing fee.");
      if (!staff) {
        window.alert("Bungkus includes $0.30 packing per item for plastic / container. Canned drinks are not charged packing.");
      }
    }
  }

  function bumpPosQty(id: string, delta: number) {
    if (delta > 0 && isSold(soldOut, campurSoldKey(id))) {
      ping("That dish is sold out");
      return;
    }
    setPosQty((prev) => {
      const next = Math.max(0, (prev[id] || 0) + delta);
      return { ...prev, [id]: next };
    });
    if (delta < 0) {
      setPosExtra((prev) => {
        const qty = Math.max(0, (posQty[id] || 0) + delta);
        return qty ? prev : { ...prev, [id]: 0 };
      });
    }
  }

  function bumpExtra(id: string, delta: number) {
    setPosExtra((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) }));
  }

  function patchCampurItem(kind: "proteins" | "addons", id: string, patch: Partial<CampurItem>) {
    setCampur((prev) => ({
      ...prev,
      [kind]: prev[kind].map((item) => (item.id === id ? { ...item, ...patch } : item))
    }));
  }

  function removeCampurItem(kind: "proteins" | "addons", id: string) {
    setCampur((prev) => ({ ...prev, [kind]: prev[kind].filter((item) => item.id !== id) }));
    setPosQty((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setPosExtra((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function addCampurItem(kind: "proteins" | "addons") {
    const item: CampurItem = {
      id: newCampurId(kind === "proteins" ? "p" : "a"),
      name: kind === "proteins" ? "New protein" : "New add-on",
      price: kind === "proteins" ? 2 : 1,
      extra: kind === "proteins"
    };
    setCampur((prev) => ({ ...prev, [kind]: [...prev[kind], item] }));
    setEditCampur(true);
  }

  function itemSpec(item: MenuItem) {
    const option = item.options ? choice[item.id] || item.options[0] : undefined;
    const temp = item.hot != null ? choice[item.id + "-t"] || "Hot" : undefined;
    const name = [item.name, option, temp].filter(Boolean).join(" · ");
    const price = item.hot != null ? (temp === "Cold" ? item.cold! : item.hot) : item.price!;
    const pack = !item.canned;
    return { name, price, pack };
  }

  function trayQtyFor(item: MenuItem) {
    const { name, price, pack } = itemSpec(item);
    return tray.find((t) => t.name === name && t.price === price && (t.pack !== false) === pack)?.qty || 0;
  }

  function toggleSold(key: string) {
    setSoldOut((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      saveSoldOut(next);
      floorRef.current?.send({ type: "broadcast", event: "sold-out", payload: { ids: next } });
      return next;
    });
  }

  function bumpItem(item: MenuItem, delta: number) {
    if (!normalizeTable(table)) {
      ping("Scan the QR on your table first");
      return;
    }
    if (delta > 0 && isSold(soldOut, menuSoldKey(item.id))) {
      ping(item.name + " is sold out");
      return;
    }
    const { name, price, pack } = itemSpec(item);
    setTray((prev) => {
      const found = prev.find((t) => t.name === name && t.price === price && (t.pack !== false) === pack);
      if (!found) return delta > 0 ? [...prev, { name, price, qty: delta, pack }] : prev;
      return prev
        .map((t) => (t === found ? { ...t, qty: t.qty + delta } : t))
        .filter((t) => t.qty > 0);
    });
  }

  async function submitGuest() {
    if (!sb) return;
    if (!online) return ping("No signal. Food stays in the tray. Try Send again when it is back.");
    const safeTable = normalizeTable(table);
    if (!safeTable) return ping("Scan the QR sticker on your table");
    if (!tray.length) return ping("Tray is empty");
    if (!orderType) {
      setModal(true);
      return ping("Choose Dine-In or Bungkus");
    }
    const blocked = MENU.flatMap((c) => c.items).filter((item) => isSold(soldOut, menuSoldKey(item.id)));
    const blockedNames = new Set(blocked.map((item) => item.name));
    const dropped = tray.filter((line) => [...blockedNames].some((name) => line.name === name || line.name.startsWith(name + " ·")));
    if (dropped.length) {
      setTray((prev) => prev.filter((line) => !dropped.includes(line)));
      setGuestConfirm(false);
      ping("Kitchen sold out some dishes. Check your tray.");
      return;
    }
    if (!guestConfirm) {
      setGuestConfirm(true);
      return;
    }
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const data = await insertOrder(sb, {
        table_number: safeTable,
        order_type: orderType,
        source: "guest",
        kitchen_notes: notes,
        total: guestTotal,
        items: orderType === "bungkus" && guestPackCount ? [...trayAsItems(tray), packingLine(guestPackCount)] : trayAsItems(tray)
      });
      setTray([]);
      setNotes("");
      setOrderType("");
      setModal(false);
      setGuestConfirm(false);
      const call = ticketCall(data);
      setLastCall(call);
      ping("Kitchen got it · " + call);
      await loadGuestOpen(sb, safeTable);
    } catch {
      setGuestConfirm(false);
      ping("Not sent. Tray is still here. Tap Send again.");
    }
    sendingRef.current = false;
    setSending(false);
  }

  async function sendPlate() {
    if (!sb) return;
    if (!online) return ping("No signal. Plate is still here. Try again when it is back.");
    const safeTable = normalizeTable(posTable);
    if (!safeTable) return ping("Pick a table 01–20");
    const proteinQty = campur.proteins.reduce((s, p) => s + (posQty[p.id] || 0), 0);
    if (!proteinQty) return ping("Pick a protein");
    const blocked = campurLines.filter((p) => (posQty[p.id] || 0) > 0 && isSold(soldOut, campurSoldKey(p.id)));
    if (blocked.length) return ping(blocked[0].name + " is sold out");
    if (!posConfirm) {
      setPosConfirm(true);
      return;
    }
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    const items = campurLines.flatMap((p) => campurItems(p, posExtra[p.id] || 0, posQty[p.id] || 0, campur.extraPrice));
    if (posType === "bungkus") items.push(packingLine(posItemCount));
    try {
      const data = await insertOrder(sb, {
        table_number: safeTable,
        order_type: posType,
        source: "pos",
        kitchen_notes: "Nasi Campur plate",
        total: posGrand,
        items
      });
      setPosQty({});
      setPosExtra({});
      setPosConfirm(false);
      const call = ticketCall(data);
      setLastCall(call);
      ping("Kitchen got plate · " + call);
      setPosTickets(await loadOpenOrdersForTable(sb, safeTable));
    } catch {
      setPosConfirm(false);
      ping("Not sent. Plate is still here. Tap Send again.");
    }
    sendingRef.current = false;
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

  const guestHeader = (
    <header className="guest-header sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AimsMark size={44} />
          <div>
            <p className="text-[11px] tracking-[0.25em] uppercase text-teak">Aims Solution</p>
            <h1 className="font-display text-2xl leading-none">IFM Kopitiam</h1>
            <p className="text-[10px] opacity-50">{backendLabel}</p>
          </div>
        </div>
        {table ? <p className="text-sm font-bold">Table {table}</p> : <p className="text-sm font-bold text-chili">Scan table QR</p>}
      </div>
    </header>
  );

  const nav = (
    <header className="sticky top-0 z-30 backdrop-blur bg-kraft/80 border-b border-ink/10">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AimsMark size={44} />
          <div>
            <p className="text-[11px] tracking-[0.25em] uppercase text-teak">Aims Solution</p>
            <h1 className="font-display text-2xl leading-none">IFM Kopitiam</h1>
            <p className="text-[10px] text-ink/50">{backendLabel}</p>
          </div>
        </div>
        <nav className="flex flex-wrap gap-1 justify-end">
          {(
            [
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
          <button
            type="button"
            onClick={() => {
              lockStaff();
              setStaffOk(false);
              setStaffPw("");
            }}
            className="px-3 py-2 rounded-full text-sm bg-white/70"
          >
            Lock
          </button>
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
        <p className="mb-4 text-sm">Set portion qty, then send to the table bill. No rice charge. Extra / bigger uses the editable extra price. Dish names and prices are stored on this phone.</p>
        <div className="flex flex-wrap gap-2 mb-4">
          <button type="button" onClick={() => setEditCampur((v) => !v)} className={`px-3 py-2 rounded-xl text-sm font-bold ${editCampur ? "bg-ink text-kraft" : "bg-white"}`}>
            {editCampur ? "Done editing" : "Edit dishes & prices"}
          </button>
          <button
            type="button"
            onClick={() => {
              setCampur(defaultCampurCatalog());
              ping("Nasi Campur menu reset");
            }}
            className="px-3 py-2 rounded-xl bg-white text-sm"
          >
            Reset list
          </button>
        </div>
        {editCampur ? (
          <label className="flex items-center gap-2 mb-4 text-sm bg-white rounded-xl px-3 py-2 w-fit">
            Extra / bigger
            <input
              type="number"
              min="0"
              step="0.10"
              value={campur.extraPrice}
              onChange={(e) => setCampur((prev) => ({ ...prev, extraPrice: Math.max(0, Math.round((Number(e.target.value) || 0) * 100) / 100) }))}
              className="w-20 bg-kraft rounded-lg px-2 py-1 border border-ink/20"
            />
          </label>
        ) : null}
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-4">
          {TABLES.map((t) => (
            <button key={t} onClick={() => setPosTable(t)} className={`min-h-11 py-2 rounded-lg font-bold ${posTable === t ? "bg-ink text-kraft" : "bg-white"}`}>
              {t}
            </button>
          ))}
        </div>
        {posTickets.length ? (
          <div className="mb-4 bg-white rounded-2xl p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-teak">Kitchen · Table {posTable}</p>
            <ul className="mt-1 text-sm space-y-1">
              {posTickets.map((t) => (
                <li key={t.id} className="flex justify-between gap-2">
                  <span className="font-bold">{ticketCall(t)}</span>
                  <span>{kitchenWord(t.status)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex gap-2 mb-3">
          <button onClick={() => pickOrderType("dine_in", true)} className={`px-4 py-2 rounded-xl ${posType === "dine_in" ? "bg-pandan text-white" : "bg-white"}`}>
            Dine-In
          </button>
          <button onClick={() => pickOrderType("bungkus", true)} className={`px-4 py-2 rounded-xl ${posType === "bungkus" ? "bg-chili text-white" : "bg-white"}`}>
            Bungkus
          </button>
        </div>
        {posType === "bungkus" ? (
          <p className="mb-5 text-sm font-bold bg-chili/15 border border-chili text-chili rounded-xl px-3 py-2">
            Bungkus adds {money(PACKING)} packing per item ({posItemCount} × {money(PACKING)} = {money(posPacking)}).
          </p>
        ) : (
          <div className="mb-5" />
        )}
        <h3 className="font-bold mb-2">Protein</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {campur.proteins.map((p) => {
            const qty = posQty[p.id] || 0;
            const extras = qty && p.extra ? posExtra[p.id] || 0 : 0;
            const gone = isSold(soldOut, campurSoldKey(p.id));
            return (
              <div key={p.id} className={`p-4 rounded-2xl text-left ${gone ? "opacity-50 bg-white" : qty ? "bg-chili text-white" : "bg-white"}`}>
                {editCampur ? (
                  <div className="space-y-2 mb-2">
                    <input value={p.name} onChange={(e) => patchCampurItem("proteins", p.id, { name: e.target.value })} className="w-full rounded-lg px-2 py-1 text-ink text-sm" />
                    <input type="number" min="0" step="0.10" value={p.price} onChange={(e) => patchCampurItem("proteins", p.id, { price: Math.max(0, Math.round((Number(e.target.value) || 0) * 100) / 100) })} className="w-full rounded-lg px-2 py-1 text-ink text-sm" />
                    <label className={`flex items-center gap-2 text-xs ${qty ? "text-white" : "text-ink"}`}>
                      <input type="checkbox" checked={!!p.extra} onChange={(e) => patchCampurItem("proteins", p.id, { extra: e.target.checked })} />
                      Extra / bigger
                    </label>
                    <button type="button" onClick={() => removeCampurItem("proteins", p.id)} className="text-xs underline">
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="font-bold">{p.name}{gone ? " · sold out" : ""}</p>
                    <p>
                      {money(p.price)} · {qty} portion{qty === 1 ? "" : "s"}
                    </p>
                    {p.extra ? <p className="text-xs opacity-80 mt-1">+{money(campur.extraPrice)} extra / bigger</p> : null}
                  </>
                )}
                <button type="button" onClick={() => toggleSold(campurSoldKey(p.id))} className="mt-2 text-xs underline">
                  {gone ? "Back on menu" : "Sold out"}
                </button>
                <div className="mt-2 flex items-center gap-1">
                  <button type="button" onClick={() => bumpPosQty(p.id, -1)} disabled={qty < 1} className={`w-11 h-11 rounded-full font-bold ${qty ? "bg-white/20" : "bg-ink/10"}`}>
                    −
                  </button>
                  <span className="flex-1 text-center font-bold">{qty}</span>
                  <button type="button" onClick={() => bumpPosQty(p.id, 1)} disabled={gone} className={`w-11 h-11 rounded-full font-bold ${qty ? "bg-kraft text-ink" : "bg-ink/10"}`}>
                    +
                  </button>
                </div>
                {p.extra ? (
                  <div className="mt-2 flex items-center gap-1">
                    <button type="button" disabled={!qty || extras < 1} onClick={() => bumpExtra(p.id, -1)} className={`w-8 h-8 rounded-full font-bold ${qty ? "bg-white/20" : "bg-ink/10 text-ink/40"}`}>
                      −
                    </button>
                    <span className={`flex-1 text-xs font-bold text-center px-2 py-2 rounded-full ${extras ? "bg-kraft text-ink" : qty ? "bg-white/20" : "bg-ink/10 text-ink/40"}`}>
                      +{money(campur.extraPrice)} ×{extras}
                    </span>
                    <button type="button" disabled={!qty} onClick={() => bumpExtra(p.id, 1)} className={`w-8 h-8 rounded-full font-bold ${qty ? "bg-kraft text-ink" : "bg-ink/10 text-ink/40"}`}>
                      +
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {editCampur ? (
          <button type="button" onClick={() => addCampurItem("proteins")} className="mb-5 px-3 py-2 rounded-xl bg-white text-sm font-bold">
            Add protein
          </button>
        ) : (
          <div className="mb-5" />
        )}
        <h3 className="font-bold mb-2">Vegetable and condiments</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {campur.addons.map((v) => {
            const qty = posQty[v.id] || 0;
            const extras = qty && v.extra ? posExtra[v.id] || 0 : 0;
            const gone = isSold(soldOut, campurSoldKey(v.id));
            return (
              <div key={v.id} className={`rounded-2xl px-3 py-2 min-w-[11rem] ${gone ? "opacity-50 bg-white" : qty ? "chip-on" : "bg-white"}`}>
                {editCampur ? (
                  <div className="space-y-1 mb-1">
                    <input value={v.name} onChange={(e) => patchCampurItem("addons", v.id, { name: e.target.value })} className="w-full rounded-lg px-2 py-1 text-ink text-sm" />
                    <input type="number" min="0" step="0.10" value={v.price} onChange={(e) => patchCampurItem("addons", v.id, { price: Math.max(0, Math.round((Number(e.target.value) || 0) * 100) / 100) })} className="w-full rounded-lg px-2 py-1 text-ink text-sm" />
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={!!v.extra} onChange={(e) => patchCampurItem("addons", v.id, { extra: e.target.checked })} />
                      Extra / bigger
                    </label>
                    <button type="button" onClick={() => removeCampurItem("addons", v.id)} className="text-xs underline">
                      Remove
                    </button>
                  </div>
                ) : (
                  <p className="font-bold text-sm">
                    {v.name} · {money(v.price)}
                    {gone ? " · sold out" : ""}
                  </p>
                )}
                <button type="button" onClick={() => toggleSold(campurSoldKey(v.id))} className="text-xs underline mt-1">
                  {gone ? "Back on menu" : "Sold out"}
                </button>
                <div className="flex items-center gap-1 mt-1">
                  <button type="button" onClick={() => bumpPosQty(v.id, -1)} disabled={qty < 1} className="w-11 h-11 rounded-full font-bold bg-white/70">
                    −
                  </button>
                  <span className="min-w-[1.5rem] text-center font-bold">{qty}</span>
                  <button type="button" onClick={() => bumpPosQty(v.id, 1)} disabled={gone} className="w-11 h-11 rounded-full font-bold bg-white/70">
                    +
                  </button>
                  {v.extra ? (
                    <>
                      <button type="button" disabled={!qty || extras < 1} onClick={() => bumpExtra(v.id, -1)} className="w-7 h-7 rounded-full font-bold bg-white/70">
                        −
                      </button>
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${extras ? "bg-chili text-white" : "bg-white/70 text-ink"}`}>
                        +{money(campur.extraPrice)} ×{extras}
                      </span>
                      <button type="button" disabled={!qty} onClick={() => bumpExtra(v.id, 1)} className="w-7 h-7 rounded-full font-bold bg-white/70">
                        +
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        {editCampur ? (
          <button type="button" onClick={() => addCampurItem("addons")} className="mb-8 px-3 py-2 rounded-xl bg-white text-sm font-bold">
            Add vegetable or condiment
          </button>
        ) : (
          <div className="mb-8" />
        )}
        <button onClick={sendPlate} disabled={sending || !online} className="w-full bg-ink text-kraft rounded-2xl py-4 text-xl font-display ticket disabled:opacity-40">
          {posConfirm ? "Tap again to send · " : "Total Table "}
          {posTable} · {money(posGrand)}
          {posType === "bungkus" ? " · Bungkus" : " · Dine-In"}
        </button>
        {posConfirm ? <p className="mt-2 text-center text-sm font-bold text-chili">Check table {posTable}. Tap the button once more to send to kitchen.</p> : null}
        <button onClick={() => go("bill", posTable)} className="mt-3 w-full bg-white rounded-2xl py-3 font-bold">
          Open Table {posTable} bill
        </button>
        <section className="mt-10 bg-white/80 rounded-3xl border border-ink/10 p-4 sm:p-5">
          <div className="flex flex-wrap justify-between items-end gap-3 mb-5">
            <div>
              <p className="uppercase tracking-[0.2em] text-teak text-xs">Guest phones</p>
              <h3 className="font-display text-3xl leading-none">Sold out board</h3>
              <p className="text-sm opacity-70 mt-1">Tap a dish to hide it on table QR menus.</p>
            </div>
            <p className="text-sm font-bold">
              {MENU.reduce((s, c) => s + c.items.filter((i) => isSold(soldOut, menuSoldKey(i.id))).length, 0) || "None"}{" "}
              sold out
            </p>
          </div>
          <div className="space-y-5">
            {MENU.map((c) => {
              const goneCount = c.items.filter((i) => isSold(soldOut, menuSoldKey(i.id))).length;
              return (
                <div key={c.cat}>
                  <div className="flex items-baseline justify-between gap-3 mb-2 pb-1 border-b border-ink/10">
                    <h4 className="font-bold">{c.cat}</h4>
                    <span className={`text-xs font-bold ${goneCount ? "text-chili" : "opacity-50"}`}>
                      {goneCount ? goneCount + " sold out" : "all on"}
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-1.5">
                    {c.items.map((item) => {
                      const gone = isSold(soldOut, menuSoldKey(item.id));
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleSold(menuSoldKey(item.id))}
                          className={`min-h-11 px-3 rounded-xl text-left text-sm flex items-center justify-between gap-3 ${gone ? "bg-chili text-white" : "bg-kraft/80"}`}
                        >
                          <span className="font-bold leading-tight">{item.name}</span>
                          <span className={`shrink-0 text-[11px] uppercase tracking-wide ${gone ? "opacity-90" : "opacity-50"}`}>
                            {gone ? "Sold out" : "On"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
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
          {!online ? (
            <p className="mb-4 text-sm font-bold bg-chili/15 border border-chili text-chili rounded-xl px-3 py-2">Offline. Your tray is saved on this phone. Send when the network is back.</p>
          ) : null}
          {!table ? (
            <p className="mb-4 text-sm font-bold bg-chili/15 border border-chili text-chili rounded-xl px-3 py-2">Scan the QR on your table. Ordering is locked to tables 01–20.</p>
          ) : null}
          {guestTickets.length ? (
            <div className="mb-5 guest-card">
              <p className="text-xs uppercase tracking-[0.2em] text-teak">Kitchen for Table {table}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {guestTickets.map((t) => (
                  <li key={t.id} className="flex justify-between gap-2">
                    <span className="font-bold">{ticketCall(t)}</span>
                    <span>{kitchenWord(t.status)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            {table ? (
              <p className="text-sm font-bold">Table {table}</p>
            ) : (
              <p className="text-sm font-bold text-chili">No table</p>
            )}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search menu" className="flex-1 min-w-[160px] guest-surface rounded-lg px-3 py-2" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
            {CATS.map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`whitespace-nowrap px-3 py-1 rounded-full ${cat === c ? "guest-chip-on" : "guest-chip"}`}>
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
                    const qty = trayQtyFor(item);
                    const gone = isSold(soldOut, menuSoldKey(item.id));
                    return (
                      <article key={item.id} className={`guest-card ${gone ? "opacity-50" : ""}`}>
                        <div className="flex justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-lg">{item.name}{gone ? " · sold out" : ""}</h3>
                            {item.canned ? <p className="text-xs opacity-60">Can · no bungkus packing</p> : null}
                            {item.desc ? <p className="text-sm opacity-70">{item.desc}</p> : null}
                          </div>
                          <p className="font-display text-xl">{item.hot != null ? money(item.hot) + " / " + money(item.cold!) : money(item.price!)}</p>
                        </div>
                        {item.options ? (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {item.options.map((o) => (
                              <button key={o} onClick={() => setChoice((c) => ({ ...c, [item.id]: o }))} className={`text-xs px-2 py-1 rounded-full ${drink === o ? "guest-chip-on" : "guest-chip"}`}>
                                {o}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {item.hot != null ? (
                          <div className="flex gap-2 mt-3">
                            {["Hot", "Cold"].map((t) => (
                              <button key={t} onClick={() => setChoice((c) => ({ ...c, [item.id + "-t"]: t }))} className={`text-xs px-2 py-1 rounded-full ${temp === t ? "guest-chip-on" : "guest-chip"}`}>
                                {t}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-3 flex items-center gap-2">
                          <button type="button" disabled={qty < 1} onClick={() => bumpItem(item, -1)} className="w-11 h-11 min-w-11 min-h-11 rounded-xl guest-chip font-bold text-xl disabled:opacity-40">
                            −
                          </button>
                          <span className="flex-1 text-center font-bold text-lg">{gone ? "—" : qty}</span>
                          <button type="button" disabled={gone || !table} onClick={() => bumpItem(item, 1)} className="w-11 h-11 min-w-11 min-h-11 rounded-xl guest-plus font-bold text-xl disabled:opacity-40">
                            +
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </main>
        <div className="guest-dock fixed bottom-0 inset-x-0 z-40 px-4 py-3">
          <p className="text-center font-bold text-sm mb-2">How do you want this order?</p>
          <div className="max-w-md mx-auto grid grid-cols-2 gap-2 mb-2">
            <button onClick={() => pickOrderType("dine_in")} className={`py-3 rounded-2xl font-bold text-lg ${orderType === "dine_in" ? "guest-ok" : "guest-chip"}`}>
              Dine-In
            </button>
            <button onClick={() => pickOrderType("bungkus")} className={`py-3 rounded-2xl font-bold text-lg ${orderType === "bungkus" ? "guest-plus" : "guest-chip"}`}>
              Bungkus
            </button>
          </div>
          {orderType === "bungkus" ? (
            <p className="max-w-md mx-auto text-center text-sm font-bold text-chili mb-2">
              Bungkus adds {money(PACKING)} packing per item, not canned drinks ({guestPackCount} × {money(PACKING)} = {money(guestPacking)}).
            </p>
          ) : null}
          <button onClick={() => setModal(true)} disabled={!online || !table} className="max-w-md mx-auto block w-full guest-chip-on rounded-2xl px-4 py-4 font-bold disabled:opacity-40">
            <i className="fa-solid fa-bowl-food mr-2" />
            Total Table {table || "--"} · {money(guestTotal)}
            {orderType ? " · " + (orderType === "bungkus" ? "Bungkus" : "Dine-In") : ""}
          </button>
        </div>
        {modal ? (
          <div className="fixed inset-0 bg-ink/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setModal(false)}>
            <div className="guest-modal w-full max-w-md p-5">
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
                      <p className="text-sm">{money(t.price)}{t.pack === false ? " · can, no packing" : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="w-11 h-11 rounded-xl guest-chip font-bold" onClick={() => setTray((prev) => prev.map((x) => (x.name === t.name ? { ...x, qty: x.qty - 1 } : x)).filter((x) => x.qty > 0))}>
                        −
                      </button>
                      <span className="min-w-[1.5rem] text-center font-bold">{t.qty}</span>
                      <button className="w-11 h-11 rounded-xl guest-chip font-bold" onClick={() => setTray((prev) => prev.map((x) => (x.name === t.name ? { ...x, qty: x.qty + 1 } : x)))}>
                        +
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="opacity-70">Nothing in the tray yet.</p>
              )}
              {orderType === "bungkus" && guestPackCount ? (
                <div className="flex items-center justify-between py-2 border-b border-ink/10 text-chili">
                  <p className="font-bold">{PACKING_NAME} · {guestPackCount} × {money(PACKING)}</p>
                  <p className="font-bold">{money(guestPacking)}</p>
                </div>
              ) : null}
              <p className="mt-4 font-bold">
                Dine-In or Bungkus <span className="text-chili">*</span>
              </p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button onClick={() => pickOrderType("dine_in")} className={`py-4 rounded-2xl font-bold text-lg ${orderType === "dine_in" ? "guest-ok" : "guest-chip"}`}>
                  Dine-In
                </button>
                <button onClick={() => pickOrderType("bungkus")} className={`py-4 rounded-2xl font-bold text-lg ${orderType === "bungkus" ? "guest-plus" : "guest-chip"}`}>
                  Bungkus
                </button>
              </div>
              {orderType === "bungkus" ? (
                <p className="mt-2 text-sm font-bold text-chili">Alert: bungkus includes {money(PACKING)} packing per item. Canned drinks have no packing fee.</p>
              ) : null}
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full mt-3 rounded-xl p-3 text-sm guest-chip" placeholder="Kitchen notes" />
              <button
                onClick={submitGuest}
                disabled={sending || !orderType || !online || !table}
                className={`mt-3 w-full rounded-xl py-4 font-bold text-lg ${orderType ? "bg-chili text-white" : "bg-ink/20 text-ink/50"}`}
              >
                {!orderType
                  ? "Pick Dine-In or Bungkus first"
                  : guestConfirm
                    ? "Yes, send to kitchen · Table " + (table || "--") + " · " + money(guestTotal)
                    : "Send " + (orderType === "bungkus" ? "Bungkus" : "Dine-In") + " · " + money(guestTotal)}
              </button>
              {guestConfirm ? <p className="mt-2 text-sm font-bold text-chili">Check Table {table}. Tap once more. If it fails, the tray stays.</p> : null}
            </div>
          </div>
        ) : null}
      </>
    );
  }

  if (isStaffView(view) && !staffOk) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <form
          className="w-full max-w-sm bg-white/85 rounded-3xl p-6 text-center border border-ink/10"
          onSubmit={(e) => {
            e.preventDefault();
            if (unlockStaff(staffPw)) {
              setStaffOk(true);
              setStaffErr("");
              setStaffPw("");
            } else {
              setStaffErr("Wrong password");
            }
          }}
        >
          <AimsMark size={108} />
          <p className="mt-4 text-[11px] tracking-[0.25em] uppercase text-teak">Aims Solution</p>
          <h1 className="font-display text-3xl">Staff lock</h1>
          <p className="mt-1 text-sm opacity-70">POS, kitchen, bills, and reports need the admin password.</p>
          <input
            type="password"
            value={staffPw}
            onChange={(e) => {
              setStaffPw(e.target.value);
              setStaffErr("");
            }}
            autoComplete="current-password"
            placeholder="Admin password"
            className="mt-5 w-full min-h-12 rounded-xl px-4 bg-kraft border border-ink/20 text-center text-lg"
          />
          {staffErr ? <p className="mt-2 text-chili font-bold text-sm">{staffErr}</p> : null}
          <button type="submit" className="mt-4 w-full min-h-12 rounded-2xl bg-ink text-kraft font-bold text-lg">
            Unlock
          </button>
        </form>
      </div>
    );
  }

  if (view === "menu" && guestSplash) {
    return (
      <div className="guest-shell guest-splash" onClick={() => setGuestSplash(false)}>
        <AimsMark size={148} />
        <p className="mt-5 text-[11px] tracking-[0.28em] uppercase text-teak">Aims Solution</p>
        <h1 className="font-display text-4xl mt-1">IFM Kopitiam</h1>
        {table ? <p className="mt-2 font-bold">Table {table}</p> : <p className="mt-2 font-bold text-chili">Scan a table QR</p>}
        <p className="mt-6 text-sm opacity-70">Loading menu…</p>
        <div className="aims-loadbar" />
        <button type="button" className="mt-8 min-h-12 px-6 rounded-full guest-chip-on font-bold" onClick={() => setGuestSplash(false)}>
          Tap to order
        </button>
      </div>
    );
  }

  return (
    <div className={isStaffView(view) ? undefined : "guest-shell"}>
      {isStaffView(view) ? nav : guestHeader}
      {view === "menu" || view === "pos" ? lastCallBanner : null}
      {page}
      {toastEl}
    </div>
  );
}
