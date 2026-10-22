import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { REHAB_LEVELS } from "@/lib/constants";
import { money, dateShort, toNumber } from "@/lib/format";
import { fitsBuyBox, publicPhoto, specs, where, type PortalDeal } from "@/lib/portal";
import { ASSIGNMENT_DISCLOSURE } from "@/lib/site";

export const metadata = { title: "Deals" };

type SP = { area?: string; max?: string; rehab?: string; mine?: string };

export default async function PortalDeals({ searchParams }: { searchParams: Promise<SP> }) {
  const { supabase, profile } = await requireRole("buyer");
  const sp = await searchParams;
  const [{ data }, { data: me }, { data: offers }] = await Promise.all([
    supabase.rpc("portal_deals"),
    supabase.from("cash_buyers").select("areas,price_min,price_max,rehab_levels,property_types,pof_path,pof_verified,status").maybeSingle(),
    supabase.rpc("portal_my_offers"),
  ]);
  const all = (data ?? []) as PortalDeal[];
  const max = toNumber(sp.max ?? null);
  const term = (sp.area ?? "").trim().toLowerCase();
  const deals = all.filter((d) => {
    if (term && ![d.area, d.city, d.state, d.zip].some((x) => (x ?? "").toLowerCase().includes(term))) return false;
    if (max !== null && d.list_price !== null && d.list_price > max) return false;
    if (sp.rehab && d.rehab_level !== sp.rehab) return false;
    if (sp.mine === "1" && !fitsBuyBox(d, me)) return false;
    return true;
  });

  return (
    <>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="h-display text-3xl font-semibold">Deals</h1>
          <p className="mt-1 text-ink-soft">Off-market properties H.R.F Assets LLC has under contract. Hi {profile.full_name?.split(" ")[0] ?? "there"}.</p>
        </div>
        {(offers ?? []).length > 0 && <p className="text-sm text-ink-soft">You've sent {(offers ?? []).length} offer{(offers ?? []).length === 1 ? "" : "s"} or inquiries.</p>}
      </div>

      {me?.status === "Inactive" && <p className="mb-4 rounded-lg bg-amber/10 p-3 text-sm text-amber">Your buyer account is inactive. Contact us to reactivate it.</p>}
      {me && !me.pof_path && (
        <p className="mb-4 rounded-lg bg-amber/10 p-3 text-sm">
          <strong>Add your proof of funds</strong> so we can move fast when you make an offer. <Link href="/portal/account" className="font-semibold underline">Upload it</Link>
        </p>
      )}

      <form className="card mb-5 grid gap-3 p-3 sm:grid-cols-[1.5fr_1fr_1fr_auto_auto] sm:items-center">
        <input name="area" defaultValue={sp.area} className="input" placeholder="Area, city or ZIP" aria-label="Area" />
        <input name="max" defaultValue={sp.max} className="input" inputMode="numeric" placeholder="Max price" aria-label="Max price" />
        <select name="rehab" defaultValue={sp.rehab ?? ""} className="input" aria-label="Rehab level">
          <option value="">Any rehab</option>
          {REHAB_LEVELS.map((r) => <option key={r}>{r}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm whitespace-nowrap"><input type="checkbox" name="mine" value="1" defaultChecked={sp.mine === "1"} className="check mt-0" /> Fits my buy box</label>
        <button className="btn btn-dark btn-sm">Filter</button>
      </form>

      {deals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-white px-6 py-12 text-center">
          <p className="font-semibold">{all.length === 0 ? "No deals available right now" : "No deals match these filters"}</p>
          <p className="mt-1 text-sm text-ink-soft">We'll email you when a new deal fits your buy box. <Link href="/portal/account" className="underline">Check your buy box</Link>.</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {deals.map((d) => (
            <li key={d.id}>
              <Link href={`/portal/deals/${d.id}`} className="card block overflow-hidden hover:border-ink-soft">
                <div className="relative aspect-[4/3] bg-paper">
                  {d.photo_paths[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={publicPhoto(d.photo_paths[0])} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-ink-soft">Photos coming soon</div>
                  )}
                  <span className={`pill absolute top-2 left-2 ${d.status === "Available" ? "bg-sage text-white" : "bg-ink text-white"}`}>{d.status}</span>
                  {fitsBuyBox(d, me) && <span className="pill absolute top-2 right-2 bg-clay text-white">Fits your buy box</span>}
                </div>
                <div className="p-4">
                  <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{where(d)}</p>
                  <p className="h-display mt-1 text-2xl font-semibold">{money(d.list_price)}</p>
                  <p className="text-sm text-ink-soft">{[d.property_type, specs(d)].filter(Boolean).join(" · ")}</p>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div><dt className="text-xs text-ink-soft">ARV</dt><dd className="font-semibold">{money(d.arv)}</dd></div>
                    <div><dt className="text-xs text-ink-soft">Repairs</dt><dd className="font-semibold">{money(d.repair_estimate)}</dd></div>
                    <div><dt className="text-xs text-ink-soft">Close by</dt><dd className="font-semibold">{dateShort(d.closing_date)}</dd></div>
                  </dl>
                  <p className="mt-3 border-t border-line pt-2 text-[11px] leading-snug text-ink-soft">{ASSIGNMENT_DISCLOSURE}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
