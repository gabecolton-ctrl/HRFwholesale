import { ACTIVITY_KINDS } from "@/lib/constants";
import { logFollowUp } from "@/app/crm/leads/actions";
import { SubmitButton } from "@/components/SubmitButton";

/** Log a touch and roll the lead to its next cadence date. */
export function FollowUpForm({ leadId, back, compact = false }: { leadId: string; back: string; compact?: boolean }) {
  return (
    <form action={logFollowUp} className="space-y-3">
      <input type="hidden" name="lead_id" value={leadId} />
      <input type="hidden" name="back" value={back} />
      <div className="flex flex-wrap gap-2">
        {ACTIVITY_KINDS.filter((k) => !compact || ["call", "text", "voicemail", "email"].includes(k.value)).map((k, i) => (
          <label key={k.value} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white">
            <input type="radio" name="kind" value={k.value} defaultChecked={i === 0} className="sr-only" />
            {k.label}
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="reached" className="check mt-0" /> Talked to them (live conversation)
      </label>
      <input name="outcome" className="input" placeholder="What happened? e.g. wants $140k, call back after probate" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label text-xs" htmlFor={`next-${leadId}`}>Next follow-up</label>
          <input id={`next-${leadId}`} name="next_date" type="date" className="input" />
          <p className="hint">Leave blank to use the cadence (3, 7, 14, 30, 60, 90 days).</p>
        </div>
        <div>
          <label className="label text-xs" htmlFor={`st-${leadId}`}>Update status</label>
          <select id={`st-${leadId}`} name="status" className="input" defaultValue="">
            <option value="">Keep current</option>
            <option>Follow up</option>
            <option>Appointment set</option>
          </select>
        </div>
      </div>
      <SubmitButton className="btn btn-dark w-full sm:w-auto" pendingText="Logging…">Log & schedule next</SubmitButton>
    </form>
  );
}
