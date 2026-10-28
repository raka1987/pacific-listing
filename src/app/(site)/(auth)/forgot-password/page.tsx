"use client";

import { useActionState } from "react";
import { AuthCard, AuthLink, FormMessage } from "@/components/auth-card";
import { SubmitButton } from "@/components/submit-button";
import { requestPasswordReset } from "../actions";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(requestPasswordReset, {});
  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a link to choose a new one." footer={<AuthLink href="/login">Back to log in</AuthLink>}>
      {state.message ? (
        <FormMessage message={state.message} />
      ) : (
        <form action={action} className="space-y-4">
          <FormMessage error={state.error} />
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className="input" />
          </div>
          <SubmitButton className="btn-primary w-full py-3" pendingText="Sending…">Send reset link</SubmitButton>
        </form>
      )}
    </AuthCard>
  );
}
