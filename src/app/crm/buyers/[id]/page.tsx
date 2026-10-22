import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { Notice, PageHeader, StatusPill } from "@/components/crm/ui";
import { BuyerEditor } from "@/components/crm/BuyerEditor";
import { ConfirmButton } from "@/components/ConfirmButton";
import { dateShort, money } from "@/lib/format";
import { deleteBuyer } from "../actions";

export const metadata = { title: "Buyer" };

export default async function BuyerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { supabase, profile } = await requireRole("owner", "dispositions");
  const { id } = await params;
  const sp = await searchParams;
  const { data: b } = await supabase.from("cash_buyers").select("*").eq("id", id).maybeSingle();
  if (!b) notFound();
  const { data: deals } = await supabase.from("deals").select("id,address,status,closing_date,fee").eq("end_buyer_id", id).order("closing_date", { ascending: false });

  return (
    <>
      <div className="mb-3 text-sm"><Link href="/crm/buyers" className="text-ink-soft underline">← Buyers</Link></div>
      <PageHeader title={b.name} sub={`${b.company ?? "No company"} · added ${dateShort(b.created_at)}${b.user_id ? " · has a portal login" : ""}`} />
      {sp.saved && <Notice>Saved.</Notice>}
      {sp.error && <Notice tone="danger">{sp.error}</Notice>}
      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <BuyerEditor b={b} />
        <aside className="space-y-4">
          <section className="card p-4">
            <h2 className="text-sm font-semibold">Deals with this buyer</h2>
            {(deals ?? []).length === 0 ? <p className="mt-2 text-sm text-ink-soft">None yet.</p> : (
              <ul className="mt-2 space-y-2 text-sm">
                {(deals ?? []).map((d) => (
                  <li key={d.id}><Link href={`/crm/pipeline/${d.id}`} className="flex justify-between gap-2 underline"><span className="truncate">{d.address}</span><StatusPill status={d.status} /></Link>
                    <span className="text-xs text-ink-soft">{dateShort(d.closing_date)} · fee {money(d.fee)}</span></li>
                ))}
              </ul>
            )}
          </section>
          {profile.role === "owner" && (
            <form action={deleteBuyer} className="text-right">
              <input type="hidden" name="id" value={id} />
              <ConfirmButton message="Delete this buyer permanently?">Delete buyer</ConfirmButton>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
