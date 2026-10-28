"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage } from "@/components/auth-card";
import { SubmitButton } from "@/components/submit-button";
import { login } from "../actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(login, {});
  return (
    <form action={action} className="space-y-4">
      <FormMessage {...state} />
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="password">Password</label>
          <Link href="/forgot-password" className="mb-1.5 text-xs font-medium text-lagoon-700 hover:underline">Forgot password?</Link>
        </div>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <SubmitButton className="btn-primary w-full py-3" pendingText="Logging in…">Log in</SubmitButton>
    </form>
  );
}
