import "server-only";
import { headers } from "next/headers";

export async function requestMeta() {
  const h = await headers();
  const fwd = h.get("x-forwarded-for") ?? "";
  return {
    ip: fwd.split(",")[0]?.trim() || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent")?.slice(0, 500) ?? null,
    referer: h.get("referer")?.slice(0, 500) ?? null,
  };
}

/** Light bot filter for public forms: hidden honeypot + minimum fill time. */
export function looksLikeBot(fd: FormData) {
  if (String(fd.get("company_website") ?? "").trim() !== "") return true;
  const started = Number(fd.get("started_at"));
  if (!Number.isFinite(started)) return true;
  const elapsed = Date.now() - started;
  return elapsed < 2500 || elapsed > 1000 * 60 * 60 * 6;
}
