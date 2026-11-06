import Link from "next/link";
import { site } from "@/lib/site";

export function SellerCta({ heading = "Get a no-obligation cash offer", sub = "Two minutes to fill out. No cost, no pressure." }: { heading?: string; sub?: string }) {
  return (
    <section className="rounded-2xl bg-ink px-6 py-10 text-center text-white sm:px-10">
      <h2 className="h-display text-3xl font-semibold">{heading}</h2>
      <p className="mx-auto mt-2 max-w-xl text-white/75">{sub}</p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/sell" className="btn btn-primary min-h-12 px-6 text-base">Get my cash offer</Link>
        <a href={site.phoneHref} className="btn min-h-12 border border-white/30 px-6 text-base text-white hover:bg-white/10">Call {site.phone}</a>
      </div>
    </section>
  );
}
