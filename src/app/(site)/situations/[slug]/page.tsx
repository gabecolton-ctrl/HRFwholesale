import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITUATIONS, situationBySlug } from "@/lib/seo-pages";
import { SellerCta } from "@/components/SellerCta";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbLd } from "@/lib/seo";

export const dynamicParams = false;
export function generateStaticParams() {
  return SITUATIONS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const s = situationBySlug((await params).slug);
  if (!s) return {};
  return { title: s.metaTitle, description: s.metaDescription, alternates: { canonical: `/situations/${s.slug}` } };
}

export default async function SituationPage({ params }: { params: Promise<{ slug: string }> }) {
  const s = situationBySlug((await params).slug);
  if (!s) notFound();
  const others = SITUATIONS.filter((x) => x.slug !== s.slug).slice(0, 4);

  return (
    <article className="container-x py-10 sm:py-14">
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Situations", path: "/situations" }, { name: s.nav, path: `/situations/${s.slug}` }])} />
      <nav className="text-sm text-ink-soft"><Link href="/situations" className="underline">Situations we help with</Link> / {s.nav}</nav>

      <div className="mt-4 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <h1 className="h-display text-4xl leading-tight font-semibold sm:text-5xl">{s.title}</h1>
          {s.intro.map((p, i) => <p key={i} className="mt-4 text-lg text-ink-soft">{p}</p>)}

          <h2 className="h-display mt-10 text-2xl font-semibold">How we can help</h2>
          <ul className="mt-4 space-y-3">
            {s.howWeHelp.map((h) => (
              <li key={h} className="flex gap-3"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-clay" /><span>{h}</span></li>
            ))}
          </ul>

          <h2 className="h-display mt-10 text-2xl font-semibold">Your options</h2>
          <p className="mt-2 text-ink-soft">Selling to us isn't the right answer for everyone. Here's how the main choices compare.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {s.options.map((o) => (
              <div key={o.title} className="card p-4">
                <h3 className="font-semibold">{o.title}</h3>
                <p className="mt-1 text-sm text-ink-soft">{o.body}</p>
              </div>
            ))}
          </div>

          {s.steps && (
            <>
              <h2 className="h-display mt-10 text-2xl font-semibold">First steps</h2>
              <ol className="mt-4 list-decimal space-y-2 pl-5">{s.steps.map((st) => <li key={st}>{st}</li>)}</ol>
            </>
          )}

          <h2 className="h-display mt-10 text-2xl font-semibold">Common questions</h2>
          <div className="mt-4 divide-y divide-line rounded-xl border border-line bg-white">
            {s.faqs.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {f.q}<span className="text-clay transition group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-3 text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>
          {s.note && <p className="mt-6 rounded-lg bg-paper p-4 text-sm text-ink-soft ring-1 ring-line">{s.note}</p>}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <h2 className="h-display text-xl font-semibold">Find out what we'd pay</h2>
            <p className="mt-1 text-sm text-ink-soft">No cost, no obligation. We'll call you, usually the same day.</p>
            <Link href="/sell" className="btn btn-primary mt-4 w-full">Get my cash offer</Link>
          </div>
          <div className="card p-5">
            <h2 className="text-sm font-semibold">Other situations</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {others.map((o) => <li key={o.slug}><Link className="underline" href={`/situations/${o.slug}`}>{o.nav}</Link></li>)}
            </ul>
          </div>
        </aside>
      </div>

      <div className="mt-14"><SellerCta /></div>
    </article>
  );
}
