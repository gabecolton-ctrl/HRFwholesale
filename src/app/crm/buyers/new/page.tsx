import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Notice, PageHeader } from "@/components/crm/ui";
import { BuyerEditor } from "@/components/crm/BuyerEditor";

export const metadata = { title: "Add buyer" };

export default async function NewBuyer({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireRole("owner", "dispositions");
  const { error } = await searchParams;
  return (
    <>
      <PageHeader title="Add a cash buyer" actions={<Link href="/crm/buyers" className="btn btn-ghost btn-sm">Cancel</Link>} />
      {error && <Notice tone="danger">{error}</Notice>}
      <BuyerEditor />
    </>
  );
}
