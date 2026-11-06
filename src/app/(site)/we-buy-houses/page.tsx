import type { Metadata } from "next";
import Link from "next/link";
import { CITIES } from "@/lib/seo-pages";
import { SellerCta } from "@/components/SellerCta";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Areas We Buy Houses",
  description: "We're based in Dallas–Fort Worth and buy houses across DFW and nationwide. See the cities we serve and get a cash offer.",
  alternates: { canonical: "/we-buy-houses" },
};

export default function Areas() {
  return (
    <div className="container-x py-10 sm:py-14">
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Areas we buy", path: "/we-buy-houses" }])} />
      <h1 className="h-display text-4xl font-semibold sm:text-5xl">Areas we buy houses</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-soft">
        We're based in Dallas–Fort Worth, where we buy most often, and we also buy houses nationwide. Don't see your city? Send us the address anyway.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CITIES.map((c) => (
          <li key={c.slug}>
            <Link href={`/we-buy-houses/${c.slug}`} className="card block h-full p-5 hover:border-ink-soft">
              <h2 className="font-semibold">We buy houses in {c.name}, {c.state}</h2>
              <p className="mt-1 text-sm text-ink-soft">{c.areas.slice(0, 4).join(" · ")}</p>
              <span className="mt-3 inline-block text-sm font-semibold text-clay">See how it works →</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-14"><SellerCta heading="Anywhere in the U.S.?" sub="Tell us where the house is. We'll take a look and let you know." /></div>
    </div>
  );
}
