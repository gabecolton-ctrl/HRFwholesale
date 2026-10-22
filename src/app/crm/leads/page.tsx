import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Empty, Flag, Notice, PageHeader, StatusPill, qs } from "@/components/crm/ui";
import { LEAD_SOURCES, LEAD_STATUSES } from "@/lib/constants";
import { dateShort, daysFromToday, phonePretty } from "@/lib/format";

export const metadata = { title: "Leads" };
const PAGE = 50;

type SP = { q?: string; status?: string; source?: string; keep?: string; dnc?: string; page?: string; deleted?: string; sort?: string };

export default async function Leads({ searchParams }: { searchParams: Promise<SP> }) {
  const { supabase, profile } = await requireRole("owner", "acquisitions", "va");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  let q = supabase
    .from("leads")
    .select("id,seller_name,phone,address,city,state,zip,status,motivation,lead_source,next_follow_up,keep_candidate,do_not_call,created_at", { count: "exact" });
  if (sp.status) q = q.eq("status", sp.status);
  else q = q.not("status", "in", "(Closed,Dead)");
  if (sp.source) q = q.eq("lead_source", sp.source);
  if (sp.keep === "1") q = q.eq("keep_candidate", true);
  if (sp.dnc === "1") q = q.eq("do_not_call", true);
  if (sp.q) {
    const term = sp.q.replace(/[%,()*]/g, " ").trim();
    const digits = term.replace(/\D/g, "");
    const ors = [`seller_name.ilike.%${term}%`, `address.ilike.%${term}%`, `city.ilike.%${term}%`, `zip.ilike.${term}%`];
    if (digits.length >= 4) ors.push(`phone.ilike.%${digits}%`);
    q = q.or(ors.join(","));
  }
  q = sp.sort === "motivation"
    ? q.order("motivation", { ascending: false, nullsFirst: false })
    : sp.sort === "follow"
      ? q.order("next_follow_up", { ascending: true, nullsFirst: false })
      : q.order("created_at", { ascending: false });
  const { data, count, error } = await q.range((page - 1) * PAGE, page * PAGE - 1);
  const rows = data ?? [];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const base = { q: sp.q, status: sp.status, source: sp.source, keep: sp.keep, dnc: sp.dnc, sort: sp.sort };

  return (
    <>
      <PageHeader
        title="Leads"
        sub={`${count ?? 0} ${sp.status ? sp.status.toLowerCase() : "open"} leads`}
        actions={<>
          {profile.role === "owner" && <Link href="/crm/import" className="btn btn-ghost btn-sm">Import CSV</Link>}
          <Link href="/crm/leads/new" className="btn btn-primary btn-sm">Add lead</Link>
        </>}
      />
      {sp.deleted && <Notice>Lead deleted.</Notice>}
      {error && <Notice tone="danger">{error.message}</Notice>}

      <form className="card mb-4 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <input name="q" defaultValue={sp.q} className="input" placeholder="Search name, address, phone, ZIP" aria-label="Search" />
        <select name="status" defaultValue={sp.status ?? ""} className="input" aria-label="Status">
          <option value="">Open (not closed/dead)</option>
          {LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select name="source" defaultValue={sp.source ?? ""} className="input" aria-label="Source">
          <option value="">All sources</option>
          {LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select name="sort" defaultValue={sp.sort ?? ""} className="input" aria-label="Sort">
          <option value="">Newest first</option>
          <option value="motivation">Highest motivation</option>
          <option value="follow">Next follow-up</option>
        </select>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm whitespace-nowrap"><input type="checkbox" name="keep" value="1" defaultChecked={sp.keep === "1"} className="check mt-0" /> Keepers</label>
          <label className="flex items-center gap-1.5 text-sm whitespace-nowrap"><input type="checkbox" name="dnc" value="1" defaultChecked={sp.dnc === "1"} className="check mt-0" /> DNC</label>
          <button className="btn btn-dark btn-sm">Filter</button>
        </div>
      </form>

      {rows.length === 0 ? (
        <Empty title="No leads match" body="Try clearing filters, or add your first lead." action={<Link href="/crm/leads/new" className="btn btn-primary btn-sm">Add lead</Link>} />
      ) : (
        <>
          {/* Phone: cards */}
          <ul className="space-y-2 md:hidden">
            {rows.map((l) => (
              <li key={l.id}>
                <Link href={`/crm/leads/${l.id}`} className="card block p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{l.seller_name}</p>
                      <p className="truncate text-sm text-ink-soft">{l.address}</p>
                    </div>
                    <StatusPill status={l.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    {l.motivation ? <Flag>M{l.motivation}</Flag> : null}
                    {l.keep_candidate && <Flag tone="sage">Keep</Flag>}
                    {l.do_not_call && <Flag tone="danger">DNC</Flag>}
                    <FollowFlag d={l.next_follow_up} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {/* Desktop: table */}
          <div className="table-wrap hidden md:block">
            <table className="data">
              <thead><tr><th>Seller</th><th>Property</th><th>Status</th><th>Mot.</th><th>Source</th><th>Next follow-up</th><th>Added</th></tr></thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id} className="hover:bg-paper/50">
                    <td>
                      <Link href={`/crm/leads/${l.id}`} className="font-semibold hover:underline">{l.seller_name}</Link>
                      <div className="text-xs text-ink-soft">{phonePretty(l.phone)}</div>
                    </td>
                    <td>{l.address}<div className="text-xs text-ink-soft">{[l.city, l.state, l.zip].filter(Boolean).join(" ")}</div></td>
                    <td><StatusPill status={l.status} /> {l.keep_candidate && <Flag tone="sage">Keep</Flag>} {l.do_not_call && <Flag tone="danger">DNC</Flag>}</td>
                    <td>{l.motivation ?? "—"}</td>
                    <td className="text-ink-soft">{l.lead_source ?? "—"}</td>
                    <td><FollowFlag d={l.next_follow_up} /></td>
                    <td className="text-ink-soft whitespace-nowrap">{dateShort(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              {page > 1 ? <Link className="btn btn-ghost btn-sm" href={`/crm/leads${qs(base, { page: String(page - 1) })}`}>← Previous</Link> : <span />}
              <span className="text-ink-soft">Page {page} of {pages}</span>
              {page < pages ? <Link className="btn btn-ghost btn-sm" href={`/crm/leads${qs(base, { page: String(page + 1) })}`}>Next →</Link> : <span />}
            </div>
          )}
        </>
      )}
    </>
  );
}

function FollowFlag({ d }: { d: string | null }) {
  if (!d) return <span className="text-xs text-ink-soft">—</span>;
  const n = daysFromToday(d) ?? 0;
  if (n < 0) return <Flag tone="danger">{-n}d overdue</Flag>;
  if (n === 0) return <Flag tone="clay">Today</Flag>;
  return <span className="text-xs text-ink-soft whitespace-nowrap">{dateShort(d)}</span>;
}
