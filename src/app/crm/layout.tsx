import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { NAV_BY_ROLE, ROLE_LABELS } from "@/lib/constants";
import { Logo } from "@/components/Logo";
import { BottomNav, SideNav } from "@/components/crm/Nav";
import { todayCentral } from "@/lib/format";

export const metadata = { title: { default: "CRM", template: "%s · CRM" }, robots: { index: false } };

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireRole("owner", "acquisitions", "dispositions", "va");
  const items = NAV_BY_ROLE[profile.role];

  const badge: Record<string, number> = {};
  if (items.includes("follow-ups")) {
    const { count } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .lte("next_follow_up", todayCentral())
      .eq("do_not_call", false);
    if (count) badge["follow-ups"] = count;
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="hidden bg-ink p-4 lg:flex lg:flex-col">
        <div className="mb-6 px-1"><Logo href="/crm" light /></div>
        <SideNav items={items} badge={badge} />
        <div className="mt-auto border-t border-white/10 pt-4 text-sm text-white/70">
          <p className="truncate font-semibold text-white">{profile.full_name ?? profile.email}</p>
          <p className="text-xs">{ROLE_LABELS[profile.role]}</p>
          <form action="/auth/signout" method="post" className="mt-3">
            <button className="text-xs font-semibold text-white/80 underline hover:text-white">Sign out</button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper/95 px-4 backdrop-blur lg:hidden">
          <Logo href="/crm" />
          <details className="relative">
            <summary className="btn btn-ghost btn-sm list-none">Menu</summary>
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-white p-2 shadow-lg">
              <p className="px-3 pt-2 text-sm font-semibold">{profile.full_name ?? profile.email}</p>
              <p className="px-3 pb-2 text-xs text-ink-soft">{ROLE_LABELS[profile.role]}</p>
              {items.filter((k) => ["import", "export", "team"].includes(k)).map((k) => (
                <Link key={k} href={`/crm/${k}`} className="block rounded-lg px-3 py-2 text-sm capitalize hover:bg-paper">{k}</Link>
              ))}
              <form action="/auth/signout" method="post"><button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-paper">Sign out</button></form>
            </div>
          </details>
        </header>
        <main className="mx-auto max-w-6xl px-4 pt-5 pb-28 sm:px-6 lg:pt-8 lg:pb-12">{children}</main>
      </div>
      <BottomNav items={items} badge={badge} />
    </div>
  );
}
