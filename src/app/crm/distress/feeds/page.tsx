import { requireRole } from "@/lib/auth";
import { Notice, PageHeader } from "@/components/crm/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { US_STATES } from "@/lib/constants";
import { dateTime } from "@/lib/format";
import { feedTypes, typeMatches, type Feed } from "@/lib/socrata";
import { addFeed, deleteFeed, pullFeedNow, updateFeed } from "../actions";
import { DistressTabs } from "../ui";

export const metadata = { title: "City feeds" };
export const maxDuration = 60;

type Params = { types?: string; added?: string; saved?: string; deleted?: string; pulled?: string; scanned?: string; error?: string };
type Row = Feed & { active: boolean; last_count: number | null; last_error: string | null };

export default async function FeedsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase } = await requireRole("owner");
  const sp = await searchParams;
  const { data } = await supabase.from("signal_feeds").select("*").order("created_at");
  const feeds = (data ?? []) as Row[];

  // "See complaint types": what the city logged in the last 30 days, so you can pick keywords.
  let types: { type: string; n: number }[] | null = null;
  let typesError = "";
  const typesFeed = feeds.find((f) => f.id === sp.types);
  if (typesFeed) {
    try {
      types = await feedTypes(typesFeed);
    } catch (e) {
      typesError = (e as Error).message;
    }
  }

  return (
    <>
      <PageHeader title="Distress leads" sub="Free code-complaint data from city open-data sites. New complaints land in your Inbox every morning." />
      <DistressTabs canBuild isOwner />

      {sp.error && <Notice tone="danger">{sp.error}</Notice>}
      {sp.added && <Notice>Feed added. Tap “Pull now” to load the last 2 weeks.</Notice>}
      {sp.saved && <Notice>Saved.</Notice>}
      {sp.deleted && <Notice>Feed removed.</Notice>}
      {sp.pulled && (
        <Notice tone={sp.pulled === "0" ? "amber" : "sage"}>
          Pulled {sp.pulled} new complaint{sp.pulled === "1" ? "" : "s"} ({sp.scanned ?? 0} matched your words in the last 2 weeks).
          {sp.pulled === "0" && " Tap “See complaint types” to check which types the city actually uses, then adjust the words in Settings."}
        </Notice>
      )}
      {typesError && <Notice tone="danger">{typesError}</Notice>}

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
                <a href={sp.types === f.id ? "/crm/distress/feeds" : `/crm/distress/feeds?types=${f.id}`} className="btn btn-ghost btn-sm">{sp.types === f.id ? "Hide types" : "See complaint types"}</a>
                <form action={deleteFeed}><input type="hidden" name="id" value={f.id} /><ConfirmButton message={`Remove ${f.name}? Complaints already in your Inbox are removed too.`} className="btn btn-ghost btn-sm">Remove</ConfirmButton></form>
              </div>
            </div>

            {sp.types === f.id && types && (
              <div className="mt-4 rounded-lg border border-line p-3">
                <p className="mb-2 text-sm font-semibold">Complaint types in the last 30 days ({types.length}). Green ones pass your current words.</p>
                {types.length === 0 ? (
                  <p className="text-sm text-ink-soft">The city logged nothing in the last 30 days. The dataset may have moved or stopped updating.</p>
                ) : (
                  <ul className="grid max-h-96 gap-x-4 gap-y-1 overflow-y-auto text-sm sm:grid-cols-2">
                    {types.map((t) => {
                      const on = typeMatches(f.keywords, t.type);
                      return (
                        <li key={t.type} className="flex justify-between gap-2">
                          <span className={on ? "font-semibold text-sage" : "text-ink-soft"}>{on ? "✓ " : ""}{t.type}</span>
                          <span className="tabular-nums text-ink-soft">{t.n.toLocaleString()}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            <details className="mt-3 text-sm" open={sp.types === f.id}>
              <summary className="cursor-pointer text-ink-soft">Settings</summary>
              <form action={updateFeed} className="mt-3 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={f.id} />
                <div><label className="label" htmlFor={`n-${f.id}`}>Name</label><input id={`n-${f.id}`} name="name" className="input" defaultValue={f.name} /></div>
                <label className="flex items-end gap-2 pb-2"><input type="checkbox" name="active" className="check" defaultChecked={f.active} /> Pull automatically every morning</label>
                <div className="col-span-full">
                  <label className="label" htmlFor={`k-${f.id}`}>Only keep complaint types containing (comma-separated)</label>
                  <input id={`k-${f.id}`} name="keywords" className="input" defaultValue={f.keywords.join(", ")} />
                  <p className="hint">Blank keeps everything. Put a minus in front to throw a type out (like -sign). Aim for complaints about a specific house being neglected or vacant.</p>
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
          <div><label className="label" htmlFor="keywords">Only keep types containing (optional)</label><input id="keywords" name="keywords" className="input" defaultValue="weed, vacant, substandard, structure, unsecure, boarded, stagnant" /></div>
          <div className="col-span-full"><SubmitButton pendingText="Checking dataset…">Add city</SubmitButton></div>
        </form>
      </section>
    </>
  );
}
