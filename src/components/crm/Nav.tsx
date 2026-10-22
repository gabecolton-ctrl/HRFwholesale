"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />,
  "follow-ups": <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />,
  leads: <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
  buyers: <path d="M3 7h18v12H3zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M3 12h18" />,
  pipeline: <path d="M4 5h16M4 12h10M4 19h6" />,
  import: <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3" />,
  export: <path d="M12 15V3m0 0L8 7m4-4 4 4M4 17v3h16v-3" />,
  team: <path d="M16 11a3 3 0 1 0 0-6M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-2.8 2.7-5 6-5s6 2.2 6 5M16 15c2.8 0 6 1.5 6 5" />,
};
const LABELS: Record<string, string> = {
  home: "Today",
  "follow-ups": "Follow-ups",
  leads: "Leads",
  buyers: "Buyers",
  pipeline: "Pipeline",
  import: "Import",
  export: "Export",
  team: "Team",
};

function Icon({ k }: { k: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[k]}
    </svg>
  );
}

export function SideNav({ items, badge }: { items: string[]; badge?: Record<string, number> }) {
  const path = usePathname();
  const all = ["home", ...items];
  return (
    <nav className="space-y-1">
      {all.map((k) => {
        const href = k === "home" ? "/crm" : `/crm/${k}`;
        const active = k === "home" ? path === "/crm" : path.startsWith(href);
        return (
          <Link key={k} href={href}
            className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium ${active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"}`}>
            <Icon k={k} /> <span className="flex-1">{LABELS[k]}</span>
            {badge?.[k] ? <span className="rounded-full bg-clay px-2 text-xs font-bold text-white">{badge[k]}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Phone bottom bar: the 4 most-used sections. */
export function BottomNav({ items, badge }: { items: string[]; badge?: Record<string, number> }) {
  const path = usePathname();
  const main = ["home", ...items.filter((k) => ["follow-ups", "leads", "buyers", "pipeline"].includes(k))].slice(0, 5);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="flex">
        {main.map((k) => {
          const href = k === "home" ? "/crm" : `/crm/${k}`;
          const active = k === "home" ? path === "/crm" : path.startsWith(href);
          return (
            <li key={k} className="flex-1">
              <Link href={href} className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? "text-clay" : "text-ink-soft"}`}>
                <Icon k={k} />
                {LABELS[k]}
                {badge?.[k] ? <span className="absolute top-1.5 right-[calc(50%-1.4rem)] rounded-full bg-clay px-1.5 text-[10px] text-white">{badge[k]}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
