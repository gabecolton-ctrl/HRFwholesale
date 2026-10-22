// One place for the business details shown on the website.
// Edit these before launch.
export const site = {
  legalName: "H.R.F Assets LLC",
  brand: "H.R.F Assets",
  tagline: "Local cash home buyers in Dallas–Fort Worth",
  phone: "(214) 555-0123", // TODO: your business line (Google Voice is fine)
  phoneHref: "tel:+12145550123",
  email: "offers@hrfwholesale.com", // TODO: your business email
  city: "Dallas, TX",
  serviceArea: "Dallas, Collin, Tarrant, Denton and Ellis counties",
  hours: "Mon–Sat, 8am–7pm",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://hrfwholesale.com",
};

// Shown next to the required checkbox on the Sell form. The exact text,
// time, IP address and page are saved with every lead as proof of consent.
// Have your attorney approve this wording; bump the version if it changes.
export const SELLER_CONSENT_VERSION = "2026-10-22";
export const SELLER_CONSENT_TEXT =
  `By checking this box, I agree that ${"H.R.F Assets LLC"} and people working on its behalf may contact me ` +
  "at the phone number and email I provided, including by calls and text messages sent with automated " +
  "technology or prerecorded or artificial voice, about selling my property. Consent is not required to " +
  "sell my property. Message and data rates may apply; message frequency varies. Reply STOP to opt out " +
  "or HELP for help. See our Privacy Policy and Terms.";

export const BUYER_CONSENT_VERSION = "2026-10-22";
export const BUYER_CONSENT_TEXT =
  "I agree to receive deal alerts and related messages from H.R.F Assets LLC by email, phone and text " +
  "message (which may be sent with automated technology) at the contact details above. Consent is not a " +
  "condition of any purchase. Message and data rates may apply. Reply STOP to opt out at any time.";

// Built into every buyer-facing deal. Cannot be edited from the CRM.
export const ASSIGNMENT_DISCLOSURE =
  "H.R.F Assets LLC is assigning its equitable interest in a contract to purchase this property and does not hold legal title.";
