"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitSellerLead, type FormState } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { BotFields } from "@/components/BotFields";
import { CONDITIONS, SELL_REASONS, TIMELINES } from "@/lib/constants";
import { SELLER_CONSENT_TEXT, site } from "@/lib/site";

export function SellForm({ initialAddress }: { initialAddress?: string }) {
  const [state, action] = useActionState<FormState, FormData>(submitSellerLead, {});
  const f = state.fields ?? {};

  return (
    <form action={action} className="relative card space-y-5 p-5 sm:p-8" noValidate={false}>
      <BotFields />
      {state.error && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
          {state.error}
        </p>
      )}

      <fieldset className="space-y-4">
        <legend className="h-display text-xl font-semibold">About you</legend>
        <div>
          <label htmlFor="name" className="label">Full name</label>
          <input id="name" name="name" className="input" autoComplete="name" required defaultValue={f.name} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className="label">Phone</label>
            <input id="phone" name="phone" type="tel" inputMode="tel" className="input" autoComplete="tel" required defaultValue={f.phone} />
          </div>
          <div>
            <label htmlFor="email" className="label">Email <span className="font-normal text-muted">(optional)</span></label>
            <input id="email" name="email" type="email" className="input" autoComplete="email" defaultValue={f.email} />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-line pt-5">
        <legend className="h-display text-xl font-semibold">About the property</legend>
        <div>
          <label htmlFor="address" className="label">Property address</label>
          <input id="address" name="address" className="input" autoComplete="street-address" required defaultValue={f.address ?? initialAddress} />
        </div>
        <div className="grid grid-cols-[1fr_8rem] gap-4">
          <div>
            <label htmlFor="city" className="label">City</label>
            <input id="city" name="city" className="input" autoComplete="address-level2" defaultValue={f.city} />
          </div>
          <div>
            <label htmlFor="zip" className="label">ZIP</label>
            <input id="zip" name="zip" className="input" inputMode="numeric" maxLength={5} autoComplete="postal-code" defaultValue={f.zip} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="condition" className="label">Condition</label>
            <select id="condition" name="condition" className="input" defaultValue={f.condition ?? ""}>
              <option value="">Select…</option>
              {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="timeline" className="label">When do you want to sell?</label>
            <select id="timeline" name="timeline" className="input" defaultValue={f.timeline ?? ""}>
              <option value="">Select…</option>
              {TIMELINES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="reason" className="label">What's got you thinking about selling?</label>
          <select id="reason-pick" className="input mb-2" aria-label="Common reasons" defaultValue=""
            onChange={(e) => {
              const box = document.getElementById("reason") as HTMLTextAreaElement | null;
              if (box && e.target.value && !box.value.includes(e.target.value)) box.value = box.value ? `${e.target.value}. ${box.value}` : e.target.value;
            }}>
            <option value="">Pick one (optional)…</option>
            {SELL_REASONS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <textarea id="reason" name="reason" rows={3} className="input" placeholder="Anything that helps us understand your situation" defaultValue={f.reason} />
        </div>
      </fieldset>

      <div className="rounded-lg border border-line bg-paper/60 p-4">
        <label className="flex gap-3 text-xs leading-relaxed text-ink-soft">
          <input type="checkbox" name="consent" className="check" required />
          <span>
            {SELLER_CONSENT_TEXT.replace(" See our Privacy Policy and Terms.", "")} See our{" "}
            <Link href="/privacy" className="underline">Privacy Policy</Link> and <Link href="/terms" className="underline">Terms</Link>.
          </span>
        </label>
        <p className="mt-3 text-xs text-ink-soft">
          Rather not check the box? Call us at <a href={site.phoneHref} className="font-semibold underline">{site.phone}</a> instead.
        </p>
      </div>

      <SubmitButton className="btn btn-primary min-h-12 w-full text-base" pendingText="Sending…">
        Get my cash offer
      </SubmitButton>
    </form>
  );
}
