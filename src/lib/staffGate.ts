const STAFF_KEY = "aims-staff-unlock";
const STAFF_PW = "TOC2026Aims";

export function staffUnlocked() {
  try {
    return sessionStorage.getItem(STAFF_KEY) === "1";
  } catch {
    return false;
  }
}

export function unlockStaff(password: string) {
  if (password === STAFF_PW) {
    sessionStorage.setItem(STAFF_KEY, "1");
    return true;
  }
  return false;
}

export function lockStaff() {
  sessionStorage.removeItem(STAFF_KEY);
}
