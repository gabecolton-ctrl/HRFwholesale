import Link from "next/link";
import { headers } from "next/headers";
import { Logo } from "@/components/Logo";
import { appHref, sellerHref, site } from "@/lib/site";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const investor = (await headers()).get("x-hrf-audience") === "investor";
  return investor ? <InvestorShell>{children}</InvestorShell> : <SellerShell>{children}</SellerShell>;
}

function SellerShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="container-x flex h-16 items-center justify-between gap-4">
          <Logo href={sellerHref("/")} />
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link href={sellerHref("/about")} className="hidden rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink sm:block">About</Link>
            <Link href={sellerHref("/contact")} className="hidden rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink sm:block">Contact</Link>
            <a href={site.phoneHref} className="hidden px-3 py-2 text-sm font-semibold text-ink md:block">{site.phone}</a>
            <Link href={sellerHref("/sell")} className="btn btn-primary btn-sm shrink-0 px-2.5 sm:min-h-11 sm:px-4 sm:text-sm">
              Get my cash offer
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-16 bg-ink text-white/80">
        <div className="container-x grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Logo light href={sellerHref("/")} />
            <p className="mt-4 max-w-sm text-sm">A Dallas-based company that buys houses for cash nationwide. Any condition, any situation.</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Sellers</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link className="hover:text-white" href={sellerHref("/sell")}>Get a cash offer</Link></li>
              <li><Link className="hover:text-white" href={sellerHref("/about")}>How it works</Link></li>
              <li><Link className="hover:text-white" href={sellerHref("/contact")}>Contact us</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Company</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li><a className="hover:text-white" href={site.phoneHref}>{site.phone}</a></li>
              <li><a className="hover:text-white" href={`mailto:${site.email}`}>{site.email}</a></li>
              <li><Link className="hover:text-white" href={appHref("/buyers")}>Investors: join our buyers list</Link></li>
              <li><Link className="hover:text-white" href={appHref("/login")}>Sign in</Link></li>
            </ul>
          </div>
        </div>
        <Legal />
      </footer>
    </div>
  );
}

function InvestorShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="container-x flex h-16 items-center justify-between gap-4">
          <Logo href="/" tagline="Off-market deals · Nationwide" />
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link href="/login" className="rounded-md px-3 py-2 text-sm font-semibold text-ink hover:bg-white">Sign in</Link>
            <Link href="/#join" className="btn btn-primary btn-sm shrink-0 px-2.5 sm:min-h-11 sm:px-4 sm:text-sm">Join free</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-16 bg-ink text-white/80">
        <div className="container-x grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Logo light href="/" tagline="Off-market deals · Nationwide" />
            <p className="mt-4 max-w-sm text-sm">Off-market properties we have under contract, sent to investors whose buy box they fit.</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Investors</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link className="hover:text-white" href="/#join">Join the buyers list</Link></li>
              <li><Link className="hover:text-white" href="/login">Buyer & team sign in</Link></li>
              <li><a className="hover:text-white" href={`mailto:${site.dealsEmail}`}>{site.dealsEmail}</a></li>
              <li><a className="hover:text-white" href={site.phoneHref}>{site.phone}</a></li>
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Selling a house?</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link className="hover:text-white" href={sellerHref("/sell")}>Get a cash offer →</Link></li>
              <li><Link className="hover:text-white" href={sellerHref("/")}>{site.sellerUrl ? site.sellerUrl.replace(/^https?:\/\//, "") : "How we buy houses"}</Link></li>
            </ul>
          </div>
        </div>
        <Legal />
      </footer>
    </div>
  );
}

function Legal() {
  return (
    <div className="border-t border-white/10">
      <div className="container-x flex flex-col gap-2 py-5 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} {site.legalName}. Headquartered in {site.city}.</p>
        <p className="flex gap-4">
          <Link className="hover:text-white" href="/privacy">Privacy Policy</Link>
          <Link className="hover:text-white" href="/terms">Terms</Link>
        </p>
      </div>
    </div>
  );
}
