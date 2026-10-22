import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/crm/ui";
import { Importer } from "./Importer";

export const metadata = { title: "Import" };

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requireRole("owner");
  const { type } = await searchParams;
  return (
    <>
      <PageHeader title="Import from CSV" sub="Bring in PropStream lists or your workbook's Lead Tracker and Cash Buyers tabs." />
      <Importer initialKind={type === "buyers" ? "buyers" : "leads"} />
    </>
  );
}
