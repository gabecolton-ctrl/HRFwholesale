import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CITIES, SITUATIONS, cityBySlug } from "@/lib/seo-pages";
import { SellerCta } from "@/components/SellerCta";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbLd, sellerBase } from "@/lib/seo";
import { site } from "@/lib/site";

export const dynamicParams = false;
export function generateStaticParams() {
  return CITIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = cityBySlug((await params).slug);
  if (!c) return {};
  return {
    title: `We Buy Houses in ${c.name}, ${c.state} for Cash`,
    description: c.metaDescription,
    alternates: { canonical: `/we-buy-houses/${c.slug}` },
  };
}

export default async function CityPage({ params }: { params: Promise<{ slug: string }> }) {
  const c = cityBySlug((await params).slug);
  if (!c) notFound();
  const nearby = CITIES.filter((x) => x.slug !== c.slug);

  return (
    <article className="container-x py-10 sm:py-14">
      <JsonLd data={[
        breadcrumbLd([{ name: "Home", path: "/" }, { name: "Areas we buy", path: "/we-buy-houses" }, { name: c.name, path: `/we-buy-houses/${c.slug}` }]),
        {
          "@context": "https://schema.org",
          "@type": "Service",
          name: `Cash home buying in ${c.name}, ${c.state}`,
          provider: { "@type": "Organization", name: site.legalName, url: sellerBase(), telephone: site.phone },
          areaServed: { "@type": "City", name: `${c.name}, ${c.state}` },
        },
      ]} />
      <nav className="text-sm text-ink-soft"><Link href="/we-buy-houses" className="underline">Areas we buy</Link> / {c.name}</nav>

      <div className="mt-4 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <h1 className="h-display text-4xl leading-tight font-semibold sm:text-5xl">We buy houses in {c.name}, {c.state}</h1>
          {c.intro.map((p, i) => <p key={i} className="mt-4 text-lg text-ink-soft">{p}</p>)}
          <p className="mt-4 text-lg text-ink-soft">{c.local}</p>

          <h2 className="h-display mt-10 text-2xl font-semibold">Neighborhoods we buy in</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {c.areas.map((a) => <li key={a} className="pill bg-white px-3 py-1.5 text-sm text-ink ring-1 ring-line">{a}</li>)}
          </ul>
          <p className="mt-3 text-sm text-ink-soft">Plus everywhere else in {c.name}. If you're not sure, just ask.</p>

          <h2 className="h-display mt-10 text-2xl font-semibold">How selling to us works</h2>
          <ol className="mt-4 space-y-4">
            {[
              ["Tell us about the house", "Fill out the short form or call us. It takes about two minutes."],
              ["Quick walkthrough", `We visit at a time that works for you anywhere in ${c.name} and answer your questions.`],
              ["Get your cash offer", "A clear written offer with no obligation. If it works for you, you pick the closing date at a local title company."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span className="h-display flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink font-semibold text-white">{i + 1}</span>
                <span><strong className="block">{t}</strong><span className="text-ink-soft">{d}</span></span>
              </li>
            ))}
          </ol>

          <h2 className="h-display mt-10 text-2xl font-semibold">Situations we help {c.name} owners with</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {SITUATIONS.map((s) => (
              <li key={s.slug}><Link href={`/situations/${s.slug}`} className="underline">{s.nav}</Link></li>
            ))}
          </ul>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <h2 className="h-display text-xl font-semibold">Selling in {c.name}?</h2>
            <p className="mt-1 text-sm text-ink-soft">Get a no-obligation cash offer. No repairs, no fees.</p>
            <Link href="/sell" className="btn btn-primary mt-4 w-full">Get my cash offer</Link>
            <a href={site.phoneHref} className="btn btn-ghost mt-2 w-full">Call {site.phone}</a>
          </div>
          <div className="card p-5 text-sm">
            <h2 className="font-semibold">Good to know in {c.name}</h2>
            <p className="mt-1 text-ink-soft">County: {c.county}. Property values are set by the {c.appraisal}, where you can look up your appraisal and exemptions.</p>
          </div>
          <div className="card p-5">
            <h2 className="text-sm font-semibold">Nearby cities</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {nearby.map((n) => <li key={n.slug}><Link className="underline" href={`/we-buy-houses/${n.slug}`}>{n.name}, {n.state}</Link></li>)}
            </ul>
          </div>
        </aside>
      </div>

      <div className="mt-14"><SellerCta heading={`Find out what we'd pay for your ${c.name} house`} /></div>
    </article>
  );
}
