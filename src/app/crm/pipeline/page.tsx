import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Empty, Flag, PageHeader, StatusPill } from "@/components/crm/ui";
import { DEAL_STATUSES } from "@/lib/constants";
import { dateShort, daysFromToday, money } from "@/lib/format";

export const metadata = { title: "Pipeline" };

export default async function Pipeline({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { supabase } = await requireRole("owner", "acquisitions", "dispositions");
  const { show } = await searchParams;
  let q = supabase
    .from("deals")
    .select("id,address,city,status,contract_signed_date,option_period_end,closing_date,contract_price,assignment_price,fee,title_company,seller_disclosure_signed,buyer_disclosure_signed,published_to_portal,exit_strategy,end_buyer_id")
    .order("closing_date", { ascending: true, nullsFirst: false });
  if (show !== "all") q = q.not("status", "in", "(Closed,Cancelled)");
  const { data } = await q;
  const deals = data ?? [];

  const groups = DEAL_STATUSES.filter((s) => show === "all" || !["Closed", "Cancelled"].includes(s))
    .map((s) => ({ s, items: deals.filter((d) => d.status === s) }))
    .filter((g) => g.items.length > 0);
  const open = deals.filter((d) => !["Closed", "Cancelled"].includes(d.status));
  const projected = open.reduce((a, d) => a + (Number(d.fee) || 0), 0);

  return (
    <>
      <PageHeader
        title="Deal pipeline"
        sub={`${open.length} open · ${money(projected)} projected fees`}
        actions={<>
          <Link href={show === "all" ? "/crm/pipeline" : "/crm/pipeline?show=all"} className="btn btn-ghost btn-sm">{show === "all" ? "Open deals only" : "Include closed"}</Link>
          <Link href="/crm/pipeline/new" className="btn btn-primary btn-sm">New deal</Link>
        </>}
      />
      {groups.length === 0 ? (
        <Empty title="No deals yet" body="Open a lead and choose “Put under contract” when the seller signs." action={<Link href="/crm/leads" className="btn btn-primary btn-sm">Go to leads</Link>} />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.s}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold tracking-wide text-ink-soft uppercase">{g.s} <span className="rounded-full bg-ink/10 px-2 text-xs">{g.items.length}</span></h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {g.items.map((d) => {
                  const opt = daysFromToday(d.option_period_end);
                  const close = daysFromToday(d.closing_date);
                  return (
                    <li key={d.id}>
                      <Link href={`/crm/pipeline/${d.id}`} className="card block p-4 hover:border-ink-soft">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold">{d.address}{d.city ? `, ${d.city}` : ""}</p>
                          <StatusPill status={d.status} />
                        </div>
                        <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                          <div><dt className="text-xs text-ink-soft">Contract</dt><dd>{money(d.contract_price)}</dd></div>
                          <div><dt className="text-xs text-ink-soft">Buyer pays</dt><dd>{money(d.assignment_price)}</dd></div>
                          <div><dt className="text-xs text-ink-soft">Fee</dt><dd className="font-semibold text-sage">{money(d.fee)}</dd></div>
                        </dl>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {opt !== null && opt >= 0 && !["Closed", "Cancelled"].includes(d.status) && (
                            <Flag tone={opt <= 3 ? "danger" : "ink"}>Option ends {opt === 0 ? "today" : `in ${opt}d`}</Flag>
                          )}
                          {close !== null && <Flag tone={close < 0 && d.status !== "Closed" ? "danger" : "ink"}>Close {dateShort(d.closing_date)}</Flag>}
                          <Flag tone={d.seller_disclosure_signed ? "sage" : "amber"}>Seller discl. {d.seller_disclosure_signed ? "✓" : "missing"}</Flag>
                          {d.exit_strategy !== "Keep" && <Flag tone={d.buyer_disclosure_signed ? "sage" : "amber"}>Buyer discl. {d.buyer_disclosure_signed ? "✓" : "missing"}</Flag>}
                          {d.published_to_portal && <Flag tone="clay">On portal</Flag>}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
