import Link from "next/link";
import { Prose } from "@/components/Prose";
import { site } from "@/lib/site";

export const metadata = { title: "About Us", description: "A local Dallas company that buys houses for cash across DFW." };

export default function About() {
  return (
    <Prose title="About H.R.F Assets LLC">
      <p>
        {site.legalName} is a Dallas-based real estate company. We buy houses across {site.serviceArea}, in any
        condition, from owners who want a simple, certain sale without repairs, showings or agent fees.
      </p>
      <h2>How we work</h2>
      <ul>
        <li><strong>We listen first.</strong> Every situation is different. We want to understand yours before we talk numbers.</li>
        <li><strong>We show our math.</strong> Our offer is based on recent nearby sales and the real cost of repairs, and we'll walk you through it.</li>
        <li><strong>We put everything in writing.</strong> Including whether we'll close on the purchase ourselves or assign our contract to one of our investor partners.</li>
        <li><strong>No pressure, ever.</strong> If our offer isn't right for you, we'll tell you about other options, including listing with an agent.</li>
      </ul>
      <h2>Talk to us</h2>
      <p>
        Call <a className="font-semibold text-ink underline" href={site.phoneHref}>{site.phone}</a> ({site.hours}) or{" "}
        <Link className="font-semibold text-ink underline" href="/sell">request an offer online</Link>.
      </p>
    </Prose>
  );
}
