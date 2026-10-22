import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { PageHeader, qs } from "@/components/crm/ui";
import { money, todayCentral } from "@/lib/format";

export const metadata = { title: "Dashboard" };

type Week = { week_start: string; outreach: number; conversations: number; appointments: number; offers: number; contracts: number; closings: number; revenue: number };
type Month = { month: string; outreach: number; conversations: number; contracts: number; closings: number; revenue: number };
type Source = { lead_source: string; leads: number; contracts: number; closings: number; revenue: number; spend: number };
type Target = { month: string; outreach: number | null; contracts: number | null; closings: number | null; revenue: number | null };

const n = (x: unknown) => Number(x ?? 0);
const int = (x: unknown) => n(x).toLocaleString("en-US");
const monthLabel = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", year: "2-digit" });
const weekLabel = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

function addDays(d: string, days: number) {
  return new Date(new Date(d + "T12:00:00").getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

const KPIS: { key: keyof Week; label: string; money?: boolean }[] = [
  { key: "outreach", label: "Outreach" },
  { key: "conversations", label: "Conversations" },
  { key: "appointments", label: "Appointments" },
  { key: "offers", label: "Offers" },
  { key: "contracts", label: "Contracts" },
  { key: "closings", label: "Closings" },
  { key: "revenue", label: "Revenue", money: true },
];

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { supabase } = await requireRole("owner");
  const { range = "90" } = await searchParams;
  const today = todayCentral();
  const days = range === "30" ? 30 : range === "365" ? 365 : 90;

  const { data: tRows } = await supabase.from("monthly_targets").select("*").order("month");
  const targets = (tRows ?? []) as Target[];
  // Show the 12 target months if set; otherwise the last 6 months.
  const firstMonth = targets[0]?.month ?? `${addDays(today, -150).slice(0, 7)}-01`;
  const monthCount = targets.length ? Math.min(Math.max(targets.length, 1), 24) : 6;

  const [{ data: wk }, { data: mo }, { data: src }] = await Promise.all([
    supabase.rpc("dashboard_weeks", { p_weeks: 8 }),
    supabase.rpc("dashboard_months", { p_from: firstMonth, p_months: monthCount }),
    supabase.rpc("dashboard_sources", { p_from: addDays(today, -days), p_to: today }),
  ]);
  const weeks = (wk ?? []) as Week[];
  const months = (mo ?? []) as Month[];
  const sources = ((src ?? []) as Source[]).filter((s) => n(s.leads) || n(s.contracts) || n(s.spend));
  const [thisWeek, lastWeek] = [weeks[0], weeks[1]];
  const tByMonth = new Map(targets.map((t) => [t.month, t]));

  // Playbook conversion check: ~1,070 attempts → ~133 conversations → 1 closed deal.
  const totals = weeks.reduce((a, w) => ({ outreach: a.outreach + n(w.outreach), conv: a.conv + n(w.conversations) }), { outreach: 0, conv: 0 });
  const convRate = totals.outreach ? (totals.conv / totals.outreach) * 100 : null;

  return (
    <>
      <PageHeader title="Dashboard" sub="This week, your monthly targets, and what each lead source costs you." actions={<Link href="/crm/settings" className="btn btn-ghost btn-sm">Targets & spend</Link>} />

      {/* This week */}
      <section aria-labelledby="wk" className="mb-6">
        <h2 id="wk" className="mb-2 text-sm font-bold tracking-wide text-ink-soft uppercase">This week {thisWeek ? `(since ${weekLabel(thisWeek.week_start)})` : ""}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {KPIS.map((k) => {
            const cur = n(thisWeek?.[k.key]);
            const prev = n(lastWeek?.[k.key]);
            const diff = cur - prev;
            return (
              <div key={k.key} className="card p-3">
                <p className="text-xs font-semibold text-ink-soft">{k.label}</p>
                <p className="h-display mt-1 text-2xl font-semibold">{k.money ? money(cur) : int(cur)}</p>
                <p className="text-xs text-ink-soft">
                  {diff === 0 ? "same as last week" : `${diff > 0 ? "▲" : "▼"} ${k.money ? money(Math.abs(diff)) : int(Math.abs(diff))} vs last week`}
                </p>
              </div>
            );
          })}
        </div>
        <p className="hint mt-2">
          Outreach = calls, texts, emails, voicemails, door knocks and letters logged in follow-ups.
          {convRate !== null && ` Over 8 weeks, ${convRate.toFixed(1)}% of attempts became conversations (playbook plans on about 12%).`}
        </p>
      </section>

      {/* Last 8 weeks */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold tracking-wide text-ink-soft uppercase">Last 8 weeks</h2>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Week of</th>{KPIS.map((k) => <th key={k.key} className="text-right">{k.label}</th>)}</tr></thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.week_start}>
                  <td className="whitespace-nowrap font-medium">{weekLabel(w.week_start)}</td>
                  {KPIS.map((k) => <td key={k.key} className="text-right tabular-nums">{k.money ? money(n(w[k.key])) : int(w[k.key])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Targets vs actual */}
      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-wide text-ink-soft uppercase">Monthly targets vs. actual</h2>
          {targets.length === 0 && <Link href="/crm/settings#targets" className="text-sm underline">Set targets</Link>}
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Month</th><th>Outreach</th><th>Contracts</th><th>Closings</th><th>Revenue</th></tr></thead>
            <tbody>
              {months.map((m) => {
                const t = tByMonth.get(m.month);
                const isFuture = m.month > today;
                return (
                  <tr key={m.month} className={isFuture ? "text-ink-soft" : ""}>
                    <td className="font-medium whitespace-nowrap">{monthLabel(m.month)}</td>
                    <td><Progress actual={n(m.outreach)} target={t?.outreach} /></td>
                    <td><Progress actual={n(m.contracts)} target={t?.contracts} /></td>
                    <td><Progress actual={n(m.closings)} target={t?.closings} /></td>
                    <td><Progress actual={n(m.revenue)} target={t?.revenue != null ? n(t.revenue) : null} isMoney /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Lead sources */}
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold tracking-wide text-ink-soft uppercase">Cost per contract by lead source</h2>
          <div className="flex gap-1">
            {["30", "90", "365"].map((r) => (
              <Link key={r} href={`/crm/dashboard${qs({}, { range: r })}`} className={`btn btn-sm ${String(days) === r ? "btn-dark" : "btn-ghost"}`}>
                {r === "365" ? "12 mo" : `${r} days`}
              </Link>
            ))}
          </div>
        </div>
        {sources.length === 0 ? (
          <p className="card p-4 text-sm text-ink-soft">No leads or spend in this period yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Source</th><th className="text-right">Leads</th><th className="text-right">Contracts</th><th className="text-right">Closings</th><th className="text-right">Revenue</th><th className="text-right">Spend</th><th className="text-right">Cost / lead</th><th className="text-right">Cost / contract</th></tr></thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.lead_source}>
                    <td className="font-medium">{s.lead_source}</td>
                    <td className="text-right tabular-nums">{int(s.leads)}</td>
                    <td className="text-right tabular-nums">{int(s.contracts)}</td>
                    <td className="text-right tabular-nums">{int(s.closings)}</td>
                    <td className="text-right tabular-nums">{money(n(s.revenue))}</td>
                    <td className="text-right tabular-nums">{money(n(s.spend))}</td>
                    <td className="text-right tabular-nums">{n(s.leads) && n(s.spend) ? money(n(s.spend) / n(s.leads)) : "—"}</td>
                    <td className="text-right font-semibold tabular-nums">{n(s.spend) ? (n(s.contracts) ? money(n(s.spend) / n(s.contracts)) : "no contracts yet") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint mt-2">Playbook: increase spend only on sources with a proven cost per contract; cut anything with no contract in 60 days. Add spend under <Link href="/crm/settings#spend" className="underline">Settings</Link>.</p>
      </section>
    </>
  );
}

/** Actual vs. target as text + a single-hue meter (the number carries the meaning; the bar is secondary). */
function Progress({ actual, target, isMoney }: { actual: number; target?: number | null; isMoney?: boolean }) {
  const f = (v: number) => (isMoney ? money(v) : v.toLocaleString("en-US"));
  if (target == null || target === 0) return <span className="tabular-nums">{f(actual)}{target === 0 ? <span className="text-ink-soft"> / 0</span> : ""}</span>;
  const pct = Math.min(100, Math.round((actual / target) * 100));
  return (
    <div className="min-w-28">
      <p className="tabular-nums"><span className="font-semibold">{f(actual)}</span><span className="text-ink-soft"> / {f(target)}</span></p>
      <div className="mt-1 h-1.5 w-full rounded-full bg-line" role="img" aria-label={`${pct}% of target`}>
        <div className="h-1.5 rounded-full bg-clay" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
