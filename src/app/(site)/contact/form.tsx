"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { sendContactMessage } from "@/app/actions";
import { FormMessage } from "@/components/auth-card";
import { SubmitButton } from "@/components/submit-button";

export function ContactForm({ name, email, subject, message }: { name?: string; email?: string; subject?: string; message?: string }) {
  const [state, action] = useActionState(sendContactMessage, {});
  if (state.ok) {
    return (
      <div className="card p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-lagoon-600" />
        <h2 className="mt-3 text-lg font-bold">Message sent — vinaka!</h2>
        <p className="mt-1 text-sm text-muted">We usually reply within one or two working days.</p>
      </div>
    );
  }
  return (
    <form action={action} className="card space-y-4 p-5 sm:p-6">
      <FormMessage error={state.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" name="name" defaultValue={state.values?.name ?? name} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" defaultValue={state.values?.email ?? email} required className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="subject">Topic</label>
        <select id="subject" name="subject" defaultValue={state.values?.subject ?? subject ?? "General"} className="input">
          {["General", "Help with my account", "Report a problem", "Feedback & suggestions", "Advertising & business", "Other"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="message">Message</label>
        <textarea id="message" name="message" rows={6} required maxLength={5000} defaultValue={state.values?.message ?? message} className="input" />
      </div>
      {/* Honeypot field: hidden from people, filled in by spam bots */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <SubmitButton pendingText="Sending…">Send message</SubmitButton>
    </form>
  );
}
