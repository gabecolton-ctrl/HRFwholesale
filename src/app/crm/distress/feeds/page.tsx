import { requireRole } from "@/lib/auth";
import { Notice, PageHeader } from "@/components/crm/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { US_STATES } from "@/lib/constants";
import { dateTime } from "@/lib/format";
import type { Feed } from "@/lib/socrata";
import { addFeed, deleteFeed, pullFeedNow, updateFeed } from "../actions";
import { DistressTabs } from "../ui";

export const metadata = { title: "City feeds" };
export const maxDuration = 60;

type Params = { added?: string; saved?: string; deleted?: string; pulled?: string; scanned?: string; error?: string };
type Row = Feed & { active: boolean; last_count: number | null; last_error: string | null };

export default async function FeedsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase } = await requireRole("owner");
  const sp = await searchParams;
  const { data } = await supabase.from("signal_feeds").select("*").order("created_at");
  const feeds = (data ?? []) as Row[];

  return (
    <>
      <PageHeader title="Distress leads" sub="Free code-complaint data from city open-data sites. New complaints land in your Inbox every morning." />
      <DistressTabs canBuild isOwner />

      {sp.error && <Notice tone="danger">{sp.error}</Notice>}
      {sp.added && <Notice>Feed added. Tap “Pull now” to load the last 2 weeks.</Notice>}
      {sp.saved && <Notice>Saved.</Notice>}
      {sp.deleted && <Notice>Feed removed.</Notice>}
      {sp.pulled && <Notice>Pulled {sp.pulled} new complaint{sp.pulled === "1" ? "" : "s"} (checked {sp.scanned ?? 0} matching records).</Notice>}

      <div className="space-y-4">
        {feeds.map((f) => (
          <section key={f.id} className="card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{f.name} {!f.active && <span className="ml-1 rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink-soft">Paused</span>}</h2>
                <p className="text-sm text-ink-soft">{f.city}, {f.state} · <a className="underline" href={`https://${f.domain}/d/${f.dataset_id}`} target="_blank" rel="noreferrer">{f.domain}</a></p>
                <p className="mt-1 text-sm">
                  {f.last_pulled_at ? <>Last pulled {dateTime(f.last_pulled_at)} · {f.last_count ?? 0} new</> : "Not pulled yet"}
                </p>
                {f.last_error && <p className="mt-1 text-sm text-danger">Last error: {f.last_error}</p>}
              </div>
              <div className="flex gap-2">
                <form action={pullFeedNow}><input type="hidden" name="id" value={f.id} /><SubmitButton pendingText="Pulling…" className="btn btn-dark btn-sm">Pull now</SubmitButton></form>
                <form action={deleteFeed}><input type="hidden" name="id" value={f.id} /><ConfirmButton message={`Remove ${f.name}? Complaints already in your Inbox are removed too.`} className="btn btn-ghost btn-sm">Remove</ConfirmButton></form>
              </div>
            </div>

            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-ink-soft">Settings</summary>
              <form action={updateFeed} className="mt-3 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={f.id} />
                <div><label className="label" htmlFor={`n-${f.id}`}>Name</label><input id={`n-${f.id}`} name="name" className="input" defaultValue={f.name} /></div>
                <label className="flex items-end gap-2 pb-2"><input type="checkbox" name="active" className="check" defaultChecked={f.active} /> Pull automatically every morning</label>
                <div className="col-span-full">
                  <label className="label" htmlFor={`k-${f.id}`}>Only keep complaint types containing (comma-separated)</label>
                  <input id={`k-${f.id}`} name="keywords" className="input" defaultValue={f.keywords.join(", ")} />
                  <p className="hint">Blank keeps everything. These are the kinds of complaints that usually mean a neglected or vacant house.</p>
                </div>
                <p className="col-span-full text-xs font-semibold text-ink-soft">Advanced: column names (detected automatically; change only if pulls come back empty or wrong)</p>
                {([["field_address", "Address column"], ["field_type", "Complaint type column"], ["field_date", "Date column"], ["field_zip", "ZIP column"], ["field_id", "Record ID column"]] as const).map(([k, l]) => (
                  <div key={k}><label className="label" htmlFor={`${k}-${f.id}`}>{l}</label><input id={`${k}-${f.id}`} name={k} className="input font-mono text-xs" defaultValue={(f[k] as string | null) ?? ""} /></div>
                ))}
                <div className="col-span-full"><SubmitButton className="btn btn-primary btn-sm">Save settings</SubmitButton></div>
              </form>
            </details>
          </section>
        ))}
      </div>

      <section className="card mt-6 p-4 sm:p-5">
        <h2 className="mb-1 font-semibold">Add a city</h2>
        <p className="mb-3 text-sm text-ink-soft">
          Many cities publish code complaints or 311 requests on an open-data site (Fort Worth, Austin, San Antonio, Houston, Chicago, Kansas City and more).
          Search “[city] open data code violations,” open the dataset, and paste its web address here. It must be a Socrata-style site (the address ends in an ID like <code>abcd-1234</code>).
        </p>
        <form action={addFeed} className="grid gap-3 sm:grid-cols-2">
          <div className="col-span-full"><label className="label" htmlFor="link">Dataset web address</label><input id="link" name="link" className="input" placeholder="https://data.cityname.gov/Housing/Code-Violations/abcd-1234" required /></div>
          <div><label className="label" htmlFor="city">City</label><input id="city" name="city" className="input" required /></div>
          <div>
            <label className="label" htmlFor="state">State</label>
            <select id="state" name="state" className="input" defaultValue="TX">{US_STATES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
          </div>
          <div><label className="label" htmlFor="name">Name (optional)</label><input id="name" name="name" className="input" placeholder="Fort Worth code violations" /></div>
          <div><label className="label" htmlFor="keywords">Only keep types containing (optional)</label><input id="keywords" name="keywords" className="input" defaultValue="weed, vacant, structure, junk, trash, dangerous, substandard, boarded" /></div>
          <div className="col-span-full"><SubmitButton pendingText="Checking dataset…">Add city</SubmitButton></div>
        </form>
      </section>
    </>
  );
}
