import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Notice, PageHeader, qs } from "@/components/crm/ui";
import { dateShort, money, phonePretty } from "@/lib/format";
import { SelectAll } from "../../distress/ui";
import { addProspectsToBuyers, setProspectStatus } from "./actions";
import { ProspectImporter } from "./ProspectImporter";

export const metadata = { title: "Buyer prospects" };

const PER_PAGE = 50;
type Params = { status?: string; tier?: string; phone?: string; q?: string; page?: string; added?: string; linked?: string; rejected?: string; restored?: string; error?: string };
type Row = {
  id: string; name: string; is_company: boolean; mailing_address: string | null; phones: { number: string; type: string; dnc: boolean }[]; emails: string[];
  purchases: number; purchases_12mo: number; last_purchase: string | null; price_min: number | null; price_max: number | null; avg_price: number | null;
  zips: string[]; cities: string[]; property_types: string[]; properties: { address: string; city: string; zip: string; date: string | null; price: number | null }[];
  score: number; suggested_tier: string; status: string; buyer_id: string | null;
};

export default async function Prospects({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase } = await requireRole("owner", "dispositions");
  const sp = await searchParams;
  const status = ["new", "added", "rejected"].includes(sp.status ?? "") ? sp.status! : "new";
  const page = Math.max(1, Number(sp.page) || 1);
  const cur = { status: sp.status, tier: sp.tier, phone: sp.phone, q: sp.q };

  let q = supabase.from("buyer_prospects").select("*", { count: "exact" }).eq("status", status)
    .order("score", { ascending: false }).order("purchases", { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  if (sp.tier === "A") q = q.eq("suggested_tier", "A");
  if (sp.tier === "AB") q = q.in("suggested_tier", ["A", "B"]);
  if (sp.phone === "1") q = q.neq("phones", "[]");
  if (sp.q) {
    const s = sp.q.replace(/[,()%]/g, " ").trim();
    q = /^\d{5}$/.test(s) ? q.contains("zips", [s]) : q.or(`name.ilike.%${s}%,mailing_address.ilike.%${s}%`);
  }
  const [{ data, count }, ...counts] = await Promise.all([
    q,
    ...["new", "added", "rejected"].map((s) => supabase.from("buyer_prospects").select("id", { count: "exact", head: true }).eq("status", s)),
  ]);
  const rows = (data ?? []) as Row[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PER_PAGE));
  const back = `/crm/buyers/prospects${qs(cur, { page: String(page) })}`;

  return (
    <>
      <p className="mb-3 text-sm"><Link href="/crm/buyers" className="text-ink-soft underline">← Buyers</Link></p>
      <PageHeader title="Buyer prospects" sub="Import cash buyers from PropStream, see who's actually buying, and move the real ones into your buyers list." />

      {sp.added && <Notice>Added {sp.added} to your buyers list{sp.linked && sp.linked !== "0" ? ` and matched ${sp.linked} you already had` : ""}.</Notice>}
      {!sp.added && sp.linked && <Notice>Matched {sp.linked} to buyers you already had.</Notice>}
      {sp.rejected && <Notice>Rejected {sp.rejected}.</Notice>}
      {sp.restored && <Notice>Moved {sp.restored} back to review.</Notice>}
      {sp.error && <Notice tone="danger">{sp.error}</Notice>}

      <ProspectImporter />

      <div className="mt-6 mb-3 flex flex-wrap items-center gap-2">
        {(["new", "added", "rejected"] as const).map((s, i) => (
          <Link key={s} href={`/crm/buyers/prospects${qs(cur, { status: s === "new" ? null : s, page: null })}`} className={`btn btn-sm ${status === s ? "btn-dark" : "btn-ghost"}`}>
            {{ new: "To review", added: "Added to buyers", rejected: "Rejected" }[s]} ({(counts[i].count ?? 0).toLocaleString()})
          </Link>
        ))}
        <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
        {[["", "All tiers"], ["AB", "A + B"], ["A", "A only"]].map(([k, l]) => (
          <Link key={k} href={`/crm/buyers/prospects${qs(cur, { tier: k || null, page: null })}`} className={`btn btn-sm ${(sp.tier ?? "") === k ? "btn-dark" : "btn-ghost"}`}>{l}</Link>
        ))}
        <Link href={`/crm/buyers/prospects${qs(cur, { phone: sp.phone === "1" ? null : "1", page: null })}`} className={`btn btn-sm ${sp.phone === "1" ? "btn-dark" : "btn-ghost"}`}>Has phone</Link>
        <form className="ml-auto flex gap-2" action="/crm/buyers/prospects">
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          {sp.tier && <input type="hidden" name="tier" value={sp.tier} />}
          {sp.phone && <input type="hidden" name="phone" value={sp.phone} />}
          <input name="q" defaultValue={sp.q} className="input py-1 text-sm sm:w-48" placeholder="Name or ZIP" aria-label="Search" />
          <button className="btn btn-ghost btn-sm">Search</button>
        </form>
      </div>

      {rows.length === 0 ? (
        <p className="card p-6 text-sm text-ink-soft">{status === "new" ? "Nothing to review. Import a PropStream export above." : "Nothing here."}</p>
      ) : (
        <form>
          <input type="hidden" name="back" value={back} />
          {status !== "added" && (
            <div className="mb-2 flex flex-wrap items-center gap-3">
              {status === "new" && (
                <>
                  <button formAction={addProspectsToBuyers} className="btn btn-primary btn-sm">Add checked to buyers list</button>
                  <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="email_alerts" className="check mt-0" /> Turn on deal emails for them</label>
                  <button formAction={setProspectStatus} name="to" value="rejected" className="btn btn-ghost btn-sm">Reject checked</button>
                </>
              )}
              {status === "rejected" && <button formAction={setProspectStatus} name="to" value="new" className="btn btn-ghost btn-sm">Move checked back to review</button>}
            </div>
          )}
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th className="w-8">{status !== "added" && <SelectAll />}</th>
                  <th className="text-right">Score</th>
                  <th>Buyer</th>
                  <th className="text-right">Bought (12 mo / total)</th>
                  <th>Last buy</th>
                  <th className="text-right">Price range</th>
                  <th>Where</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const clean = r.phones.filter((p) => !p.dnc);
                  return (
                    <tr key={r.id} className="align-top">
                      <td>{status !== "added" && <input type="checkbox" name="ids" value={r.id} className="check" aria-label={`Select ${r.name}`} />}</td>
                      <td className="text-right">
                        <span className={`inline-block min-w-9 rounded-md px-1.5 py-0.5 text-center text-sm font-bold tabular-nums ${r.score >= 70 ? "bg-sage text-white" : r.score >= 40 ? "bg-sage/15 text-sage" : "bg-ink/5 text-ink-soft"}`}>{r.score}</span>
                        <span className="mt-1 block text-xs text-ink-soft">Tier {r.suggested_tier}</span>
                      </td>
                      <td className="min-w-52">
                        <span className="font-medium">{r.name}</span>
                        {r.is_company && <span className="ml-1.5 rounded-full bg-ink/5 px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft">Company</span>}
                        {r.buyer_id && <Link href={`/crm/buyers/${r.buyer_id}`} className="ml-1.5 text-xs underline">Open buyer</Link>}
                        {r.mailing_address && <span className="block text-xs text-ink-soft">{r.mailing_address}</span>}
                        {r.properties.length > 0 && (
                          <details className="mt-1 text-xs">
                            <summary className="cursor-pointer text-ink-soft">Houses they bought</summary>
                            <ul className="mt-1 space-y-0.5">
                              {r.properties.slice(0, 12).map((p, i) => (
                                <li key={i}>{p.address}{p.zip ? ` ${p.zip}` : ""} · {p.date ? dateShort(p.date) : "date ?"}{p.price ? ` · ${money(p.price)}` : ""}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </td>
                      <td className="text-right tabular-nums"><b className={r.purchases_12mo >= 3 ? "text-sage" : ""}>{r.purchases_12mo}</b> / {r.purchases}</td>
                      <td className="whitespace-nowrap">{r.last_purchase ? dateShort(r.last_purchase) : "—"}</td>
                      <td className="text-right whitespace-nowrap tabular-nums text-sm">{r.price_min ? `${money(r.price_min)}–${money(r.price_max)}` : "—"}</td>
                      <td className="min-w-32 text-xs">{[...r.zips.slice(0, 4), ...r.cities.slice(0, 2)].join(", ") || "—"}{r.property_types.length ? <span className="block text-ink-soft">{r.property_types.join(", ")}</span> : null}</td>
                      <td className="min-w-40 text-sm">
                        {clean[0] ? <a href={`tel:${clean[0].number}`} className="block underline">{phonePretty(clean[0].number)}</a> : <span className="block text-xs text-ink-soft">{r.phones.length ? "Only DNC numbers" : "No phone"}</span>}
                        {clean.length > 1 && <span className="block text-xs text-ink-soft">+{clean.length - 1} more</span>}
                        {r.emails[0] && <a href={`mailto:${r.emails[0]}`} className="block truncate text-xs underline">{r.emails[0]}</a>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </form>
      )}

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-ink-soft">Page {page} of {pages} · {(count ?? 0).toLocaleString()} prospects</span>
          <span className="flex gap-2">
            {page > 1 && <Link className="btn btn-ghost btn-sm" href={`/crm/buyers/prospects${qs(cur, { page: String(page - 1) })}`}>Previous</Link>}
            {page < pages && <Link className="btn btn-ghost btn-sm" href={`/crm/buyers/prospects${qs(cur, { page: String(page + 1) })}`}>Next</Link>}
          </span>
        </div>
      )}

      <details className="card mt-5 p-4 text-sm">
        <summary className="cursor-pointer font-semibold">How buyers are scored</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
          <li><b>Recent buying matters most:</b> +20 for each purchase in the last 12 months (max +60), +5 for each older one (max +15), +10 if they bought in the last 6 months.</li>
          <li><b>Reachable:</b> +10 with a phone that isn&apos;t on Do Not Call, +5 with an email. +5 if it&apos;s a company (LLCs are usually investors).</li>
          <li><b>Tier A</b> = 3+ buys in 12 months (or 70+ score). <b>Tier B</b> = at least 1 recent buy (or 40+). <b>Tier C</b> = the rest.</li>
          <li>Sales under $1,000 (family transfers) are ignored. The buy box (areas, price range, property types) is estimated from what they bought. Confirm it when you call.</li>
          <li>Deal emails stay off for imported buyers unless you check the box. They never signed up, so call first, then turn emails on once they say yes.</li>
        </ul>
      </details>
    </>
  );
}
