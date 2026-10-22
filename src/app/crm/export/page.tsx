import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/crm/ui";

export const metadata = { title: "Export" };

const items = [
  ["leads", "Leads", "Every lead with all Lead Tracker fields, flags and follow-up dates."],
  ["lead-activities", "Follow-up history", "Every call, text, note and status change."],
  ["buyers", "Cash buyers", "Contacts and buy boxes."],
  ["deals", "Deal pipeline", "Contracts, dates, prices, fees and disclosure status."],
  ["consent-records", "Consent records", "Proof of consent for every web lead (wording, time, IP)."],
  ["buyer-offers", "Buyer offers", "Every interest and offer buyers sent from the portal."],
  ["buyer-acknowledgments", "Buyer disclosure acknowledgments", "Proof each buyer saw the assignment disclosure (time, IP)."],
  ["deal-alerts", "Deal alert log", "Who was emailed about which deal."],
  ["monthly-targets", "Monthly targets", "Your targets by month."],
  ["marketing-spend", "Marketing spend", "Spend by month and lead source."],
  ["team", "Team", "Logins and roles."],
];

export default async function Export() {
  await requireRole("owner");
  return (
    <>
      <PageHeader title="Export your data" sub="Download any table as a CSV that opens in Excel or Google Sheets. Do this monthly as a backup." />
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map(([key, title, body]) => (
          <li key={key} className="card flex items-center justify-between gap-4 p-4">
            <div><p className="font-semibold">{title}</p><p className="text-sm text-ink-soft">{body}</p></div>
            <a href={`/api/export/${key}`} className="btn btn-dark btn-sm shrink-0">Download</a>
          </li>
        ))}
      </ul>
    </>
  );
}
