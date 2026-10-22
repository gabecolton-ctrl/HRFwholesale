import type { Metadata } from "next";
import { SellForm } from "./SellForm";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Get a Cash Offer for Your House",
  description: "Tell us about your Dallas–Fort Worth property and get a no-obligation cash offer. No repairs, no fees.",
};

export default async function SellPage({ searchParams }: { searchParams: Promise<{ address?: string }> }) {
  const { address } = await searchParams;
  return (
    <section className="container-x grid gap-10 py-10 sm:py-16 lg:grid-cols-[1fr_1.3fr]">
      <div>
        <h1 className="h-display text-4xl leading-tight font-semibold sm:text-5xl">Get your cash offer</h1>
        <p className="mt-4 text-lg text-ink-soft">
          Tell us a little about the house. We'll call you, usually the same day, to ask a few questions and set up a
          quick walkthrough.
        </p>
        <ul className="mt-8 space-y-4">
          {[
            ["No obligation", "Our offer is free. Say no if it doesn't work for you."],
            ["Sell as-is", "No repairs, cleaning or showings."],
            ["Your timeline", "Close fast, or pick a date that works for your move."],
          ].map(([t, d]) => (
            <li key={t} className="flex gap-3">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-clay" />
              <span><strong className="block">{t}</strong><span className="text-ink-soft">{d}</span></span>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-ink-soft">
          Prefer to talk? Call <a href={site.phoneHref} className="font-semibold text-ink underline">{site.phone}</a> ({site.hours}).
        </p>
      </div>
      <SellForm initialAddress={address?.slice(0, 200)} />
    </section>
  );
}
