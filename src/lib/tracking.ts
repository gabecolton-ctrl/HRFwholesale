// Short tracking links for marketing. Put "hrfassets.com/m" on a mailer, "/s" on a
// sign, etc. A visitor who arrives that way is tagged with the source for 90 days,
// and any seller form they submit is saved with that lead source automatically.
// Add or rename codes here; the label must match a lead source in constants.ts.
export const TRACKING_CODES: Record<string, string> = {
  m: "Direct mail",
  l: "Handwritten letters",
  s: "Signs",
  d: "Door hangers",
  c: "Business cards",
  v: "Skip trace + text/dialer", // voicemail drops
  t: "Skip trace + text/dialer", // texts
  g: "Google Business Profile",
  ga: "Google Ads",
  fb: "Facebook / Instagram",
  nd: "Nextdoor",
  r: "Referral",
};

export const SOURCE_COOKIE = "hrf_src";
export const SOURCE_COOKIE_DAYS = 90;

/** Source from ?utm_source / ?src on any page (used by ads and links you share). */
export function sourceFromParams(p: URLSearchParams): string | null {
  const src = p.get("src")?.toLowerCase();
  if (src && TRACKING_CODES[src]) return TRACKING_CODES[src];
  const utm = p.get("utm_source")?.toLowerCase();
  if (!utm) return null;
  const medium = (p.get("utm_medium") ?? "").toLowerCase();
  if (utm.includes("google")) return /cpc|ppc|paid|ads/.test(medium) ? "Google Ads" : utm.includes("business") || medium === "gbp" ? "Google Business Profile" : "Google search";
  if (/facebook|instagram|fb|ig|meta/.test(utm)) return "Facebook / Instagram";
  if (utm.includes("nextdoor")) return "Nextdoor";
  if (utm.includes("bing")) return "Bing search";
  return utm.slice(0, 40);
}

/** First-visit source from the referring site, when nothing else tells us. */
export function sourceFromReferrer(ref: string | null): string | null {
  if (!ref) return null;
  try {
    const h = new URL(ref).hostname.toLowerCase();
    if (/(^|\.)google\./.test(h)) return "Google search";
    if (/(^|\.)bing\.com$/.test(h) || /duckduckgo|yahoo/.test(h)) return "Bing search";
    if (/facebook\.com|instagram\.com|fb\.me|l\.facebook/.test(h)) return "Facebook / Instagram";
    if (/nextdoor\.com/.test(h)) return "Nextdoor";
  } catch {}
  return null;
}
