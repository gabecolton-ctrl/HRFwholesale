import { requireRole } from "@/lib/auth";
import { Notice, PageHeader } from "@/components/crm/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { ROLE_LABELS, type AppRole } from "@/lib/constants";
import { dateShort } from "@/lib/format";
import { inviteMember, setRole } from "./actions";

export const metadata = { title: "Team" };

const STAFF: AppRole[] = ["owner", "acquisitions", "dispositions", "va", "pending"];

export default async function Team({ searchParams }: { searchParams: Promise<{ saved?: string; invited?: string; error?: string }> }) {
  const { supabase, user } = await requireRole("owner");
  const sp = await searchParams;
  const { data } = await supabase.from("profiles").select("id,email,full_name,role,active,created_at").neq("role", "buyer").order("created_at");

  return (
    <>
      <PageHeader title="Team" sub="Each role only sees what it needs. The database enforces it." />
      {sp.saved && <Notice>Saved.</Notice>}
      {sp.invited && <Notice>Invite sent. They'll get an email to set a password.</Notice>}
      {sp.error && <Notice tone="danger">{sp.error}</Notice>}

      <section className="card mb-5 p-4 sm:p-5">
        <h2 className="font-semibold">Invite a team member</h2>
        <form action={inviteMember} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_12rem_auto]">
          <input name="full_name" className="input" placeholder="Full name" aria-label="Full name" />
          <input name="email" type="email" required className="input" placeholder="Email" aria-label="Email" />
          <select name="role" className="input" defaultValue="va" aria-label="Role">
            {(["acquisitions", "dispositions", "va", "owner"] as AppRole[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <SubmitButton className="btn btn-dark" pendingText="Sending…">Send invite</SubmitButton>
        </form>
        <dl className="mt-4 grid gap-2 text-xs text-ink-soft sm:grid-cols-3">
          <div><dt className="font-semibold text-ink">Acquisitions rep</dt><dd>Their own + unassigned leads, follow-ups, their deals.</dd></div>
          <div><dt className="font-semibold text-ink">Dispositions</dt><dd>Cash buyers and the full pipeline. No seller leads.</dd></div>
          <div><dt className="font-semibold text-ink">VA / caller</dt><dd>Enter leads and work follow-ups. Can't make offers, reassign, or see deals and buyers.</dd></div>
        </dl>
      </section>

      <ul className="space-y-2">
        {(data ?? []).map((p) => (
          <li key={p.id} className="card p-4">
            <form action={setRole} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input type="hidden" name="id" value={p.id} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.full_name ?? p.email}{p.id === user.id && " (you)"}</p>
                <p className="truncate text-sm text-ink-soft">{p.email} · since {dateShort(p.created_at)}</p>
              </div>
              <select name="role" defaultValue={p.role} className="input sm:w-48" disabled={p.id === user.id} aria-label="Role">
                {STAFF.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={p.active} disabled={p.id === user.id} className="check mt-0" /> Active</label>
              {p.id !== user.id && <SubmitButton className="btn btn-ghost btn-sm">Save</SubmitButton>}
            </form>
          </li>
        ))}
      </ul>
    </>
  );
}
