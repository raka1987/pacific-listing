"use client";

import { Camera, FileImage } from "lucide-react";
import { useActionState, useState } from "react";
import { requestVerification } from "@/app/alerts-actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export function VerifyForm({ phone }: { phone: string }) {
  const [state, action] = useActionState(requestVerification, {});
  const [fileName, setFileName] = useState("");
  return (
    <form action={action} className="space-y-4">
      <FormMessage error={state.error} />
      <div>
        <label className="label" htmlFor="phone">Phone number</label>
        <input id="phone" name="phone" type="tel" required defaultValue={state.values?.phone ?? phone} className="input" placeholder="+679 …" />
        <p className="mt-1 text-xs text-muted">The number buyers can reach you on. We may call or message it to check.</p>
      </div>
      <div>
        <label className="label" htmlFor="business_name">Business name (optional)</label>
        <input id="business_name" name="business_name" defaultValue={state.values?.business_name} className="input" placeholder="e.g. Island Motors" />
      </div>
      <div>
        <span className="label">Photo of your ID</span>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-line p-4 hover:border-lagoon-500">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lagoon-50 text-lagoon-700">
            {fileName ? <FileImage className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
          </span>
          <span className="min-w-0 text-sm">
            <span className="block truncate font-medium text-ink">{fileName || "Take or choose a photo"}</span>
            <span className="block text-muted">Passport, driver&apos;s licence, voter card or business registration</span>
          </span>
          <input
            name="document"
            type="file"
            accept="image/*,application/pdf"
            required
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
          />
        </label>
        <p className="mt-1 text-xs text-muted">Only our team sees it, and it&apos;s deleted as soon as we&apos;ve checked it.</p>
      </div>
      <SubmitButton className="btn-primary w-full py-3" pendingText="Sending…">Send for checking</SubmitButton>
    </form>
  );
}
