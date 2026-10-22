"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createLead, updateLead, type LeadFormState } from "@/app/crm/leads/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { CONDITIONS, LEAD_SOURCES, LEAD_STATUSES, PROPERTY_TYPES, TIMELINES, VA_STATUSES, type AppRole } from "@/lib/constants";

export type LeadRow = Record<string, unknown> & { id?: string };
type Staff = { id: string; full_name: string | null; email: string | null };

function v(l: LeadRow, k: string) {
  const x = l[k];
  return x === null || x === undefined ? "" : String(x);
}

export function LeadForm({ lead = {}, role, staff = [] }: { lead?: LeadRow; role: AppRole; staff?: Staff[] }) {
  const editing = Boolean(lead.id);
  const [state, action] = useActionState<LeadFormState, FormData>(editing ? updateLead : createLead, {});
  const [status, setStatus] = useState(v(lead, "status") || "New");
  const isVa = role === "va";
  const statuses = isVa ? (LEAD_STATUSES as readonly string[]).filter((s) => VA_STATUSES.includes(s as never) || s === lead.status) : LEAD_STATUSES;

  return (
    <form action={action} className="space-y-6">
      {editing && <input type="hidden" name="id" value={String(lead.id)} />}
      {state.error && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <p className="font-semibold">{state.error}</p>
          {state.duplicateId && (
            <p className="mt-2 flex flex-wrap gap-3">
              <Link href={`/crm/leads/${state.duplicateId}`} className="underline">Open the existing lead</Link>
              <label className="flex items-center gap-2"><input type="checkbox" name="allow_duplicate" value="1" className="check mt-0" /> Save anyway</label>
            </p>
          )}
        </div>
      )}

      <Section title="Seller">
        <Field label="Seller name" name="seller_name" d={v(lead, "seller_name")} required />
        <Field label="Phone" name="phone" type="tel" d={v(lead, "phone")} />
        <Field label="Email" name="email" type="email" d={v(lead, "email")} />
        <Field label="Mailing address (if different)" name="mailing_address" d={v(lead, "mailing_address")} />
      </Section>

      <Section title="Property">
        <Field label="Property address" name="address" d={v(lead, "address")} required wide />
        <Field label="City" name="city" d={v(lead, "city")} />
        <Field label="ZIP" name="zip" d={v(lead, "zip")} inputMode="numeric" />
        <Field label="County" name="county" d={v(lead, "county")} />
        <Select label="Property type" name="property_type" d={v(lead, "property_type")} options={PROPERTY_TYPES} />
        <Field label="Beds" name="beds" d={v(lead, "beds")} inputMode="decimal" />
        <Field label="Baths" name="baths" d={v(lead, "baths")} inputMode="decimal" />
        <Field label="Sq ft" name="sqft" d={v(lead, "sqft")} inputMode="numeric" />
        <Field label="Year built" name="year_built" d={v(lead, "year_built")} inputMode="numeric" />
        <Select label="Condition" name="condition" d={v(lead, "condition")} options={CONDITIONS} />
        <Select label="Occupancy" name="occupancy" d={v(lead, "occupancy")} options={["Owner occupied", "Tenant occupied", "Vacant"]} />
      </Section>

      <Section title="Motivation">
        <Field label="Reason for selling" name="reason_for_selling" d={v(lead, "reason_for_selling")} wide />
        <Select label="Timeline" name="timeline" d={v(lead, "timeline")} options={TIMELINES} />
        <Field label="Asking price" name="asking_price" d={v(lead, "asking_price")} inputMode="numeric" />
        <Select label="Motivation (1–5)" name="motivation" d={v(lead, "motivation")} options={["1", "2", "3", "4", "5"]} />
        <Select label="Lead source" name="lead_source" d={v(lead, "lead_source")} options={LEAD_SOURCES} />
      </Section>

      {!isVa && (
        <Section title="Numbers">
          <Field label="Est. ARV" name="est_arv" d={v(lead, "est_arv")} inputMode="numeric" />
          <Field label="Est. repairs" name="est_repairs" d={v(lead, "est_repairs")} inputMode="numeric" />
          <Field label="Mortgage balance" name="mortgage_balance" d={v(lead, "mortgage_balance")} inputMode="numeric" />
          <Field label="Offer amount" name="offer_amount" d={v(lead, "offer_amount")} inputMode="numeric" />
        </Section>
      )}

      <Section title="Keep-or-wholesale signals">
        <div className="col-span-full flex flex-wrap gap-2">
          <Toggle name="low_rate_loan" label="Low-rate loan" d={lead.low_rate_loan === true} />
          <Toggle name="free_and_clear" label="Free and clear" d={lead.free_and_clear === true} />
          <Toggle name="tired_landlord" label="Tired landlord" d={lead.tired_landlord === true} />
          <Toggle name="keep_candidate" label="Keep candidate" d={lead.keep_candidate === true} />
        </div>
        <Select label="Open to monthly payments?" name="open_to_monthly_payments"
          d={lead.open_to_monthly_payments === true ? "yes" : lead.open_to_monthly_payments === false ? "no" : ""}
          options={[["yes", "Yes"], ["no", "No"]]} />
        <p className="col-span-full text-xs text-ink-soft">Any signal flags the lead as a keep candidate automatically.</p>
      </Section>

      <Section title="Status & follow-up">
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {statuses.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        {status === "Dead" && <Field label="Why is it dead?" name="dead_reason" d={v(lead, "dead_reason")} required />}
        <Field label="Next follow-up" name="next_follow_up" type="date" d={v(lead, "next_follow_up")} hint="Blank = automatic cadence" />
        {!isVa && staff.length > 0 && (
          <Select label="Assigned to" name="assigned_to" d={v(lead, "assigned_to")}
            options={staff.map((s) => [s.id, s.full_name ?? s.email ?? "Team member"] as [string, string])} emptyLabel="Unassigned" />
        )}
        <div className="col-span-full">
          <Toggle name="do_not_call" label="Do Not Call" d={lead.do_not_call === true} danger />
          <p className="hint">Removes the lead from every follow-up list. Use whenever someone asks you to stop contacting them.</p>
        </div>
        <div className="col-span-full">
          <label className="label" htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" rows={4} className="input" defaultValue={v(lead, "notes")} />
        </div>
      </Section>

      <div className="sticky bottom-16 z-10 -mx-4 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur lg:bottom-0">
        <SubmitButton className="btn btn-primary w-full sm:w-auto">{editing ? "Save changes" : "Add lead"}</SubmitButton>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="card p-4 sm:p-5">
      <legend className="sr-only">{title}</legend>
      <h2 className="mb-3 text-sm font-bold tracking-wide text-ink-soft uppercase">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </fieldset>
  );
}

function Field({ label, name, d, type = "text", required, wide, inputMode, hint }: {
  label: string; name: string; d: string; type?: string; required?: boolean; wide?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; hint?: string;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} className="input" defaultValue={d} required={required} inputMode={inputMode} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

function Select({ label, name, d, options, emptyLabel = "—" }: {
  label: string; name: string; d: string; options: readonly (string | [string, string])[]; emptyLabel?: string;
}) {
  const opts = options.map((o) => (Array.isArray(o) ? o : [o, o]));
  const known = opts.some(([val]) => val === d);
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select id={name} name={name} className="input" defaultValue={d}>
        <option value="">{emptyLabel}</option>
        {!known && d && <option value={d}>{d}</option>}
        {opts.map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}
      </select>
    </div>
  );
}

function Toggle({ name, label, d, danger }: { name: string; label: string; d: boolean; danger?: boolean }) {
  return (
    <label className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-medium ${danger ? "has-[:checked]:border-danger has-[:checked]:bg-danger/5 has-[:checked]:text-danger" : "has-[:checked]:border-sage has-[:checked]:bg-sage/10"}`}>
      <input type="checkbox" name={name} defaultChecked={d} className="check mt-0" /> {label}
    </label>
  );
}
