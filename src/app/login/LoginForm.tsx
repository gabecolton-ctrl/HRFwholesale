"use client";
import { useActionState } from "react";
import { signIn, sendReset, type LoginState } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export function LoginForm({ next }: { next?: string }) {
  const [state, login] = useActionState<LoginState, FormData>(signIn, {});
  const [reset, resetAction] = useActionState<LoginState, FormData>(sendReset, {});
  const msg = state.error ?? reset.error;
  return (
    <form action={login} className="card space-y-4 p-6 sm:p-8">
      <input type="hidden" name="next" value={next ?? ""} />
      {msg && <p role="alert" className="rounded-lg bg-danger/5 px-3 py-2 text-sm font-medium text-danger">{msg}</p>}
      {reset.notice && <p className="rounded-lg bg-sage/10 px-3 py-2 text-sm font-medium text-sage">{reset.notice}</p>}
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" className="input" autoComplete="email" required defaultValue={state.email ?? reset.email} />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" />
      </div>
      <SubmitButton className="btn btn-dark w-full" pendingText="Signing in…">Sign in</SubmitButton>
      <button formAction={resetAction} formNoValidate className="w-full text-center text-sm font-medium text-ink-soft underline">
        Forgot password?
      </button>
    </form>
  );
}
