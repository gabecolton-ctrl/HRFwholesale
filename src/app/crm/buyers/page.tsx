import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Empty, Flag, Notice, PageHeader } from "@/components/crm/ui";
import { CopyButton } from "@/components/CopyButton";
import { PROPERTY_TYPES, REHAB_LEVELS, STRATEGIES } from "@/lib/constants";
import { dateShort, money, phonePretty, toNumber } from "@/lib/format";

export const metadata = { title: "Cash buyers" };

type SP = { q?: string; area?: string; price?: string; rehab?: string; type?: string; strategy?: string; tier?: string; pof?: string; inactive?: string; deleted?: string };

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default async function Buyers({ searchParams }: { searchParams: Promise<SP> }) {
  const { supabase, profile } = await requireRole("owner", "dispositions");
  const sp = await searchParams;

  let q = supabase
    .from("cash_buyers")
    .select("id,name,company,phone,email,areas,price_min,price_max,rehab_levels,strategies,property_types,tier,pof_verified,pof_path,status,deals_closed,last_deal_at,user_id,sms_consent,email_alerts", { count: "exact" });
  if (sp.inactive !== "1") q = q.eq("status", "Active");
  if (sp.area) {
    const a = sp.area.trim();
    q = q.overlaps("areas", [a, a.toLowerCase(), a.toUpperCase(), titleCase(a)]);
  }
  const price = toNumber(sp.price ?? null);
  if (price !== null) {
    q = q.or(`price_min.is.null,price_min.lte.${price}`).or(`price_max.is.null,price_max.gte.${price}`);
  }
  if (sp.rehab) q = q.overlaps("rehab_levels", [sp.rehab]);
  if (sp.type) q = q.overlaps("property_types", [sp.type]);
  if (sp.strategy) q = q.overlaps("strategies", [sp.strategy]);
  if (sp.tier) q = q.eq("tier", sp.tier);
  if (sp.pof === "1") q = q.eq("pof_verified", true);
  if (sp.q) {
    const t = sp.q.replace(/[%,()*]/g, " ").trim();
    q = q.or(`name.ilike.%${t}%,company.ilike.%${t}%,email.ilike.%${t}%,phone.ilike.%${t.replace(/\D/g, "") || t}%`);
  }
  const { data, count, error } = await q.order("tier").order("deals_closed", { ascending: false }).order("name").limit(500);
  const rows = data ?? [];
  const segmented = Boolean(sp.area || sp.price || sp.rehab || sp.type || sp.strategy || sp.tier || sp.pof);
  const emails = rows.filter((b) => b.email && b.email_alerts).map((b) => b.email).join(", ");
  const phones = rows.filter((b) => b.phone && b.sms_consent).map((b) => phonePretty(b.phone)).join(", ");

  return (
    <>
      <PageHeader
        title="Cash buyers"
        sub={`${count ?? 0} ${segmented ? "match this segment" : "active buyers"}`}
        actions={<>
          {profile.role === "owner" && <Link href="/crm/import?type=buyers" className="btn btn-ghost btn-sm">Import CSV</Link>}
          <Link href="/crm/buyers/new" className="btn btn-primary btn-sm">Add buyer</Link>
        </>}
      />
      {sp.deleted && <Notice>Buyer deleted.</Notice>}
      {error && <Notice tone="danger">{error.message}</Notice>}

      <form className="card mb-4 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <input name="q" defaultValue={sp.q} className="input" placeholder="Name, company, email, phone" aria-label="Search" />
        <input name="area" defaultValue={sp.area} className="input" placeholder="Area or ZIP (e.g. 75217)" aria-label="Area" />
        <input name="price" defaultValue={sp.price} className="input" inputMode="numeric" placeholder="Deal price (fits their range)" aria-label="Deal price" />
        <select name="rehab" defaultValue={sp.rehab ?? ""} className="input" aria-label="Rehab level">
          <option value="">Any rehab level</option>{REHAB_LEVELS.map((r) => <option key={r}>{r}</option>)}
        </select>
        <select name="type" defaultValue={sp.type ?? ""} className="input" aria-label="Property type">
          <option value="">Any property type</option>{PROPERTY_TYPES.map((r) => <option key={r}>{r}</option>)}
        </select>
        <select name="strategy" defaultValue={sp.strategy ?? ""} className="input" aria-label="Strategy">
          <option value="">Flip or hold</option>{STRATEGIES.map((r) => <option key={r}>{r}</option>)}
        </select>
        <select name="tier" defaultValue={sp.tier ?? ""} className="input" aria-label="Tier">
          <option value="">All tiers</option><option value="A">A (blast first)</option><option value="B">B</option><option value="C">C</option>
        </select>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="pof" value="1" defaultChecked={sp.pof === "1"} className="check mt-0" /> POF verified</label>
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="inactive" value="1" defaultChecked={sp.inactive === "1"} className="check mt-0" /> Incl. inactive</label>
          <button className="btn btn-dark btn-sm">Filter</button>
          {segmented && <Link href="/crm/buyers" className="text-sm underline">Clear</Link>}
        </div>
      </form>

      {rows.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
          <span>For this segment:</span>
          <CopyButton text={emails} label="Copy emails" />
          <CopyButton text={phones} label="Copy text-OK phones" />
          <span className="text-xs">Only buyers who allow email alerts / agreed to texts are included.</span>
        </div>
      )}

      {rows.length === 0 ? (
        <Empty title="No buyers match" body="Loosen the filters, or add buyers from deed records and REIA meetups." action={<Link href="/crm/buyers/new" className="btn btn-primary btn-sm">Add buyer</Link>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((b) => (
            <Link key={b.id} href={`/crm/buyers/${b.id}`} className="card block p-4 hover:border-ink-soft">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{b.name}</p>
                  <p className="truncate text-sm text-ink-soft">{b.company ?? "—"} · {phonePretty(b.phone)}</p>
                </div>
                <span className={`pill ${b.tier === "A" ? "bg-clay text-white" : "bg-ink/10"}`}>Tier {b.tier}</span>
              </div>
              <p className="mt-2 text-sm">{b.areas.length ? b.areas.join(", ") : <span className="text-ink-soft">No areas set</span>}</p>
              <p className="text-sm text-ink-soft">{money(b.price_min)} – {money(b.price_max)} · {b.rehab_levels.join(", ") || "any rehab"} · {b.strategies.join("/") || "—"}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {b.pof_verified ? <Flag tone="sage">POF verified</Flag> : b.pof_path ? <Flag tone="amber">POF to review</Flag> : <Flag tone="danger">No POF</Flag>}
                {b.user_id && <Flag>Portal account</Flag>}
                {b.deals_closed > 0 && <Flag tone="clay">{b.deals_closed} closed · last {dateShort(b.last_deal_at)}</Flag>}
                {b.status === "Inactive" && <Flag>Inactive</Flag>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
