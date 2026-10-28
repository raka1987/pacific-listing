"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/auth-card";
import { SubmitButton } from "@/components/submit-button";
import { COUNTRIES } from "@/lib/constants";
import { signup } from "../actions";

export function SignupForm({ next }: { next: string }) {
  const [state, action] = useActionState(signup, {});
  if (state.message) return <FormMessage message={state.message} />;
  return (
    <form action={action} className="space-y-4">
      <FormMessage {...state} />
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="full_name">Your name</label>
        <input id="full_name" name="full_name" autoComplete="name" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="country">Country</label>
          <select id="country" name="country" defaultValue="FJ" className="input">
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone <span className="font-normal text-slate-400">(optional)</span></label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" className="input" placeholder="+679…" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" />
        <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
      </div>
      <SubmitButton className="btn-accent w-full py-3" pendingText="Creating account…">Create account</SubmitButton>
      <p className="text-center text-xs text-slate-500">
        By signing up you agree to our <a href="/terms" className="underline">Terms</a> and <a href="/privacy" className="underline">Privacy Policy</a>.
      </p>
    </form>
  );
}
