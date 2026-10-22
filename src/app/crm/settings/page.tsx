import { requireRole } from "@/lib/auth";
import { Notice, PageHeader } from "@/components/crm/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { getSettings } from "@/lib/settings";
import { LEAD_SOURCES } from "@/lib/constants";
import { money, todayCentral } from "@/lib/format";
import { addSpend, deleteSpend, fillPlaybookTargets, saveDefaults, saveTargets } from "./actions";

export const metadata = { title: "Settings" };

const monthLabel = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });

export default async function Settings({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { supabase } = await requireRole("owner");
  const sp = await searchParams;
  const settings = await getSettings(supabase);
  const [{ data: targets }, { data: spend }] = await Promise.all([
    supabase.from("monthly_targets").select("*").order("month"),
    supabase.from("marketing_spend").select("*").order("month", { ascending: false }).limit(60),
  ]);
  const thisMonth = todayCentral().slice(0, 7);

  return (
    <>
      <PageHeader title="Settings" sub="Defaults for the Deal Analyzer, your monthly targets, and marketing spend for cost per contract." />
      {sp.saved && <Notice>Saved.</Notice>}
      {sp.error && <Notice tone="danger">{sp.error}</Notice>}

      <section className="card mb-5 p-4 sm:p-5">
        <h2 className="font-semibold">Deal Analyzer defaults</h2>
        <form action={saveDefaults} className="mt-3 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["default_mao_pct", "MAO %", settings.default_mao_pct],
            ["default_fee", "Default fee ($)", settings.default_fee],
            ["rehab_turnkey_sqft", "Turnkey $/sqft", settings.rehab_turnkey_sqft],
            ["rehab_light_sqft", "Light $/sqft", settings.rehab_light_sqft],
            ["rehab_medium_sqft", "Medium $/sqft", settings.rehab_medium_sqft],
            ["rehab_heavy_sqft", "Heavy $/sqft", settings.rehab_heavy_sqft],
          ].map(([k, label, v]) => (
            <div key={String(k)}><label className="label text-xs" htmlFor={String(k)}>{label}</label><input id={String(k)} name={String(k)} className="input" inputMode="decimal" defaultValue={String(v)} /></div>
          ))}
          <div className="col-span-full"><SubmitButton className="btn btn-dark btn-sm">Save defaults</SubmitButton></div>
        </form>
        <p className="hint mt-2">Playbook rehab ranges: light $15–25/sqft, medium $30–45, heavy $50+.</p>
      </section>

      <section id="targets" className="card mb-5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold">Monthly targets</h2>
            <p className="text-sm text-ink-soft">The dashboard compares these to your actual numbers.</p>
          </div>
          <form action={fillPlaybookTargets} className="flex flex-wrap items-end gap-2">
            <div><label className="label text-xs" htmlFor="start">Month 1 of your plan</label><input id="start" name="start" type="month" className="input" defaultValue={thisMonth} /></div>
            <div><label className="label text-xs" htmlFor="avg_fee">Avg fee</label><input id="avg_fee" name="avg_fee" className="input w-28" inputMode="numeric" defaultValue="12000" /></div>
            <SubmitButton className="btn btn-ghost btn-sm">Fill 12 months from playbook</SubmitButton>
          </form>
        </div>
        {(targets ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">No targets yet. Use the playbook fill (1 → 7 closings a month over 12 months), then adjust.</p>
        ) : (
          <form action={saveTargets} className="mt-4">
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Month</th><th>Outreach</th><th>Contracts</th><th>Closings</th><th>Revenue</th></tr></thead>
                <tbody>
                  {(targets ?? []).map((t) => (
                    <tr key={t.month}>
                      <td className="whitespace-nowrap font-medium">{monthLabel(t.month)}<input type="hidden" name="month" value={t.month} /></td>
                      {(["outreach", "contracts", "closings", "revenue"] as const).map((k) => (
                        <td key={k}><input name={k} className="input min-h-9 w-24 py-1" inputMode="numeric" defaultValue={t[k] ?? ""} aria-label={`${k} ${t.month}`} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SubmitButton className="btn btn-dark btn-sm mt-3">Save targets</SubmitButton>
          </form>
        )}
      </section>

      <section id="spend" className="card p-4 sm:p-5">
        <h2 className="font-semibold">Marketing spend</h2>
        <p className="text-sm text-ink-soft">Enter what each lead source cost per month. The dashboard divides it by contracts from that source.</p>
        <form action={addSpend} className="mt-3 grid gap-3 sm:grid-cols-[9rem_1fr_8rem_1fr_auto] sm:items-end">
          <div><label className="label text-xs" htmlFor="sm-month">Month</label><input id="sm-month" name="month" type="month" className="input" defaultValue={thisMonth} /></div>
          <div><label className="label text-xs" htmlFor="sm-src">Lead source</label>
            <select id="sm-src" name="lead_source" className="input">{LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className="label text-xs" htmlFor="sm-amt">Amount</label><input id="sm-amt" name="amount" className="input" inputMode="numeric" placeholder="$" /></div>
          <div><label className="label text-xs" htmlFor="sm-notes">Notes</label><input id="sm-notes" name="notes" className="input" placeholder="e.g. 500 letters" /></div>
          <SubmitButton className="btn btn-dark btn-sm">Save</SubmitButton>
        </form>
        {(spend ?? []).length > 0 && (
          <div className="table-wrap mt-4">
            <table className="data">
              <thead><tr><th>Month</th><th>Source</th><th>Amount</th><th>Notes</th><th></th></tr></thead>
              <tbody>
                {(spend ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{monthLabel(r.month)}</td><td>{r.lead_source}</td><td>{money(r.amount)}</td><td className="text-ink-soft">{r.notes ?? ""}</td>
                    <td><form action={deleteSpend}><input type="hidden" name="id" value={r.id} /><button className="text-xs text-danger underline">Remove</button></form></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint mt-2">Saving the same month and source again replaces the amount.</p>
      </section>
    </>
  );
}
