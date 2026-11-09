import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Notice, PageHeader, qs } from "@/components/crm/ui";
import { dateShort, money, phonePretty } from "@/lib/format";
import { MONTHLY_LIMIT, rentcastConfigured } from "@/lib/rentcast";
import { rentcastUsedThisMonth } from "@/lib/scanner";
import { SelectAll } from "../distress/ui";
import { makeLeadsFromListings, setListingStatus } from "./actions";

export const metadata = { title: "Deal Scanner" };

const PER_PAGE = 50;
type Params = { m?: string; status?: string; all?: string; page?: string; made?: string; linked?: string; dismissed?: string; restored?: string; error?: string };
type Row = {
  id: string; address: string; city: string | null; state: string | null; zip: string | null; price: number | null; first_price: number | null;
  beds: number | null; baths: number | null; sqft: number | null; year_built: number | null; days_on_market: number | null; listing_type: string | null;
  agent: { name?: string; phone?: string; email?: string } | null; office: { name?: string; phone?: string } | null;
  zip_ppsf: number | null; est_arv: number | null; est_mao: number | null; score: number; flags: string[]; qualified: boolean; status: string; lead_id: string | null;
  first_seen_at: string;
};

export default async function Scanner({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase, profile } = await requireRole("owner", "acquisitions", "va");
  const sp = await searchParams;
  const status = ["new", "lead", "dismissed"].includes(sp.status ?? "") ? sp.status! : "new";
  const showAll = sp.all === "1";
  const page = Math.max(1, Number(sp.page) || 1);
  const cur = { m: sp.m, status: sp.status, all: sp.all };

  const { data: markets } = await supabase.from("scan_markets").select("id,city,state,active,last_scanned_at,last_qualified").order("city");
  let q = supabase.from("scan_listings").select("*", { count: "exact" }).eq("status", status)
    .order("score", { ascending: false }).order("days_on_market", { ascending: false, nullsFirst: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  if (!showAll) q = q.eq("qualified", true);
  if (sp.m) q = q.eq("market_id", sp.m);
  const [{ data, count }, used] = await Promise.all([q, rentcastUsedThisMonth(supabase)]);
  const rows = (data ?? []) as Row[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PER_PAGE));
  const back = `/crm/scanner${qs(cur, { page: String(page) })}`;
  const lastScan = (markets ?? []).map((m) => m.last_scanned_at).filter(Boolean).sort().pop();

  return (
    <>
      <PageHeader
        title="Deal Scanner"
        sub="On-market homes in your cities, checked every week and ranked by how motivated the seller looks and how close the price is to a deal."
        actions={profile.role === "owner" ? <Link href="/crm/scanner/markets" className="btn btn-ghost btn-sm">Cities &amp; settings</Link> : undefined}
      />

      {!rentcastConfigured() && <Notice tone="amber">The scanner uses your RentCast account. Add <code>RENTCAST_API_KEY</code> in Vercel.</Notice>}
      {sp.made && <Notice>Created {sp.made} lead{sp.made === "1" ? "" : "s"}{sp.linked && sp.linked !== "0" ? ` and linked ${sp.linked} you already had` : ""}. Call the listing agent from the lead.</Notice>}
      {sp.dismissed && <Notice>Dismissed {sp.dismissed}.</Notice>}
      {sp.restored && <Notice>Moved {sp.restored} back.</Notice>}
      {sp.error && <Notice tone="danger">{sp.error}</Notice>}

      <p className="mb-3 text-sm text-ink-soft">
        {lastScan ? <>Last scan {dateShort(lastScan)}. </> : <>No scans yet{profile.role === "owner" ? <> (open <Link className="underline" href="/crm/scanner/markets">Cities</Link> and tap Scan now)</> : ""}. </>}
        Scans run automatically once a week per city. RentCast use this month: {used} of {MONTHLY_LIMIT}.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link href={`/crm/scanner${qs(cur, { m: null, page: null })}`} className={`btn btn-sm ${!sp.m ? "btn-dark" : "btn-ghost"}`}>All cities</Link>
        {(markets ?? []).map((m) => (
          <Link key={m.id} href={`/crm/scanner${qs(cur, { m: m.id, page: null })}`} className={`btn btn-sm ${sp.m === m.id ? "btn-dark" : "btn-ghost"}`}>
            {m.city}{m.last_qualified ? ` (${m.last_qualified})` : ""}
          </Link>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(["new", "lead", "dismissed"] as const).map((s) => (
          <Link key={s} href={`/crm/scanner${qs(cur, { status: s === "new" ? null : s, page: null })}`} className={`btn btn-sm ${status === s ? "btn-dark" : "btn-ghost"}`}>
            {{ new: "To review", lead: "Made into leads", dismissed: "Dismissed" }[s]}
          </Link>
        ))}
        <Link href={`/crm/scanner${qs(cur, { all: showAll ? null : "1", page: null })}`} className="btn btn-ghost btn-sm">
          {showAll ? "Show qualified only" : "Show everything scanned"}
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="card p-6 text-sm text-ink-soft">{status === "new" ? "Nothing to review. New qualified listings show up here after each scan." : "Nothing here."}</p>
      ) : (
        <form>
          <input type="hidden" name="back" value={back} />
          {status !== "lead" && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {status === "new" && <button formAction={makeLeadsFromListings} className="btn btn-primary btn-sm">Make leads from checked</button>}
              {status === "new" && <button formAction={setListingStatus} name="to" value="dismissed" className="btn btn-ghost btn-sm">Dismiss checked</button>}
              {status === "dismissed" && <button formAction={setListingStatus} name="to" value="new" className="btn btn-ghost btn-sm">Move checked back</button>}
            </div>
          )}
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th className="w-8">{status !== "lead" && <SelectAll />}</th>
                  <th className="text-right">Score</th>
                  <th>Property</th>
                  <th className="text-right">Price</th>
                  <th>Why it&apos;s here</th>
                  <th className="text-right">Est. ARV / max offer</th>
                  <th>Listing agent</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ppsf = r.price && r.sqft ? Math.round(r.price / r.sqft) : null;
                  const gap = r.price && r.est_mao ? r.price - r.est_mao : null;
                  const full = `${r.address}, ${r.city ?? ""}, ${r.state ?? ""} ${r.zip ?? ""}`;
                  const flags = r.flags.filter((f) => !f.startsWith("Skipped"));
                  const skipped = r.flags.filter((f) => f.startsWith("Skipped"));
                  return (
                    <tr key={r.id}>
                      <td>{status !== "lead" && <input type="checkbox" name="ids" value={r.id} className="check" aria-label={`Select ${r.address}`} />}</td>
                      <td className="text-right">
                        <span className={`inline-block min-w-9 rounded-md px-1.5 py-0.5 text-center text-sm font-bold tabular-nums ${r.score >= 70 ? "bg-sage text-white" : r.score >= 40 ? "bg-sage/15 text-sage" : "bg-ink/5 text-ink-soft"}`}>{r.score}</span>
                      </td>
                      <td className="min-w-52">
                        <span className="font-medium">{r.address}</span>
                        <span className="block text-xs text-ink-soft">{[r.city, r.zip].filter(Boolean).join(" ")} · {r.beds ?? "?"}bd/{r.baths ?? "?"}ba · {r.sqft?.toLocaleString() ?? "?"} sqft{r.year_built ? ` · ${r.year_built}` : ""}</span>
                      </td>
                      <td className="text-right whitespace-nowrap tabular-nums">
                        <span className="font-semibold">{money(r.price)}</span>
                        {r.first_price && r.price && r.first_price > r.price && <span className="block text-xs text-ink-soft line-through">{money(r.first_price)}</span>}
                        <span className="block text-xs text-ink-soft">{ppsf ? `$${ppsf}/sqft` : ""}{r.zip_ppsf ? ` · ZIP $${r.zip_ppsf}` : ""}</span>
                      </td>
                      <td className="min-w-48">
                        <span className="flex flex-wrap gap-1">
                          {flags.length ? flags.map((f) => <span key={f} className="rounded-full bg-clay/10 px-2 py-0.5 text-xs font-semibold text-clay">{f}</span>) : <span className="text-xs text-ink-soft">{r.days_on_market ?? "?"} days on market</span>}
                        </span>
                        {skipped.length > 0 && <span className="mt-1 block text-xs text-ink-soft">{skipped.join(" · ")}</span>}
                      </td>
                      <td className="text-right whitespace-nowrap tabular-nums text-sm">
                        {money(r.est_arv)} / <b>{money(r.est_mao)}</b>
                        {gap !== null && <span className={`block text-xs ${gap <= 0 ? "font-semibold text-sage" : "text-ink-soft"}`}>{gap <= 0 ? "price under max offer" : `${money(gap)} over max offer`}</span>}
                      </td>
                      <td className="min-w-40 text-sm">
                        {r.agent?.name || r.office?.name ? (
                          <>
                            <span className="font-medium">{r.agent?.name || r.office?.name}</span>
                            {r.agent?.phone && <a href={`tel:${r.agent.phone}`} className="block text-xs underline">{phonePretty(r.agent.phone)}</a>}
                            {!r.agent?.phone && r.office?.phone && <a href={`tel:${r.office.phone}`} className="block text-xs underline">{phonePretty(r.office.phone)} (office)</a>}
                            {r.agent?.email && <a href={`mailto:${r.agent.email}`} className="block truncate text-xs underline">{r.agent.email}</a>}
                          </>
                        ) : <span className="text-xs text-ink-soft">Not listed</span>}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <span className="flex justify-end gap-1.5">
                          {r.lead_id && <Link href={`/crm/leads/${r.lead_id}`} className="btn btn-ghost btn-sm">Lead</Link>}
                          {profile.role !== "va" && <Link href={`/crm/comps${qs({}, { address: full, lead: r.lead_id })}`} className="btn btn-ghost btn-sm">Comps</Link>}
                          <a href={`https://www.zillow.com/homes/${encodeURIComponent(full)}_rb/`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">Zillow</a>
                        </span>
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
          <span className="text-ink-soft">Page {page} of {pages} · {(count ?? 0).toLocaleString()} listings</span>
          <span className="flex gap-2">
            {page > 1 && <Link className="btn btn-ghost btn-sm" href={`/crm/scanner${qs(cur, { page: String(page - 1) })}`}>Previous</Link>}
            {page < pages && <Link className="btn btn-ghost btn-sm" href={`/crm/scanner${qs(cur, { page: String(page + 1) })}`}>Next</Link>}
          </span>
        </div>
      )}

      <details className="card mt-5 p-4 text-sm">
        <summary className="cursor-pointer font-semibold">How listings are vetted</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
          <li><b>Filters:</b> single-family, your price range and bedroom minimum, 700+ sq ft, HOA under $150/mo, no new construction.</li>
          <li><b>Seller motivation:</b> foreclosure (+30) or short sale (+25); days on market (60+ = +14, 90+ = +20, 120+ = +25); each price cut while we&apos;ve watched it (+12, max +24); relisted in the last year (+10).</li>
          <li><b>Price:</b> $/sq ft vs. other listings in the ZIP (12%+ under = +12, 20%+ = +22, 30%+ = +30).</li>
          <li><b>Deal math:</b> rough ARV = top-quarter $/sq ft in the ZIP × size, less 5%. Repairs at your Medium rate (Heavy if built before 1960). Max offer uses your MAO % and fee. Price at or under max offer = +25, within 15% = +15.</li>
          <li><b>Qualified</b> = passes the filters and scores 40+. 70+ is a strong lead.</li>
          <li>These are screening numbers from list prices. Always pull comps, rate condition, and confirm with the agent before you offer.</li>
        </ul>
      </details>
    </>
  );
}
