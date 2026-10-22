export function money(n: number | string | null | undefined, opts: { cents?: boolean } = {}) {
  if (n === null || n === undefined || n === "") return "—";
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: opts.cents ? 2 : 0,
  });
}

export function dateShort(d: string | null | undefined) {
  if (!d) return "—";
  // Plain dates (YYYY-MM-DD) are calendar days, not instants: don't shift by time zone.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + "T12:00:00") : new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" });
}

export function dateTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

/** Today's date in Dallas as YYYY-MM-DD. */
export function todayCentral() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
}

export function daysFromToday(d: string | null | undefined) {
  if (!d) return null;
  const t = new Date(todayCentral() + "T12:00:00").getTime();
  const x = new Date(d + "T12:00:00").getTime();
  return Math.round((x - t) / 86_400_000);
}

export function phoneDigits(p: string | null | undefined) {
  return (p ?? "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
}

export function phonePretty(p: string | null | undefined) {
  const d = phoneDigits(p);
  if (d.length !== 10) return p ?? "";
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** Turns "", "$1,200" etc. into a number or null. */
export function toNumber(v: FormDataEntryValue | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[$,\s]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function toText(v: FormDataEntryValue | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function toList(v: string | null | undefined): string[] {
  if (!v) return [];
  return v
    .split(/[,;|\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Same normalization the database uses for duplicate detection. */
export function addressKey(address: string, zip?: string | null) {
  const a = address.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const z = (zip ?? "").replace(/\D/g, "").slice(0, 5);
  return a + z;
}
