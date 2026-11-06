import type { Metadata } from "next";
import Link from "next/link";
import { SITUATIONS } from "@/lib/seo-pages";
import { SellerCta } from "@/components/SellerCta";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Situations We Help With",
  description: "Inherited houses, back taxes, foreclosure, tired landlords, divorce, major repairs, vacant homes and relocation. See your options and how a cash sale works.",
  alternates: { canonical: "/situations" },
};

export default function Situations() {
  return (
    <div className="container-x py-10 sm:py-14">
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Situations", path: "/situations" }])} />
      <h1 className="h-display text-4xl font-semibold sm:text-5xl">Every situation is different</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-soft">
        Here's honest information on the most common reasons people sell, including options that don't involve selling to us.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SITUATIONS.map((s) => (
          <li key={s.slug}>
            <Link href={`/situations/${s.slug}`} className="card block h-full p-5 hover:border-ink-soft">
              <h2 className="font-semibold">{s.nav}</h2>
              <p className="mt-1 text-sm text-ink-soft">{s.metaDescription}</p>
              <span className="mt-3 inline-block text-sm font-semibold text-clay">Read more →</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-14"><SellerCta /></div>
    </div>
  );
}
