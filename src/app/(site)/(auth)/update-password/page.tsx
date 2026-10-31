"use client";

import { useActionState } from "react";
import { AuthCard, FormMessage } from "@/components/auth-card";
import { SubmitButton } from "@/components/submit-button";
import { updatePassword } from "../actions";
import { PasswordInput } from "@/components/password-input";

export default function UpdatePasswordPage() {
  const [state, action] = useActionState(updatePassword, {});
  return (
    <AuthCard title="Choose a new password">
      <form action={action} className="space-y-4">
        <FormMessage error={state.error} />
        <div>
          <label className="label" htmlFor="password">New password</label>
          <PasswordInput autoComplete="new-password" minLength={8} />
        </div>
        <SubmitButton className="btn-primary w-full py-3" pendingText="Saving…">Save password</SubmitButton>
      </form>
    </AuthCard>
  );
}
