import type { MenuCategory } from "./types";

export const MENU: MenuCategory[] = [
  {
    cat: "Breakfast Sets",
    items: [
      { id: "set-a", name: "Set A", price: 3.5, desc: "Paratha & Curry + Egg", options: ["Kopi 'O'", "Teh 'O'"] },
      { id: "set-b", name: "Set B", price: 4.0, desc: "Paratha & Curry + Egg", options: ["Kopi 'C'", "Teh 'C'"] },
      { id: "set-c", name: "Set C", price: 3.0, desc: "Roti Kahwin + Egg", options: ["Kopi 'O'", "Teh 'O'"] },
      { id: "set-c2", name: "Set C2", price: 3.5, desc: "Upgrade Roti Kahwin Cheese", options: ["Kopi 'O'", "Teh 'O'"] },
      { id: "set-d", name: "Set D", price: 3.5, desc: "Roti Kahwin + Egg", options: ["Kopi 'C'", "Teh 'C'"] },
      { id: "set-d2", name: "Set D2", price: 4.0, desc: "Upgrade Roti Kahwin Cheese", options: ["Kopi 'C'", "Teh 'C'"] }
    ]
  },
  {
    cat: "Nasi Goreng",
    items: [
      { id: "ng-ayam", name: "Nasi Goreng Ayam", price: 4.0 },
      { id: "ng-daging", name: "Nasi Goreng Daging", price: 5.0 },
      { id: "ng-udang", name: "Nasi Goreng Udang", price: 6.5 },
      { id: "ng-kerang", name: "Nasi Goreng Kerang", price: 6.5 },
      { id: "ng-cornbeef", name: "Nasi Goreng Cornbeef", price: 5.0 },
      { id: "ng-kampung", name: "Nasi Goreng Kampung", price: 4.5 },
      { id: "ng-belutak", name: "Nasi Goreng Belutak", price: 5.0 }
    ]
  },
  {
    cat: "Nasi Putih",
    items: [
      { id: "np-penyet", name: "Nasi Putih Ayam Penyet", price: 5.5 },
      { id: "np-grill", name: "Nasi Putih Ayam Grill", price: 5.5 }
    ]
  },
  {
    cat: "Fried Noodles",
    items: [
      { id: "mg-ayam", name: "Mee Goreng Ayam", price: 4.0 },
      { id: "mg-daging", name: "Mee Goreng Daging", price: 5.0 },
      { id: "mg-udang", name: "Mee Goreng Udang", price: 6.5 },
      { id: "mg-kerang", name: "Mee Goreng Kerang", price: 6.5 },
      { id: "mg-penyet", name: "Mee Goreng Penyet", price: 6.0 },
      { id: "mg-grill", name: "Mee Goreng Ayam Grill", price: 6.0 },
      { id: "kt-ayam", name: "Kway Teow Goreng Ayam", price: 4.0 },
      { id: "kt-daging", name: "Kway Teow Goreng Daging", price: 5.0 },
      { id: "kt-udang", name: "Kway Teow Goreng Udang", price: 6.5 },
      { id: "kt-kerang", name: "Kway Teow Goreng Kerang", price: 6.5 },
      { id: "kt-penyet", name: "Kway Teow Goreng Penyet", price: 6.0 },
      { id: "kt-grill", name: "Kway Teow Goreng Ayam Grill", price: 6.0 },
      { id: "indo-penyet", name: "Indomee Penyet", price: 5.5 },
      { id: "indo-grill", name: "Indomee Ayam Grill", price: 5.5 },
      { id: "mee-instant", name: "Mee Instant", price: 1.0 }
    ]
  },
  {
    cat: "Roti",
    items: [
      { id: "paratha-curry", name: "Paratha w/ Curry", price: 2.0 },
      { id: "paratha-kosong", name: "Paratha Kosong", price: 0.8 },
      { id: "roti-kahwin", name: "Roti Kahwin", price: 1.5 },
      { id: "roti-kahwin-cheese", name: "Roti Kahwin Cheese", price: 2.0 },
      { id: "roti-celup", name: "Roti Celup Telur", price: 2.0 }
    ]
  },
  {
    cat: "Drinks",
    items: [
      { id: "kopi-teh-o", name: "Kopi / Teh 'O'", hot: 1.0, cold: 1.5 },
      { id: "kopi-c", name: "Kopi / Kopi 'C'", hot: 1.5, cold: 1.8 },
      { id: "kopi-goji", name: "Kopi Goji", hot: 1.5, cold: 1.8 },
      { id: "teh-tarik", name: "Teh Tarik", hot: 1.5, cold: 1.8 },
      { id: "kopi-tarik", name: "Kopi Tarik", hot: 1.5, cold: 2.0 },
      { id: "honey-lemon", name: "Honey Lemon", hot: 1.5, cold: 2.0 },
      { id: "lemon-tea", name: "Lemon Tea", hot: 1.7, cold: 2.0 },
      { id: "kasturi", name: "Kasturi", hot: 1.5, cold: 1.8 },
      { id: "lemon", name: "Lemon", hot: 1.5, cold: 1.5 },
      { id: "longan", name: "Longan", price: 2.0, canned: true },
      { id: "longan-milk", name: "Longan w/ Milk", price: 2.2, canned: true },
      { id: "bandung", name: "Bandung (Rose Milk)", price: 1.5, canned: true },
      { id: "banana-lemon", name: "Banana Lemon (Cordial)", price: 1.2, canned: true },
      { id: "rose-lemon", name: "Rose Lemon (Cordial)", price: 1.2, canned: true }
    ]
  }
];

export const EXTRA = 0.5;
export const PACKING = 0.3;
export const PACKING_NAME = "Bungkus packing (plastic / container)";

export type CampurItem = {
  id: string;
  name: string;
  price: number;
  extra?: boolean;
};

export const PROTEINS: CampurItem[] = [
  { id: "ayam", name: "Ayam", price: 2.0, extra: true },
  { id: "daging", name: "Daging", price: 3.0, extra: true },
  { id: "ikan", name: "Ikan", price: 2.0 },
  { id: "ayam-grill", name: "Ayam grill (whole leg)", price: 3.5, extra: true },
  { id: "sambal-pusu", name: "Sambal Pusu", price: 3.0, extra: true }
];

export const VEGGIES: CampurItem[] = [
  { id: "veggie-condiments", name: "Veggie and condiments", price: 1.0, extra: true }
];

export function packingLine(itemCount: number) {
  const qty = Math.max(0, itemCount);
  return { name: PACKING_NAME, qty, unit_price: PACKING };
}

export function packingCount(lines: { qty: number; pack?: boolean }[]) {
  return lines.reduce((s, i) => s + (i.pack === false ? 0 : i.qty), 0);
}

export function packingFee(orderType: string, itemCount: number) {
  return orderType === "bungkus" ? PACKING * Math.max(0, itemCount) : 0;
}

export function campurLine(item: CampurItem, extraCount = 0) {
  const n = item.extra ? Math.max(0, extraCount || 0) : 0;
  return {
    name: n ? item.name + " + extra ×" + n : item.name,
    qty: 1,
    unit_price: item.price + n * EXTRA
  };
}

export const TABLES = Array.from({ length: 20 }, (_, i) => String(i + 1).padStart(2, "0"));
export const CATS = ["All", ...MENU.map((m) => m.cat)];
