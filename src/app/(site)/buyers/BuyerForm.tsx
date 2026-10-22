"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signUpBuyer, type BuyerFormState } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { BotFields } from "@/components/BotFields";
import { BuyBoxFields } from "@/components/BuyBoxFields";
import { BUYER_CONSENT_TEXT } from "@/lib/site";

export function BuyerForm() {
  const [state, action] = useActionState<BuyerFormState, FormData>(signUpBuyer, {});
  const [fileNote, setFileNote] = useState<string | null>(null);
  const f = state.fields ?? {};

  return (
    <form action={action} className="relative card space-y-6 p-5 sm:p-8">
      <BotFields />
      {state.error && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">{state.error}</p>
      )}

      <fieldset className="space-y-4">
        <legend className="h-display text-xl font-semibold">Your details</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="name" className="label">Full name</label><input id="name" name="name" className="input" autoComplete="name" required defaultValue={f.name} /></div>
          <div><label htmlFor="company" className="label">Company <span className="font-normal text-muted">(optional)</span></label><input id="company" name="company" className="input" autoComplete="organization" defaultValue={f.company} /></div>
          <div><label htmlFor="phone" className="label">Phone</label><input id="phone" name="phone" type="tel" inputMode="tel" className="input" autoComplete="tel" required defaultValue={f.phone} /></div>
          <div><label htmlFor="email" className="label">Email</label><input id="email" name="email" type="email" className="input" autoComplete="email" required defaultValue={f.email} /></div>
        </div>
        <div>
          <label htmlFor="password" className="label">Create a password</label>
          <input id="password" name="password" type="password" className="input" autoComplete="new-password" minLength={10} required />
          <p className="hint">At least 10 characters. You'll use this to sign in and see deals.</p>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-line pt-6">
        <legend className="h-display text-xl font-semibold">Your buy box</legend>
        <BuyBoxFields d={{ areas: f.areas, price_min: f.price_min, price_max: f.price_max }} />
      </fieldset>

      <fieldset className="space-y-2 border-t border-line pt-6">
        <legend className="h-display text-xl font-semibold">Proof of funds</legend>
        <p className="text-sm text-ink-soft">A recent bank statement, lender letter or line-of-credit letter. Black out account numbers if you like. Verified buyers see deals first.</p>
        <input
          name="pof"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/heic,image/webp"
          className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-ink file:px-4 file:font-semibold file:text-white"
          onChange={(e) => {
            const file = e.target.files?.[0];
            setFileNote(file && file.size > 4 * 1024 * 1024 ? "That file is over 4 MB. Try a PDF or a smaller photo." : null);
          }}
        />
        <p className={`hint ${fileNote ? "font-semibold text-danger" : ""}`}>{fileNote ?? "PDF or photo, up to 4 MB. You can also add it later."}</p>
      </fieldset>

      <label className="flex gap-3 rounded-lg border border-line bg-paper/60 p-4 text-xs leading-relaxed text-ink-soft">
        <input type="checkbox" name="sms_consent" className="check" />
        <span>{BUYER_CONSENT_TEXT}</span>
      </label>

      <p className="text-xs text-ink-soft">
        By creating an account you agree to our <Link href="/terms" className="underline">Terms</Link> and{" "}
        <Link href="/privacy" className="underline">Privacy Policy</Link>. We'll email you deals that match your buy box; unsubscribe anytime.
      </p>

      <SubmitButton className="btn btn-primary min-h-12 w-full text-base" pendingText="Creating your account…">
        Join the buyers list
      </SubmitButton>
      <p className="text-center text-sm text-ink-soft">Already registered? <Link href="/login" className="font-semibold text-ink underline">Sign in</Link></p>
    </form>
  );
}
