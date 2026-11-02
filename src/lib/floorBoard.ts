const STORE = "aims-sold-out-v1";

export function menuSoldKey(id: string) {
  return "menu:" + id;
}

export function campurSoldKey(id: string) {
  return "campur:" + id;
}

export function loadSoldOut(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || "[]");
    return Array.isArray(raw) ? raw.map(String) : [];
  } catch {
    return [];
  }
}

export function saveSoldOut(ids: string[]) {
  localStorage.setItem(STORE, JSON.stringify([...new Set(ids)]));
}

export function isSold(ids: string[], key: string) {
  return ids.includes(key);
}
