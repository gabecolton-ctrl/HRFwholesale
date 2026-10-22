import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { PageHeader, Stat, StatusPill } from "@/components/crm/ui";
import { daysFromToday, dateShort, money, todayCentral } from "@/lib/format";

export const metadata = { title: "Today" };

export default async function Today() {
  const { supabase, profile } = await requireRole("owner", "acquisitions", "dispositions", "va");
  const role = profile.role;
  const today = todayCentral();
  const seesLeads = role !== "dispositions";
  const seesDeals = role !== "va";

  const [overdue, dueToday, newWeb, deals] = await Promise.all([
    seesLeads
      ? supabase.from("leads").select("id", { count: "exact", head: true }).lt("next_follow_up", today).eq("do_not_call", false)
      : Promise.resolve({ count: null }),
    seesLeads
      ? supabase.from("leads").select("id", { count: "exact", head: true }).eq("next_follow_up", today).eq("do_not_call", false)
      : Promise.resolve({ count: null }),
    seesLeads
      ? supabase.from("leads").select("id,seller_name,address,created_at,phone").eq("status", "New").eq("lead_source", "Website").order("created_at", { ascending: false }).limit(5)
      : Promise.resolve({ data: [] as { id: string; seller_name: string; address: string; created_at: string; phone: string | null }[] }),
    seesDeals
      ? supabase.from("deals").select("id,address,status,option_period_end,closing_date,fee,seller_disclosure_signed,buyer_disclosure_signed").not("status", "in", "(Closed,Cancelled)").order("closing_date", { ascending: true })
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const activeDeals = deals.data ?? [];
  const optionSoon = activeDeals.filter((d) => {
    const n = daysFromToday(d.option_period_end);
    return n !== null && n >= 0 && n <= 3;
  });
  const projected = activeDeals.reduce((s, d) => s + (Number(d.fee) || 0), 0);
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/Chicago" }).format(new Date()));
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader title={`${greet}, ${profile.full_name?.split(" ")[0] ?? "there"}`} sub={dateShort(today)} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {seesLeads && <Stat label="Overdue" value={overdue.count ?? 0} href="/crm/follow-ups?tab=overdue" tone={(overdue.count ?? 0) > 0 ? "danger" : undefined} />}
        {seesLeads && <Stat label="Due today" value={dueToday.count ?? 0} href="/crm/follow-ups" tone="clay" />}
        {seesDeals && <Stat label="Active deals" value={activeDeals.length} href="/crm/pipeline" />}
        {seesDeals && <Stat label="Projected fees" value={money(projected)} href="/crm/pipeline" />}
      </div>

      {optionSoon.length > 0 && (
        <section className="mt-6 rounded-xl border border-danger/30 bg-danger/5 p-4">
          <h2 className="font-semibold text-danger">Option period ending soon</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {optionSoon.map((d) => (
              <li key={d.id}>
                <Link href={`/crm/pipeline/${d.id}`} className="font-medium underline">{d.address}</Link>{" "}
                ends {dateShort(d.option_period_end)} ({daysFromToday(d.option_period_end) === 0 ? "today" : `in ${daysFromToday(d.option_period_end)} days`})
                {d.status === "Under contract" || d.status === "Marketing" ? " · no buyer yet" : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {seesLeads && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">New website leads</h2>
              <Link href="/crm/leads?status=New&source=Website" className="text-sm text-ink-soft underline">All</Link>
            </div>
            {(newWeb.data ?? []).length === 0 ? (
              <p className="card p-4 text-sm text-ink-soft">No new website leads waiting. Nice.</p>
            ) : (
              <ul className="card divide-y divide-line">
                {(newWeb.data ?? []).map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 p-3">
                    <Link href={`/crm/leads/${l.id}`} className="min-w-0">
                      <p className="truncate font-medium">{l.seller_name}</p>
                      <p className="truncate text-sm text-ink-soft">{l.address}</p>
                    </Link>
                    {l.phone && <a href={`tel:${l.phone}`} className="btn btn-primary btn-sm shrink-0">Call</a>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {seesDeals && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Deals closing next</h2>
              <Link href="/crm/pipeline" className="text-sm text-ink-soft underline">Pipeline</Link>
            </div>
            {activeDeals.length === 0 ? (
              <p className="card p-4 text-sm text-ink-soft">No active deals yet. Offers are the only path to contracts.</p>
            ) : (
              <ul className="card divide-y divide-line">
                {activeDeals.slice(0, 5).map((d) => (
                  <li key={d.id}>
                    <Link href={`/crm/pipeline/${d.id}`} className="flex items-center justify-between gap-3 p-3">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{d.address}</span>
                        <span className="text-sm text-ink-soft">Closes {dateShort(d.closing_date)} · {money(d.fee)}</span>
                      </span>
                      <StatusPill status={d.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </>
  );
}
