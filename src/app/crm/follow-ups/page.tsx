import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Empty, Flag, Notice, PageHeader, StatusPill } from "@/components/crm/ui";
import { FollowUpForm } from "@/components/crm/FollowUpForm";
import { CADENCE_DAYS } from "@/lib/constants";
import { dateShort, dateTime, daysFromToday, phonePretty, todayCentral } from "@/lib/format";

export const metadata = { title: "Follow-ups" };

type Tab = "today" | "overdue" | "upcoming";

export default async function FollowUps({ searchParams }: { searchParams: Promise<{ tab?: Tab; logged?: string; error?: string; mine?: string }> }) {
  const { supabase, user, profile } = await requireRole("owner", "acquisitions", "va");
  const { tab: t, logged, error, mine } = await searchParams;
  const today = todayCentral();
  const in7 = new Date(new Date(today + "T12:00:00").getTime() + 7 * 86_400_000).toISOString().slice(0, 10);

  const base = () => {
    let q = supabase
      .from("leads")
      .select("id,seller_name,phone,address,city,status,motivation,next_follow_up,follow_up_step,last_contacted_at,keep_candidate,lead_source,assigned_to", { count: "exact" })
      .eq("do_not_call", false)
      .not("next_follow_up", "is", null);
    if (mine === "1") q = q.eq("assigned_to", user.id);
    return q;
  };

  const [overdueQ, todayQ, upcomingQ] = await Promise.all([
    base().lt("next_follow_up", today).order("next_follow_up").order("motivation", { ascending: false, nullsFirst: false }).limit(100),
    base().eq("next_follow_up", today).order("motivation", { ascending: false, nullsFirst: false }).limit(100),
    base().gt("next_follow_up", today).lte("next_follow_up", in7).order("next_follow_up").limit(100),
  ]);
  const counts = { overdue: overdueQ.count ?? 0, today: todayQ.count ?? 0, upcoming: upcomingQ.count ?? 0 };
  const tab: Tab = t ?? (counts.overdue > 0 && counts.today === 0 ? "overdue" : "today");
  const rows = (tab === "overdue" ? overdueQ : tab === "upcoming" ? upcomingQ : todayQ).data ?? [];
  const back = `/crm/follow-ups?tab=${tab}${mine === "1" ? "&mine=1" : ""}`;

  return (
    <>
      <PageHeader title="Follow-ups" sub="Work overdue first, then today. Highest motivation is at the top." />
      {logged && <Notice>Logged. Next follow-up scheduled.</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["overdue", "today", "upcoming"] as Tab[]).map((k) => (
          <Link key={k} href={`/crm/follow-ups?tab=${k}${mine === "1" ? "&mine=1" : ""}`}
            className={`btn btn-sm ${tab === k ? "btn-dark" : "btn-ghost"}`}>
            {k === "today" ? "Due today" : k === "overdue" ? "Overdue" : "Next 7 days"}
            <span className={`rounded-full px-1.5 text-xs ${k === "overdue" && counts.overdue ? "bg-danger text-white" : "bg-black/10"}`}>{counts[k]}</span>
          </Link>
        ))}
        {profile.role !== "va" && (
          <Link href={mine === "1" ? `/crm/follow-ups?tab=${tab}` : `/crm/follow-ups?tab=${tab}&mine=1`} className="ml-auto text-sm text-ink-soft underline">
            {mine === "1" ? "Show all I can see" : "Only mine"}
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <Empty title={tab === "overdue" ? "Nothing overdue" : tab === "today" ? "Nothing due today" : "Nothing scheduled this week"} body="Add leads or import a list to fill the pipeline." action={<Link className="btn btn-primary btn-sm" href="/crm/leads/new">Add a lead</Link>} />
      ) : (
        <ul className="space-y-3">
          {rows.map((l) => {
            const late = daysFromToday(l.next_follow_up);
            const day = CADENCE_DAYS[Math.min(l.follow_up_step, 6) - 1];
            return (
              <li key={l.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <Link href={`/crm/leads/${l.id}`} className="min-w-0">
                    <p className="font-semibold">{l.seller_name}</p>
                    <p className="text-sm text-ink-soft">{l.address}{l.city ? `, ${l.city}` : ""}</p>
                  </Link>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusPill status={l.status} />
                    {l.motivation ? <Flag tone={l.motivation >= 4 ? "clay" : "ink"}>Motivation {l.motivation}/5</Flag> : null}
                    {l.keep_candidate && <Flag tone="sage">Keep candidate</Flag>}
                  </div>
                </div>
                <p className="mt-2 text-xs text-ink-soft">
                  {l.follow_up_step <= 6 ? `Day ${day} follow-up` : "Monthly nurture"} · due {dateShort(l.next_follow_up)}
                  {late !== null && late < 0 ? <strong className="text-danger"> ({-late} day{late === -1 ? "" : "s"} late)</strong> : null}
                  {" · "}last contact {dateTime(l.last_contacted_at)} · {l.lead_source ?? "no source"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {l.phone ? (
                    <>
                      <a href={`tel:${l.phone}`} className="btn btn-primary btn-sm">Call {phonePretty(l.phone)}</a>
                      <a href={`sms:${l.phone}`} className="btn btn-ghost btn-sm">Text</a>
                    </>
                  ) : (
                    <span className="text-sm text-ink-soft">No phone on file. Skip trace needed.</span>
                  )}
                </div>
                <details className="mt-3 border-t border-line pt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-ink">Log this follow-up</summary>
                  <div className="mt-3"><FollowUpForm leadId={l.id} back={back} compact /></div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
