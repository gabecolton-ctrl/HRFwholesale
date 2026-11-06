import type { PropertyData } from "@/lib/tracerfy";
import { money, phonePretty } from "@/lib/format";

const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n)}%`);

/** Owner, mortgage, equity and contact info from a lookup. compact = the lead sidebar version. */
export function OwnerData({ d, compact = false }: { d: PropertyData; compact?: boolean }) {
  const p = d.property;
  const flags = [
    p.pre_foreclosure && { t: "Pre-foreclosure", tone: "danger" },
    p.tax_delinquent && { t: "Tax delinquent", tone: "danger" },
    p.vacant && { t: "Vacant", tone: "clay" },
    p.absentee_owner && { t: "Absentee owner", tone: "clay" },
    p.free_clear && { t: "Free & clear", tone: "sage" },
    !p.free_clear && p.high_equity && { t: "High equity", tone: "sage" },
    p.owner_occupied && { t: "Owner lives there", tone: "ink" },
  ].filter(Boolean) as { t: string; tone: string }[];
  const toneCls: Record<string, string> = {
    danger: "bg-danger/10 text-danger",
    clay: "bg-clay/10 text-clay",
    sage: "bg-sage/10 text-sage",
    ink: "bg-ink/5 text-ink",
  };
  const grid = compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4";

  return (
    <div className="space-y-4 text-sm">
      {flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {flags.map((f) => <span key={f.t} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneCls[f.tone]}`}>{f.t}</span>)}
        </div>
      )}

      <dl className={`grid gap-3 ${grid}`}>
        <Fact label="Est. value" value={money(p.estimated_value)} />
        <Fact label="Mortgage owed (est.)" value={p.free_clear ? "$0 (free & clear)" : money(p.open_mortgage_balance)} />
        <Fact label="Equity (est.)" value={p.estimated_equity !== null ? `${money(p.estimated_equity)} · ${pct(p.equity_percent)}` : "—"} />
        <Fact label="Est. payment" value={p.estimated_mortgage_payment ? `${money(p.estimated_mortgage_payment)}/mo` : "—"} />
        <Fact label="Lender" value={p.lender_name || "—"} />
        <Fact label="Last sale" value={p.last_sale_date ? `${p.last_sale_date}${p.last_sale_price ? ` · ${money(p.last_sale_price)}` : ""}` : "—"} />
        {!compact && <Fact label="Beds / baths / sq ft" value={`${p.beds ?? "—"} / ${p.baths ?? "—"} / ${p.sqft?.toLocaleString() ?? "—"}`} />}
        {!compact && <Fact label="Year built · county" value={`${p.year_built ?? "—"} · ${p.county || "—"}`} />}
      </dl>

      <div>
        <p className="text-xs font-semibold text-ink-soft">Owner{d.owners.length > 1 ? "s" : ""}</p>
        <p className="font-semibold">{d.owners.join(" & ") || "Not found"}</p>
        {d.mailing_address && <p className="text-ink-soft">Mails to: {d.mailing_address}</p>}
      </div>

      {d.litigator && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 font-semibold text-danger">
          Known TCPA litigator. Do not call or text this owner. Mail only.
        </p>
      )}

      <div>
        <p className="mb-1 text-xs font-semibold text-ink-soft">Phones ({d.phones.length})</p>
        {d.phones.length === 0 ? (
          <p className="text-ink-soft">None found.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {d.phones.map((ph) => {
              const blocked = d.litigator || ph.dnc || ph.tcpa;
              return (
                <li key={ph.number} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span>
                    <span className={`font-medium tabular-nums ${blocked ? "text-ink-soft line-through" : ""}`}>{phonePretty(ph.number)}</span>
                    <span className="ml-2 text-xs text-ink-soft">{[ph.type, ph.carrier].filter(Boolean).join(" · ")}</span>
                  </span>
                  {blocked ? (
                    <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">{ph.tcpa || d.litigator ? "Litigator: don't contact" : "Do Not Call list"}</span>
                  ) : (
                    <span className="flex gap-1.5">
                      <a href={`tel:${ph.number}`} className="btn btn-ghost btn-sm">Call</a>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {d.emails.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink-soft">Emails</p>
          <ul className="space-y-0.5">{d.emails.map((e) => <li key={e}><a className="underline" href={`mailto:${e}`}>{e}</a></li>)}</ul>
        </div>
      )}

      <p className="hint">
        Mortgage, equity and payment are estimates from public records. Get the real balance, rate and payment from the seller&apos;s mortgage statement before you make a terms offer.
        Looked up {new Date(d.fetched_at).toLocaleDateString("en-US")}.
      </p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-ink-soft">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
