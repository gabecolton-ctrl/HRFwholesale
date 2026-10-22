import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/crm/ui";
import { LeadForm } from "@/components/crm/LeadForm";
import { leadOwners } from "@/lib/staff";

export const metadata = { title: "Add lead" };

export default async function NewLead() {
  const { supabase, profile } = await requireRole("owner", "acquisitions", "va");
  const staff = profile.role === "va" ? [] : await leadOwners(supabase);
  return (
    <>
      <PageHeader title="Add a lead" actions={<Link href="/crm/leads" className="btn btn-ghost btn-sm">Cancel</Link>} />
      <LeadForm role={profile.role} staff={staff} lead={{ status: "New" }} />
    </>
  );
}
