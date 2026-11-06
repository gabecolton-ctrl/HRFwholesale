import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Notice, PageHeader, qs } from "@/components/crm/ui";
import { dateShort, money } from "@/lib/format";
import type { PropertyData } from "@/lib/tracerfy";
import { makeLeads, setSignalStatus } from "./actions";
import { DistressTabs, SelectAll } from "./ui";

export const metadata = { title: "Distress leads" };

const PER_PAGE = 50;
type Params = { status?: string; source?: string; q?: string; page?: string; made?: string; linked?: string; dismissed?: string; restored?: string; error?: string };
type Row = {
  id: string; created_at: string; source: "feed" | "list"; signal_type: string; address: string; city: string | null; state: string | null; zip: string | null;
  reported_at: string | null; property_data: PropertyData | null; status: string; lead_id: string | null;
  signal_feeds: { name: string } | null; lead_lists: { name: string } | null;
};

export default async function DistressInbox({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase, profile } = await requireRole("owner", "acquisitions", "va");
  const sp = await searchParams;
  const status = ["new", "lead", "dismissed"].includes(sp.status ?? "") ? sp.status! : "new";
  const source = ["feed", "list"].includes(sp.source ?? "") ? sp.source! : "";
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const cur = { status: sp.status, source: sp.source, q: sp.q };

  let query = supabase
    .from("distress_signals")
    .select("id,created_at,source,signal_type,address,city,state,zip,reported_at,property_data,status,lead_id,signal_feeds(name),lead_lists(name)", { count: "exact" })
    .eq("status", status)
    .order("created_at", { ascending: false })
    .order("reported_at", { ascending: false, nullsFirst: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  if (source) query = query.eq("source", source);
  if (q) {
    const safe = q.replace(/[,()%]/g, " ");
    query = /^\d{5}$/.test(safe) ? query.eq("zip", safe) : query.or(`city.ilike.%${safe}%,address.ilike.%${safe}%,signal_type.ilike.%${safe}%`);
  }

  const counts = await Promise.all(
    ["new", "lead", "dismissed"].map((s) => {
      let c = supabase.from("distress_signals").select("id", { count: "exact", head: true }).eq("status", s);
      if (source) c = c.eq("source", source);
      return c;
    }),
  );
  const { data, count } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PER_PAGE));
  const back = `/crm/distress${qs(cur, { page: String(page) })}`;

  return (
    <>
      <PageHeader title="Distress leads" sub="Code complaints from city data and owner lists you build. Check the ones worth chasing and turn them into leads." />
      <DistressTabs canBuild={profile.role !== "va"} isOwner={profile.role === "owner"} />

      {sp.made && <Notice>Created {sp.made} lead{sp.made === "1" ? "" : "s"}{sp.linked && sp.linked !== "0" ? ` and linked ${sp.linked} already in your leads` : ""}. They&apos;re in your follow-ups now.</Notice>}
      {!sp.made && sp.linked && sp.linked !== "0" && <Notice>Linked {sp.linked} to leads you already had.</Notice>}
      {sp.dismissed && <Notice>Dismissed {sp.dismissed}.</Notice>}
      {sp.restored && <Notice>Moved {sp.restored} back to New.</Notice>}
      {sp.error && <Notice tone="danger">{sp.error}</Notice>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(["new", "lead", "dismissed"] as const).map((s, i) => (
          <Link key={s} href={`/crm/distress${qs(cur, { status: s === "new" ? null : s, page: null })}`} className={`btn btn-sm ${status === s ? "btn-dark" : "btn-ghost"}`}>
            {{ new: "New", lead: "Made into leads", dismissed: "Dismissed" }[s]} ({(counts[i].count ?? 0).toLocaleString()})
          </Link>
        ))}
        <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
        {[["", "All"], ["feed", "Code complaints"], ["list", "Owner lists"]].map(([k, l]) => (
          <Link key={k} href={`/crm/distress${qs(cur, { source: k || null, page: null })}`} className={`btn btn-sm ${source === k ? "btn-dark" : "btn-ghost"}`}>{l}</Link>
        ))}
        <form className="ml-auto flex gap-2" action="/crm/distress">
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          {sp.source && <input type="hidden" name="source" value={sp.source} />}
          <input name="q" defaultValue={q} className="input py-1 text-sm sm:w-56" placeholder="City, ZIP, street or type" aria-label="Search" />
          <button className="btn btn-ghost btn-sm">Search</button>
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="card p-6 text-sm text-ink-soft">
          {status === "new" ? (
            <>
              Nothing new yet. City feeds pull automatically every morning
              {profile.role === "owner" && <> (or tap <Link href="/crm/distress/feeds" className="underline">Pull now</Link>)</>}.
              {profile.role !== "va" && <> You can also <Link href="/crm/distress/lists" className="underline">build an owner list</Link> for any county or state.</>}
            </>
          ) : "Nothing here."}
        </div>
      ) : (
        <form>
          <input type="hidden" name="back" value={back} />
          {status !== "lead" && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {status === "new" && <button formAction={makeLeads} className="btn btn-primary btn-sm">Make leads from checked</button>}
              {status === "new" && <button formAction={setSignalStatus} name="to" value="dismissed" className="btn btn-ghost btn-sm">Dismiss checked</button>}
              {status === "dismissed" && <button formAction={setSignalStatus} name="to" value="new" className="btn btn-ghost btn-sm">Move checked back to New</button>}
              <span className="text-xs text-ink-soft">Up to 200 at a time. Duplicates of leads you already have get linked, not copied.</span>
            </div>
          )}
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th className="w-8">{status !== "lead" && <SelectAll />}</th>
                  <th>Property</th>
                  <th>Signal</th>
                  <th>Owner &amp; equity</th>
                  <th>Found</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const d = r.property_data;
                  const clean = d ? d.phones.filter((p) => !p.dnc && !p.tcpa).length : 0;
                  const lookupHref = `/crm/lookup${qs({}, { address: r.address, city: r.city, state: r.state, zip: r.zip })}`;
                  return (
                    <tr key={r.id}>
                      <td>{status !== "lead" && <input type="checkbox" name="ids" value={r.id} className="check" aria-label={`Select ${r.address}`} />}</td>
                      <td className="min-w-52">
                        <span className="font-medium">{r.address}</span>
                        <span className="block text-xs text-ink-soft">{[r.city, [r.state, r.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</span>
                      </td>
                      <td className="min-w-40">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.source === "feed" ? "bg-clay/10 text-clay" : "bg-ink/5 text-ink"}`}>{r.signal_type}</span>
                        <span className="mt-0.5 block text-xs text-ink-soft">{r.source === "feed" ? r.signal_feeds?.name : r.lead_lists?.name}</span>
                      </td>
                      <td className="min-w-44 text-sm">
                        {d ? (
                          <>
                            <span className="font-medium">{d.owners[0] ?? "Unknown owner"}</span>
                            <span className="block text-xs text-ink-soft">
                              {d.property.free_clear ? "Free & clear" : d.property.equity_percent != null ? `${Math.round(d.property.equity_percent)}% equity` : "Equity unknown"}
                              {d.property.estimated_value ? ` · ${money(d.property.estimated_value)}` : ""} · {clean} callable phone{clean === 1 ? "" : "s"}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-ink-soft">Owner not looked up</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-sm">{dateShort(r.reported_at ?? r.created_at)}</td>
                      <td className="whitespace-nowrap text-right">
                        {r.lead_id ? (
                          <Link href={`/crm/leads/${r.lead_id}`} className="btn btn-ghost btn-sm">Open lead</Link>
                        ) : (
                          <span className="flex justify-end gap-1.5">
                            {!d && <Link href={lookupHref} className="btn btn-ghost btn-sm">Look up owner</Link>}
                            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.address} ${r.city ?? ""} ${r.state ?? ""} ${r.zip ?? ""}`)}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">Map</a>
                          </span>
                        )}
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
          <span className="text-ink-soft">Page {page} of {pages} · {(count ?? 0).toLocaleString()} total</span>
          <span className="flex gap-2">
            {page > 1 && <Link className="btn btn-ghost btn-sm" href={`/crm/distress${qs(cur, { page: String(page - 1) })}`}>Previous</Link>}
            {page < pages && <Link className="btn btn-ghost btn-sm" href={`/crm/distress${qs(cur, { page: String(page + 1) })}`}>Next</Link>}
          </span>
        </div>
      )}

      <p className="hint mt-4">
        Code complaints are leads to research, not proof the owner wants to sell. Drive by or look at the Map before you spend a lookup.
        Owner lists come with phones already. Numbers on the Do Not Call list stay crossed out on the lead.
      </p>
    </>
  );
}
