"use client";

import { useFormStatus } from "react-dom";

/** A submit button that asks for confirmation first. */
export function ConfirmButton({ message, className, children }: { message: string; className: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

export function ActionButton({ className, children, title }: { className: string; children: React.ReactNode; title?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} ${pending ? "opacity-50" : ""}`} title={title}>
      {children}
    </button>
  );
}
