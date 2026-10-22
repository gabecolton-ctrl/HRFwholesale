import Link from "next/link";
import { site } from "@/lib/site";

const promises = [
  {
    title: "Fast",
    body: "A written offer, usually within 24 hours of seeing the house. Close in as little as 2–3 weeks, or on the date that works for you.",
  },
  {
    title: "No repairs",
    body: "Sell it exactly as it is. No cleaning, no fixing, no showings. Leave behind anything you don't want.",
  },
  {
    title: "No fees",
    body: "No agent commissions and no listing fees. You close at a local, licensed title company.",
  },
];

const steps = [
  { n: "1", title: "Tell us about the house", body: "Fill out the short form or call us. It takes about two minutes." },
  { n: "2", title: "Quick walkthrough", body: "We visit at a time that suits you, look at the property, and answer your questions." },
  { n: "3", title: "Get your cash offer", body: "A clear written offer with no obligation. If it works for you, you pick the closing date." },
];

const situations = [
  "Inherited a house",
  "Behind on payments or taxes",
  "Tired of being a landlord",
  "Too many repairs",
  "Relocating for work",
  "Divorce or separation",
  "Vacant or damaged property",
  "Downsizing",
];

const faqs = [
  {
    q: "How do you decide on the offer?",
    a: "We look at recent sales of similar homes nearby, subtract what the repairs will realistically cost, and make an offer that covers our costs and risk. We walk you through the numbers so you can see how we got there.",
  },
  {
    q: "Am I obligated to accept?",
    a: "No. Our offer is free and there's no pressure. Take the time you need, and get other opinions if you'd like.",
  },
  {
    q: "Who actually buys my house?",
    a: "Sometimes we close on the purchase ourselves, and sometimes we assign our purchase contract to one of our investor partners. Either way, we tell you in writing before you sign, and your agreed price and closing terms stay the same.",
  },
  {
    q: "What if the house needs a lot of work?",
    a: "That's exactly what we buy. Foundation issues, roof damage, old systems, full clean-outs, tenants in place: we handle it.",
  },
  {
    q: "Where do you buy?",
    a: `Nationwide. We're based in ${site.city} and buy in ${site.serviceArea}. Tell us where your house is and we'll take a look.`,
  },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-[radial-gradient(60rem_30rem_at_85%_-10%,rgba(180,80,43,0.10),transparent)]" />
        <div className="container-x relative grid gap-8 pt-6 pb-12 sm:pt-8 sm:pb-16 lg:grid-cols-[1.15fr_1fr] lg:items-start lg:gap-10">
          <div>
            <p className="pill bg-white text-ink-soft ring-1 ring-line">Based in Dallas · Buying nationwide</p>
            <h1 className="h-display mt-4 text-4xl leading-[1.05] font-semibold sm:text-5xl lg:text-6xl">
              We buy houses for cash, nationwide.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-soft">
              Sell as-is, skip the repairs and showings, and pay no agent fees. Get a no-obligation offer and close on
              your schedule.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/sell" className="btn btn-primary min-h-12 px-6 text-base">
                Get my cash offer
              </Link>
              <a href={site.phoneHref} className="btn btn-ghost min-h-12 px-6 text-base">
                Call {site.phone}
              </a>
            </div>
          </div>

          <form action="/sell" method="get" className="card p-6 sm:p-8">
            <h2 className="h-display text-2xl font-semibold">Start with your address</h2>
            <p className="mt-1 text-sm text-ink-soft">No cost, no obligation.</p>
            <label htmlFor="hero-address" className="label mt-5">
              Property address
            </label>
            <input id="hero-address" name="address" className="input" placeholder="1234 Main St, City, State" autoComplete="street-address" required />
            <button className="btn btn-primary mt-4 w-full">Continue</button>
            <ul className="mt-5 space-y-2 text-sm text-ink-soft">
              {["Any condition", "No commissions or fees", "You choose the closing date"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check /> {t}
                </li>
              ))}
            </ul>
          </form>
        </div>
      </section>

      {/* Promises */}
      <section className="container-x">
        <div className="grid gap-4 sm:grid-cols-3">
          {promises.map((p) => (
            <div key={p.title} className="card p-6">
              <h3 className="h-display text-2xl font-semibold text-clay">{p.title}</h3>
              <p className="mt-2 text-ink-soft">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="container-x mt-20">
        <h2 className="h-display text-3xl font-semibold sm:text-4xl">How it works</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="flex gap-4">
              <span className="h-display flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-lg font-semibold text-white">
                {s.n}
              </span>
              <div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 text-ink-soft">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Compare */}
      <section className="container-x mt-20">
        <div className="card overflow-hidden">
          <div className="grid sm:grid-cols-2">
            <div className="p-6 sm:p-8">
              <h2 className="h-display text-3xl font-semibold">Selling to us vs. listing</h2>
              <p className="mt-3 text-ink-soft">
                Listing can get a higher price on a move-in-ready home. If your house needs work or you need certainty
                and speed, a cash sale is often the simpler path.
              </p>
            </div>
            <dl className="divide-y divide-line border-t border-line text-sm sm:border-t-0 sm:border-l">
              <div className="grid grid-cols-[1.3fr_1fr_1fr] gap-2 bg-paper/70 px-6 py-3 text-xs font-bold tracking-wide uppercase">
                <span className="sr-only">Topic</span><span aria-hidden="true" />
                <span className="text-sage">Sell to us</span>
                <span className="text-ink-soft">List with an agent</span>
              </div>
              {[
                ["Repairs and cleaning", "None", "Usually required"],
                ["Agent commission", "None", "Often 5–6%"],
                ["Showings", "One walkthrough", "Many"],
                ["Closing date", "You choose", "Buyer's lender decides"],
                ["Risk of financing falling through", "Cash, no lender", "Common"],
              ].map(([k, us, them]) => (
                <div key={k} className="grid grid-cols-[1.3fr_1fr_1fr] gap-2 px-6 py-3">
                  <dt className="font-medium">{k}</dt>
                  <dd className="font-semibold text-sage">{us}</dd>
                  <dd className="text-ink-soft">{them}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Situations */}
      <section className="container-x mt-20">
        <h2 className="h-display text-3xl font-semibold sm:text-4xl">We help with any situation</h2>
        <ul className="mt-6 flex flex-wrap gap-2">
          {situations.map((s) => (
            <li key={s} className="pill bg-white px-4 py-2 text-sm font-medium text-ink ring-1 ring-line">
              {s}
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section className="container-x mt-20">
        <h2 className="h-display text-3xl font-semibold sm:text-4xl">Questions sellers ask</h2>
        <div className="mt-6 divide-y divide-line rounded-xl border border-line bg-white">
          {faqs.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {f.q}
                <span className="text-clay transition group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-3 text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container-x mt-20">
        <div className="rounded-2xl bg-ink px-6 py-12 text-center text-white sm:px-12">
          <h2 className="h-display text-3xl font-semibold sm:text-4xl">Find out what we'd pay for your house.</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/75">Two minutes to fill out. No cost and no obligation.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/sell" className="btn btn-primary min-h-12 px-6 text-base">
              Get my cash offer
            </Link>
            <a href={site.phoneHref} className="btn min-h-12 border border-white/30 px-6 text-base text-white hover:bg-white/10">
              Call {site.phone}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-sage" aria-hidden>
      <path fill="currentColor" d="M8.1 13.6 4.5 10l1.1-1.1 2.5 2.5 6.3-6.3 1.1 1.1z" />
    </svg>
  );
}
