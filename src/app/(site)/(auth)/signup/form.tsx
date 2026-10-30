"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage } from "@/components/auth-card";
import { CheckEmail } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { COUNTRIES, HEARD_FROM } from "@/lib/constants";
import { signup } from "../actions";

export function SignupForm({ next }: { next: string }) {
  const [state, action] = useActionState(signup, {});
  if (state.message) {
    return (
      <CheckEmail>
        <p>
          We&apos;ve sent a link to <strong className="break-all text-ink">{state.sentTo}</strong>. Tap it to activate your account.
        </p>
        <p className="text-muted">It usually arrives within a minute. If you can&apos;t see it, check your Spam or Promotions folder.</p>
        <Link href="/login" className="btn-primary mt-2 w-full">Go to log in</Link>
      </CheckEmail>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <FormMessage {...state} />
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="full_name">Your name</label>
        <input id="full_name" name="full_name" autoComplete="name" required defaultValue={state.values?.full_name} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} className="input" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="country">Country</label>
          <select id="country" name="country" defaultValue={state.values?.country ?? "FJ"} className="input">
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone <span className="font-normal text-faint">(optional)</span></label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={state.values?.phone} className="input" placeholder="+679…" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="heard_from">
          How did you hear about us? <span className="font-normal text-faint">(optional)</span>
        </label>
        <select id="heard_from" name="heard_from" defaultValue={state.values?.heard_from ?? ""} className="input">
          <option value="">Choose one…</option>
          {HEARD_FROM.map((h) => (
            <option key={h}>{h}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" />
        <p className="mt-1 text-xs text-muted">At least 8 characters.</p>
      </div>
      <SubmitButton className="btn-accent w-full py-3" pendingText="Creating account…">Create account</SubmitButton>
      <p className="text-center text-xs text-muted">
        By signing up you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.
      </p>
    </form>
  );
}
