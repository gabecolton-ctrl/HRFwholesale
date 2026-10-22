import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/crm/ui";

export const metadata = { title: "Export" };

const items = [
  ["leads", "Leads", "Every lead with all Lead Tracker fields, flags and follow-up dates."],
  ["lead-activities", "Follow-up history", "Every call, text, note and status change."],
  ["buyers", "Cash buyers", "Contacts and buy boxes."],
  ["deals", "Deal pipeline", "Contracts, dates, prices, fees and disclosure status."],
  ["consent-records", "Consent records", "Proof of consent for every web lead (wording, time, IP)."],
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
