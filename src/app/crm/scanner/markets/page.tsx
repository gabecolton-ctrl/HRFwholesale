import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Notice, PageHeader } from "@/components/crm/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { US_STATES } from "@/lib/constants";
import { dateTime } from "@/lib/format";
import { MONTHLY_LIMIT } from "@/lib/rentcast";
import { rentcastUsedThisMonth } from "@/lib/scanner";
import { deleteMarket, saveMarket, scanNow } from "../actions";

export const metadata = { title: "Scanner cities" };
export const maxDuration = 60;

type Params = { scanned?: string; listings?: string; qualified?: string; requests?: string; saved?: string; deleted?: string; error?: string };
type M = { id: string; city: string; state: string; active: boolean; price_min: number; price_max: number; min_beds: number; last_scanned_at: string | null; last_count: number | null; last_qualified: number | null; last_error: string | null };

export default async function Markets({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase } = await requireRole("owner");
  const sp = await searchParams;
  const [{ data }, used] = await Promise.all([supabase.from("scan_markets").select("*").order("city"), rentcastUsedThisMonth(supabase)]);
  const markets = (data ?? []) as M[];
  const active = markets.filter((m) => m.active).length;

  return (
    <>
      <p className="mb-3 text-sm"><Link href="/crm/scanner" className="text-ink-soft underline">← Deal Scanner</Link></p>
      <PageHeader title="Scanner cities" sub="Each active city is scanned once a week, automatically. A scan uses 1–2 RentCast requests." />

      {sp.error && <Notice tone="danger">{sp.error}</Notice>}
      {sp.scanned && <Notice>{sp.scanned}: checked {sp.listings} listings, {sp.qualified} qualified ({sp.requests} RentCast request{sp.requests === "1" ? "" : "s"}). <Link href="/crm/scanner" className="underline">See them</Link></Notice>}
      {sp.saved && <Notice>Saved.</Notice>}
      {sp.deleted && <Notice>City removed.</Notice>}

      <p className="mb-4 text-sm text-ink-soft">
        RentCast use this month: <b>{used} of {MONTHLY_LIMIT}</b> (comps and scans share it). {active} active {active === 1 ? "city" : "cities"} ≈ {active * 4}–{active * 8} requests a month.
        {active * 4 > MONTHLY_LIMIT - 10 && " That's close to your limit. Pause some cities or upgrade RentCast and raise RENTCAST_MONTHLY_LIMIT."}
      </p>

      <div className="space-y-3">
        {markets.map((m) => (
          <section key={m.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{m.city}, {m.state} {!m.active && <span className="ml-1 rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink-soft">Paused</span>}</h2>
                <p className="text-sm text-ink-soft">
                  {m.last_scanned_at ? <>Scanned {dateTime(m.last_scanned_at)} · {m.last_count ?? 0} listings · {m.last_qualified ?? 0} qualified</> : "Not scanned yet"}
                </p>
                {m.last_error && <p className="mt-1 text-sm text-amber">{m.last_error}</p>}
              </div>
              <div className="flex gap-2">
                <form action={scanNow}><input type="hidden" name="id" value={m.id} /><SubmitButton pendingText="Scanning…" className="btn btn-dark btn-sm">Scan now</SubmitButton></form>
                <form action={deleteMarket}><input type="hidden" name="id" value={m.id} /><ConfirmButton message={`Remove ${m.city}? Its scanned listings are removed too (leads you made stay).`} className="btn btn-ghost btn-sm">Remove</ConfirmButton></form>
              </div>
            </div>
            <form action={saveMarket} className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-[1fr_1fr_6rem_auto_auto] sm:items-end">
              <input type="hidden" name="id" value={m.id} />
              <input type="hidden" name="city" value={m.city} />
              <input type="hidden" name="state" value={m.state} />
              <div><label className="label" htmlFor={`min-${m.id}`}>Min price</label><input id={`min-${m.id}`} name="price_min" className="input" inputMode="numeric" defaultValue={m.price_min} /></div>
              <div><label className="label" htmlFor={`max-${m.id}`}>Max price</label><input id={`max-${m.id}`} name="price_max" className="input" inputMode="numeric" defaultValue={m.price_max} /></div>
              <div><label className="label" htmlFor={`bd-${m.id}`}>Min beds</label><input id={`bd-${m.id}`} name="min_beds" className="input" inputMode="numeric" defaultValue={m.min_beds} /></div>
              <label className="flex items-center gap-2 pb-2"><input type="checkbox" name="active" className="check mt-0" defaultChecked={m.active} /> Weekly scan on</label>
              <SubmitButton className="btn btn-ghost btn-sm">Save</SubmitButton>
            </form>
          </section>
        ))}
      </div>

      <section className="card mt-6 p-4 sm:p-5">
        <h2 className="mb-3 font-semibold">Add a city</h2>
        <form action={saveMarket} className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_8rem_1fr_1fr_6rem_auto] sm:items-end">
          <div className="col-span-2 sm:col-span-1"><label className="label" htmlFor="city">City</label><input id="city" name="city" className="input" required placeholder="Memphis" /></div>
          <div>
            <label className="label" htmlFor="state">State</label>
            <select id="state" name="state" className="input" defaultValue="TX">{US_STATES.map(([c]) => <option key={c} value={c}>{c}</option>)}</select>
          </div>
          <div><label className="label" htmlFor="price_min">Min price</label><input id="price_min" name="price_min" className="input" inputMode="numeric" defaultValue={60000} /></div>
          <div><label className="label" htmlFor="price_max">Max price</label><input id="price_max" name="price_max" className="input" inputMode="numeric" defaultValue={350000} /></div>
          <div><label className="label" htmlFor="min_beds">Min beds</label><input id="min_beds" name="min_beds" className="input" inputMode="numeric" defaultValue={2} /></div>
          <SubmitButton>Add city</SubmitButton>
        </form>
        <p className="hint mt-3">
          City names must match how listings spell them (e.g. “Fort Worth”, not “Ft Worth”). Strong wholesale markets outside Texas to consider: Memphis TN, Birmingham AL, Jackson MS, Cleveland OH, Detroit MI, Indianapolis IN, Kansas City MO, St. Louis MO. Only add cities where you have buyers.
        </p>
      </section>
    </>
  );
}
