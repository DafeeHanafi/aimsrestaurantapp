export type View = "menu" | "pos" | "kds" | "bill" | "z" | "accounts";
export type OrderType = "dine_in" | "bungkus";
export type OrderSource = "guest" | "pos";
export type OrderStatus = "preparing" | "ready" | "done";

export type MenuItem = {
  id: string;
  name: string;
  price?: number;
  desc?: string;
  options?: string[];
  hot?: number;
  cold?: number;
  canned?: boolean;
};

export type MenuCategory = { cat: string; items: MenuItem[] };

export type TrayLine = { name: string; price: number; qty: number; pack?: boolean };

export type OrderItem = {
  id: string;
  order_id: string;
  name: string;
  qty: number;
  unit_price: number;
};

export type Order = {
  id: string;
  table_number: string;
  order_type: OrderType;
  source: OrderSource;
  status: string;
  kitchen_notes: string;
  total: number;
  created_at: string;
  ticket_no?: number | null;
  settled?: boolean;
  settled_at?: string | null;
  order_items: OrderItem[];
};

export type SalesRow = {
  datetime: string;
  business_date: string;
  table: string;
  source: string;
  order_type: string;
  item_name: string;
  qty: number;
  unit_price: number;
  line_total: number;
  order_id: string;
  ticket_no?: number | null;
  ticket: string;
  settled: boolean;
  status: string;
  kitchen_notes: string;
};

export type DayClose = {
  business_date: string;
  closed_at: string;
  dine_in_total: number;
  bungkus_total: number;
  line_count: number;
  revenue: number;
};
