"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DistressTabs({ canBuild, isOwner }: { canBuild: boolean; isOwner: boolean }) {
  const path = usePathname();
  const tabs = [
    { href: "/crm/distress", label: "Inbox" },
    ...(canBuild ? [{ href: "/crm/distress/lists", label: "Build a list" }] : []),
    ...(isOwner ? [{ href: "/crm/distress/feeds", label: "City feeds" }] : []),
  ];
  return (
    <nav className="mb-5 flex gap-1 border-b border-line" aria-label="Distress leads">
      {tabs.map((t) => {
        const on = t.href === "/crm/distress" ? path === t.href : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${on ? "border-clay text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Checks or unchecks every "ids" checkbox in the same form. */
export function SelectAll() {
  return (
    <input
      type="checkbox"
      className="check"
      aria-label="Select all"
      onChange={(e) => {
        const form = e.currentTarget.form;
        form?.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((c) => (c.checked = e.currentTarget.checked));
      }}
    />
  );
}
