import Link from "next/link";
import { site } from "@/lib/site";

export const metadata = { title: "Contact Us" };

export default function Contact() {
  return (
    <section className="container-x max-w-4xl py-12 sm:py-16">
      <h1 className="h-display text-4xl font-semibold sm:text-5xl">Contact us</h1>
      <p className="mt-4 text-lg text-ink-soft">We're based in {site.city} and buy houses nationwide. Real people answer the phone.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <a href={site.phoneHref} className="card block p-6 hover:border-ink-soft">
          <p className="text-sm font-semibold text-ink-soft uppercase">Call or text</p>
          <p className="h-display mt-2 text-3xl font-semibold">{site.phone}</p>
          <p className="mt-1 text-sm text-ink-soft">{site.hours}</p>
        </a>
        <a href={`mailto:${site.email}`} className="card block p-6 hover:border-ink-soft">
          <p className="text-sm font-semibold text-ink-soft uppercase">Email</p>
          <p className="h-display mt-2 text-2xl font-semibold break-all">{site.email}</p>
          <p className="mt-1 text-sm text-ink-soft">We reply within one business day.</p>
        </a>
        <Link href="/sell" className="card block p-6 hover:border-ink-soft">
          <p className="text-sm font-semibold text-ink-soft uppercase">Selling a house?</p>
          <p className="mt-2 text-lg font-semibold">Get a no-obligation cash offer →</p>
        </Link>
        <Link href="/buyers" className="card block p-6 hover:border-ink-soft">
          <p className="text-sm font-semibold text-ink-soft uppercase">Investor?</p>
          <p className="mt-2 text-lg font-semibold">Join our cash buyers list →</p>
        </Link>
      </div>
    </section>
  );
}
