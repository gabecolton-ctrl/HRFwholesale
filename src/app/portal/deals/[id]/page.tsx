import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { dateShort, dateTime, money } from "@/lib/format";
import { publicPhoto, specs, where, type PortalDeal } from "@/lib/portal";
import { ASSIGNMENT_DISCLOSURE, site } from "@/lib/site";
import { acknowledgeDeal, submitInterest } from "../actions";

export const metadata = { title: "Deal" };

export default async function PortalDealPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { supabase } = await requireRole("buyer");
  const { id } = await params;
  const sp = await searchParams;
  const [{ data }, { data: myOffers }] = await Promise.all([supabase.rpc("portal_deals"), supabase.rpc("portal_my_offers")]);
  const d = ((data ?? []) as PortalDeal[]).find((x) => x.id === id);
  if (!d) notFound();
  const mine = ((myOffers ?? []) as { id: string; deal_id: string; created_at: string; kind: string; amount: number | null; close_by: string | null; status: string }[]).filter((o) => o.deal_id === id);
  const open = d.status === "Available";
  const spread = d.arv != null && d.list_price != null ? d.arv - d.list_price - (d.repair_estimate ?? 0) : null;

  return (
    <div className="mx-auto max-w-5xl">
      <p className="mb-3 text-sm"><Link href="/portal" className="text-ink-soft underline">← All deals</Link></p>
      {sp.error && <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">{sp.error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          {/* Photos */}
          {d.photo_paths.length > 0 ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={publicPhoto(d.photo_paths[0])} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" />
              {d.photo_paths.length > 1 && (
                <div className="flex snap-x gap-2 overflow-x-auto pb-1">
                  {d.photo_paths.slice(1).map((p) => (
                    <a key={p} href={publicPhoto(p)} target="_blank" rel="noreferrer" className="shrink-0 snap-start">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={publicPhoto(p)} alt="" className="h-24 w-32 rounded-lg object-cover sm:h-28 sm:w-40" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-white text-ink-soft ring-1 ring-line">Photos coming soon</div>
          )}

          {d.description && (
            <section className="card p-5">
              <h2 className="font-semibold">About this property</h2>
              <p className="mt-2 whitespace-pre-line text-ink-soft">{d.description}</p>
            </section>
          )}

          <section className="card p-5">
            <h2 className="font-semibold">Sold comps</h2>
            {d.comps.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">Comps available on request. Call {site.phone}.</p>
            ) : (
              <div className="table-wrap mt-3">
                <table className="data">
                  <thead><tr><th>Address</th><th>Sold</th><th>Date</th><th>Bd/Ba</th><th>Sqft</th><th>Dist.</th></tr></thead>
                  <tbody>
                    {d.comps.map((c, i) => (
                      <tr key={i}>
                        <td>{c.address ?? "—"}</td>
                        <td className="font-semibold">{money(c.sold_price ?? null)}</td>
                        <td className="whitespace-nowrap">{c.sold_date ? dateShort(c.sold_date) : "—"}</td>
                        <td>{c.beds ?? "—"}/{c.baths ?? "—"}</td>
                        <td>{c.sqft ? Number(c.sqft).toLocaleString() : "—"}</td>
                        <td>{c.distance ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="hint mt-2">Do your own due diligence on value, repairs, title and condition.</p>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{where(d)}</p>
              <span className={`pill ${open ? "bg-sage text-white" : "bg-ink text-white"}`}>{d.status}</span>
            </div>
            <p className="h-display mt-1 text-4xl font-semibold">{money(d.list_price)}</p>
            <p className="text-ink-soft">{[d.property_type, specs(d), d.year_built && `built ${d.year_built}`].filter(Boolean).join(" · ")}</p>
            <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-ink-soft">ARV</dt><dd className="text-right font-semibold">{money(d.arv)}</dd>
              <dt className="text-ink-soft">Repair estimate</dt><dd className="text-right font-semibold">{money(d.repair_estimate)}{d.rehab_level ? ` · ${d.rehab_level}` : ""}</dd>
              <dt className="text-ink-soft">ARV − price − repairs</dt><dd className="text-right font-semibold">{money(spread)}</dd>
              <dt className="text-ink-soft">Close by</dt><dd className="text-right font-semibold">{dateShort(d.closing_date)}</dd>
            </dl>

            {/* Built-in disclosure: always shown, cannot be edited from the CRM */}
            <p className="mt-4 rounded-lg border border-ink/15 bg-paper p-3 text-sm font-medium">{ASSIGNMENT_DISCLOSURE}</p>
          </section>

          <section id="details" className="card p-5">
            {!d.acknowledged ? (
              <form action={acknowledgeDeal} className="space-y-3">
                <input type="hidden" name="deal_id" value={d.id} />
                <h2 className="font-semibold">See the full address</h2>
                <label className="flex gap-3 text-sm">
                  <input type="checkbox" name="agree" required className="check" />
                  <span>I understand that H.R.F Assets LLC is assigning its equitable interest in a contract to purchase this property and does not hold legal title. I'll keep deal details confidential.</span>
                </label>
                <SubmitButton className="btn btn-primary w-full" pendingText="Unlocking…">Acknowledge and show address</SubmitButton>
              </form>
            ) : (
              <>
                <h2 className="font-semibold">Address</h2>
                <p className="mt-1 text-lg">{d.address}</p>
                <p className="text-sm text-ink-soft">{[d.city, d.state, d.zip].filter(Boolean).join(" ")}</p>
                <a className="btn btn-ghost btn-sm mt-3" target="_blank" rel="noreferrer"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.address} ${d.city ?? ""} ${d.state ?? ""} ${d.zip ?? ""}`)}`}>Open in Maps</a>
                <p className="hint mt-2">Please don't contact the seller or visit without scheduling a walkthrough with us.</p>
              </>
            )}
          </section>

          {d.acknowledged && (
            <section id="offer" className="card p-5">
              {sp.sent && (
                <p className="mb-3 rounded-lg bg-sage/10 p-3 text-sm font-medium text-sage">
                  {sp.sent === "offer" ? "Offer sent." : "Got it."} We'll be in touch shortly.
                </p>
              )}
              {open ? (
                <>
                  <h2 className="font-semibold">Interested?</h2>
                  <form action={submitInterest} className="mt-3 space-y-3">
                    <input type="hidden" name="deal_id" value={d.id} />
                    <div className="flex gap-2">
                      <label className="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border border-line text-sm font-semibold has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white">
                        <input type="radio" name="kind" value="interest" defaultChecked className="sr-only" /> I'm interested
                      </label>
                      <label className="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border border-line text-sm font-semibold has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white">
                        <input type="radio" name="kind" value="offer" className="sr-only" /> Make an offer
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="label text-xs" htmlFor="amount">Offer amount</label><input id="amount" name="amount" inputMode="numeric" className="input" placeholder={d.list_price ? String(d.list_price) : "$"} /></div>
                      <div><label className="label text-xs" htmlFor="close_by">Can close by</label><input id="close_by" name="close_by" type="date" className="input" /></div>
                    </div>
                    <div><label className="label text-xs" htmlFor="message">Message (optional)</label><textarea id="message" name="message" rows={3} maxLength={2000} className="input" placeholder="Walkthrough times, questions, how you're funding it" /></div>
                    <SubmitButton className="btn btn-primary w-full" pendingText="Sending…">Send</SubmitButton>
                    <p className="hint">Not binding. If we move forward, you'll sign a written assignment with a non-refundable earnest money deposit.</p>
                  </form>
                </>
              ) : (
                <p className="text-sm text-ink-soft">This deal is pending with another buyer. We'll email you if it comes back.</p>
              )}
              {mine.length > 0 && (
                <div className="mt-4 border-t border-line pt-3">
                  <h3 className="text-sm font-semibold">Your submissions</h3>
                  <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                    {mine.map((o) => (
                      <li key={o.id}>{o.kind === "offer" ? `Offer ${money(o.amount)}` : "Interest"} · {dateTime(o.created_at)} · <span className="font-semibold text-ink">{o.status}</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
          <p className="text-center text-sm text-ink-soft">Questions? Call <a className="font-semibold underline" href={site.phoneHref}>{site.phone}</a></p>
        </aside>
      </div>
    </div>
  );
}
