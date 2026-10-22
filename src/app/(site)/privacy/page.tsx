import { Prose } from "@/components/Prose";
import { site } from "@/lib/site";

export const metadata = { title: "Privacy Policy" };

// DRAFT — have your attorney review before launch.
export default function Privacy() {
  return (
    <Prose title="Privacy Policy" updated="October 22, 2026">
      <p>
        This policy explains how {site.legalName} ("we", "us") collects and uses information through this website and
        when we communicate with you.
      </p>
      <h2>Information we collect</h2>
      <ul>
        <li><strong>Information you give us:</strong> your name, phone number, email, property address and details, and anything you tell us about your situation.</li>
        <li><strong>Investor information:</strong> company name, buying criteria and proof-of-funds documents you upload.</li>
        <li><strong>Consent records:</strong> when you agree to be contacted, we record the wording you agreed to, the date and time, your IP address and browser.</li>
        <li><strong>Basic technical data:</strong> pages visited and device/browser type, used to keep the site secure and working.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To respond to you, evaluate your property and make offers.</li>
        <li>To contact you by phone, text message and email, as you agreed.</li>
        <li>To send investors deals that match their criteria.</li>
        <li>To keep records required by law and to protect our business.</li>
      </ul>
      <h2>Text messaging</h2>
      <p>
        If you agree to receive text messages, message frequency varies and message and data rates may apply. Reply
        STOP to opt out or HELP for help at any time. <strong>We do not sell or share your mobile number or text-messaging
        consent with third parties or affiliates for their marketing purposes.</strong>
      </p>
      <h2>Sharing</h2>
      <p>
        We share information only with service providers who help us run our business (such as hosting, phone and email
        providers, and title companies handling a closing), when you ask us to, or when the law requires it. If we assign
        our purchase contract to an investor, we share the property and transaction details needed to close. We do not
        sell your personal information.
      </p>
      <h2>Security and retention</h2>
      <p>
        Access to your information is limited to team members who need it for their role. Documents are stored privately
        and shared only through short-lived secure links. We keep records as long as needed for the purposes above and
        to meet legal obligations.
      </p>
      <h2>Your choices</h2>
      <p>
        You can ask us to stop contacting you, or to access, correct or delete your information, by emailing{" "}
        <a className="font-semibold text-ink underline" href={`mailto:${site.email}`}>{site.email}</a> or calling{" "}
        {site.phone}. We'll add you to our internal Do Not Call list on request.
      </p>
      <h2>Contact</h2>
      <p>{site.legalName}, {site.city}. {site.email}.</p>
    </Prose>
  );
}
