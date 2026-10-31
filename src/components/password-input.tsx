"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

/** Password box with an eye button to show or hide what's been typed. */
export function PasswordInput({ id = "password", autoComplete, minLength }: { id?: string; autoComplete: string; minLength?: number }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name="password"
        type={shown ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={minLength}
        required
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="input pr-12"
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted hover:text-ink"
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        aria-controls={id}
      >
        {shown ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}
