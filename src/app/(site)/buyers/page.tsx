import type { Metadata } from "next";
import { BuyerForm } from "./BuyerForm";

export const metadata: Metadata = {
  title: "Investors: Join Our Cash Buyers List",
  description: "Get off-market investment deals across the U.S. that match your buy box.",
};

export default function BuyersPage() {
  return (
    <section className="container-x grid gap-10 py-10 sm:py-16 lg:grid-cols-[1fr_1.4fr]">
      <div>
        <p className="pill bg-ink text-white">For investors</p>
        <h1 className="h-display mt-4 text-4xl leading-tight font-semibold sm:text-5xl">Get off-market deals that fit your buy box</h1>
        <p className="mt-4 text-lg text-ink-soft">
          Join free. Tell us where and what you buy, and we'll send you off-market properties we have under contract
          that match, with photos, comps and repair estimates.
        </p>
        <ul className="mt-8 space-y-3 text-ink-soft">
          <li>• Only deals that match your areas, price range and rehab level</li>
          <li>• Buyers with verified proof of funds hear about deals first</li>
          <li>• Every deal clearly disclosed: we assign our purchase contract and do not hold title</li>
        </ul>
      </div>
      <BuyerForm />
    </section>
  );
}
