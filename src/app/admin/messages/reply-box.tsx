"use client";

import { Reply, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { adminReplyToMessage } from "../actions";

/** Write and send a reply to a contact message without leaving the admin panel. */
export function ReplyBox({ id, name, email }: { id: string; name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const btn = "inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:bg-subtle";

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${btn} border-lagoon-200 text-lagoon-700`}>
        <Reply className="h-3.5 w-3.5" /> Reply
      </button>
    );
  }
  return (
    <form
      className="mt-4 w-full basis-full rounded-2xl bg-subtle p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        start(async () => {
          const res = await adminReplyToMessage(id, text);
          if (res.error) setError(res.error);
          else {
            setText("");
            setOpen(false);
          }
        });
      }}
    >
      <label className="mb-1.5 block text-xs font-medium text-muted" htmlFor={`reply-${id}`}>
        Reply to {name} ({email}). It&apos;s emailed from support@pacificlisting.com, and their answer comes back to that inbox.
      </label>
      <textarea
        id={`reply-${id}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        maxLength={5000}
        autoFocus
        placeholder={`Hi ${name.split(" ")[0]}, …`}
        className="input bg-surface"
      />
      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className={btn}>Cancel</button>
        <button disabled={pending || !text.trim()} className="btn-primary px-4 py-2 text-sm">
          <Send className="h-4 w-4" /> {pending ? "Sending…" : "Send reply"}
        </button>
      </div>
    </form>
  );
}
