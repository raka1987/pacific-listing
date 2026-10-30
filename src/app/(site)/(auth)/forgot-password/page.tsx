"use client";

import { useActionState, useEffect, useState } from "react";
import { AuthCard, AuthLink, FormMessage } from "@/components/auth-card";
import { SubmitButton } from "@/components/submit-button";
import { requestPasswordReset } from "../actions";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(requestPasswordReset, {});
  const [linkError, setLinkError] = useState<string | null>(null);
  useEffect(() => setLinkError(new URLSearchParams(window.location.search).get("error")), []);
  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a link to choose a new one." footer={<AuthLink href="/login">Back to log in</AuthLink>}>
      {state.message ? (
        <FormMessage message={state.message} />
      ) : (
        <form action={action} className="space-y-4">
          <FormMessage error={state.error} />
          {linkError && !state.error && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              {linkError === "browser"
                ? "That reset link has to be opened on the same phone or computer, in the same browser, where you asked for it. Request a new one below."
                : "That reset link has expired or was already used. Request a new one below."}
            </p>
          )}
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
