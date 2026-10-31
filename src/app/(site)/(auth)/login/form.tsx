"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/auth-card";
import { SubmitButton } from "@/components/submit-button";
import { login, resendConfirmation } from "../actions";
import { PasswordInput } from "@/components/password-input";

export function LoginForm({ next }: { next: string }) {
  const [loginState, action] = useActionState(login, {});
  const [resendState, resend] = useActionState(resendConfirmation, {});
  const [last, setLast] = useState<"login" | "resend">("login");
  const state = last === "resend" ? resendState : loginState;
  return (
    <form action={action} onSubmit={(e) => setLast((e.nativeEvent as SubmitEvent).submitter?.hasAttribute("data-resend") ? "resend" : "login")} className="space-y-4">
      <FormMessage {...state} />
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} className="input" />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="password">Password</label>
          <Link href="/forgot-password" className="mb-1.5 text-xs font-medium text-lagoon-700 hover:underline">Forgot password?</Link>
        </div>
        <PasswordInput autoComplete="current-password" />
      </div>
      <SubmitButton className="btn-primary w-full py-3" pendingText="Logging in…">Log in</SubmitButton>
      {(loginState.unconfirmed || resendState.unconfirmed) && (
        <button formAction={resend} formNoValidate data-resend className="btn-secondary w-full">
          Send a new confirmation link
        </button>
      )}
    </form>
  );
}
