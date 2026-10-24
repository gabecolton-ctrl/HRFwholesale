// One place for the business details shown on the website.
// Edit these before launch.
export const site = {
  legalName: "H.R.F Assets LLC",
  brand: "H.R.F Assets LLC",
  tagline: "Cash home buyers nationwide",
  phone: "(469) 224-3258",
  phoneHref: "tel:+14692243258",
  email: "offers@hrfassets.com",
  city: "Dallas, TX", // headquarters
  serviceArea: "cities, suburbs and rural areas across the United States",
  hours: "Mon–Sat, 8am–7pm CT",
  // Investor + back-office address: buyer sign-up, buyer portal, CRM, logins, email links.
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://hrfwholesale.com",
  // Seller-facing address. Leave NEXT_PUBLIC_SELLER_URL unset until that domain shows
  // "Valid Configuration" in Vercel; until then one domain serves everything.
  sellerUrl: process.env.NEXT_PUBLIC_SELLER_URL || null,
  // Required by law (CAN-SPAM) at the bottom of every deal alert email.
  mailingAddress: "H.R.F Assets LLC, P.O. Box 1440, Prosper, TX 75078",
  dealsEmail: "deals@hrfassets.com",
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

/** Link to a seller page (on the seller domain once it's live). */
export const sellerHref = (path: string) => (site.sellerUrl ? `${site.sellerUrl.replace(/\/$/, "")}${path}` : path);
/** Link to an investor/app page (on the app domain once the seller domain is live). */
export const appHref = (path: string) => (site.sellerUrl ? `${site.url.replace(/\/$/, "")}${path}` : path);

/**
 * Base for links inside emails. Emails are sent from @hrfassets.com, so links use the
 * same domain (Outlook/Gmail trust matching domains more); hrfassets.com forwards
 * app pages (/auth, /portal, /crm, /alerts) to the app domain automatically.
 */
export const emailLinkBase = () => {
  const from = process.env.EMAIL_FROM ?? "";
  const fromDomain = from.match(/@([a-z0-9.-]+)/i)?.[1]?.toLowerCase();
  const seller = site.sellerUrl?.replace(/\/$/, "");
  if (seller && fromDomain && seller.toLowerCase().includes(fromDomain)) return seller;
  return site.url.replace(/\/$/, "");
};
