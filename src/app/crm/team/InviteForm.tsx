"use client";

import { useActionState } from "react";
import { inviteMember, type InviteState } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { CopyButton } from "@/components/CopyButton";
import { ROLE_LABELS, type AppRole } from "@/lib/constants";

export function InviteForm() {
  const [state, action] = useActionState<InviteState, FormData>(inviteMember, {});
  return (
    <>
      <form action={action} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_12rem_auto]">
        <input name="full_name" className="input" placeholder="Full name" aria-label="Full name" />
        <input name="email" type="email" required className="input" placeholder="Email" aria-label="Email" />
        <select name="role" className="input" defaultValue="va" aria-label="Role">
          {(["acquisitions", "dispositions", "va", "owner"] as AppRole[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <SubmitButton className="btn btn-dark" pendingText="Creating…">Send invite</SubmitButton>
      </form>
      {state.error && <p role="alert" className="mt-3 rounded-lg bg-danger/5 px-3 py-2 text-sm font-medium text-danger">{state.error}</p>}
      {state.link && (
        <div role="status" className="mt-3 rounded-lg border border-sage/40 bg-sage/5 p-3 text-sm">
          <p className="font-semibold text-sage">
            {state.emailed ? `Invite emailed to ${state.email}.` : `Invite created for ${state.email}.`}
            {state.existing && " (They already had a login, so this is a set-password link.)"}
          </p>
          {state.note && <p className="mt-1 text-amber">{state.note}</p>}
          <p className="mt-2 text-ink-soft">Backup: copy this one-time link and text it to them. It expires, so they should use it today.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="max-w-full truncate rounded bg-white px-2 py-1 text-xs ring-1 ring-line">{state.link}</code>
            <CopyButton text={state.link} label="Copy link" />
          </div>
        </div>
      )}
    </>
  );
}
