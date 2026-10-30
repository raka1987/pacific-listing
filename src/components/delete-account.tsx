"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteMyAccount } from "@/app/actions";
import { FormMessage } from "./auth-card";
import { SubmitButton } from "./submit-button";

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteMyAccount, {});
  return (
    <section className="card mt-6 border-red-200 p-5">
      <h2 className="font-semibold text-ink">Delete account</h2>
      <p className="mt-1 text-sm text-muted">
        Permanently deletes your login, profile, all your ads and photos, and your saved ads. Receipts for anything you paid for are kept for our
        records without your name. This can&apos;t be undone.
      </p>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-danger mt-4">
          <Trash2 className="h-4 w-4" /> Delete my account
        </button>
      ) : (
        <form action={action} className="mt-4 space-y-3">
          <FormMessage error={state.error} />
          <label className="label" htmlFor="confirm">
            Type <strong>DELETE</strong> to confirm
          </label>
          <input id="confirm" name="confirm" autoComplete="off" className="input max-w-xs" />
          <div className="flex flex-wrap gap-2">
            <SubmitButton className="btn bg-red-600 text-white hover:bg-red-700" pendingText="Deleting…">
              Permanently delete my account
            </SubmitButton>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
