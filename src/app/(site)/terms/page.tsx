import { Prose } from "@/components/Prose";
import { ASSIGNMENT_DISCLOSURE, site } from "@/lib/site";

export const metadata = { title: "Terms of Use" };

// DRAFT — have your attorney review before launch.
export default function Terms() {
  return (
    <Prose title="Terms of Use" updated="October 22, 2026">
      <p>By using this website you agree to these terms. If you do not agree, please do not use the site.</p>
      <h2>Who we are</h2>
      <p>
        {site.legalName} is a real estate investment company. We are not real estate brokers or agents, and we do not
        represent you in any transaction. Nothing on this site is legal, tax or financial advice. We encourage you to
        consult your own professionals before selling or buying property.
      </p>
      <h2>Offers</h2>
      <p>
        Submitting a form does not create an offer or contract. Any offer we make is not binding until both parties sign a
        written purchase agreement. Online information about timelines or costs is general and may differ for your property.
      </p>
      <h2>Contract assignments</h2>
      <p>
        In some transactions we may sell or assign our interest in a purchase contract rather than take title to the
        property. We disclose this in writing to sellers before they sign and to buyers before they sign an assignment,
        as Texas law requires. On every deal shown to investors: <em>"{ASSIGNMENT_DISCLOSURE}"</em>
      </p>
      <h2>Investor accounts</h2>
      <ul>
        <li>Deal information is provided for evaluation only. Investors must do their own due diligence, including verifying values, repair costs, title and condition.</li>
        <li>Deal information is confidential. Don't share addresses or deal details with others or market our deals without written permission.</li>
        <li>We may suspend accounts that misuse deal information or provide false information.</li>
      </ul>
      <h2>Communications</h2>
      <p>
        If you agree to be contacted, we may call, text or email you as described in our Privacy Policy. You can opt out
        at any time by replying STOP to a text or contacting us.
      </p>
      <h2>Limits of liability</h2>
      <p>
        The site is provided "as is." To the extent the law allows, {site.legalName} is not liable for indirect or
        consequential damages arising from use of the site. These terms are governed by the laws of the State of Texas.
      </p>
      <h2>Contact</h2>
      <p>{site.email} · {site.phone}</p>
    </Prose>
  );
}
