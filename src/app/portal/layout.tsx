import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { site } from "@/lib/site";

export const metadata = { title: { default: "Buyer portal", template: "%s · Buyer portal" }, robots: { index: false } };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requireRole("buyer");
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="container-x flex h-16 items-center justify-between gap-3">
          <Logo href="/portal" />
          <nav className="flex items-center gap-1 text-sm font-semibold">
            <Link href="/portal" className="rounded-md px-3 py-2 hover:bg-paper">Deals</Link>
            <Link href="/portal/account" className="rounded-md px-3 py-2 hover:bg-paper">My account</Link>
            <form action="/auth/signout" method="post"><button className="rounded-md px-3 py-2 text-ink-soft hover:bg-paper">Sign out</button></form>
          </nav>
        </div>
      </header>
      <main className="container-x flex-1 py-6 sm:py-8">{children}</main>
      <footer className="border-t border-line py-6 text-center text-xs text-ink-soft">
        Questions about a deal? Call {site.phone} or email <a className="underline" href={`mailto:${site.dealsEmail}`}>{site.dealsEmail}</a>. Deal details are confidential.
      </footer>
    </div>
  );
}
