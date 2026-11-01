"use client";

import { BellRing } from "lucide-react";
import { useState, useTransition } from "react";
import { adminPushCheck, adminSendTestPush } from "../../actions";

/** Shows a member's notification phones and sends them a test notification. */
export function PushTest({ userId, phones }: { userId: string; phones: { platform: string; updated_at: string }[] | null }) {
  const [result, setResult] = useState("");
  const [check, setCheck] = useState<string[]>([]);
  const [pending, start] = useTransition();
  return (
    <section className="card space-y-3 p-5">
      <h2 className="flex items-center gap-2 font-bold">
        <BellRing className="h-4 w-4 text-lagoon-600" /> Phone notifications
      </h2>
      {phones === null ? (
        <p className="text-sm text-muted">Run the database update 20261109000000_push_admin.sql to see this.</p>
      ) : phones.length ? (
        <p className="text-sm text-ink-2">
          On for {phones.length} {phones.length === 1 ? "phone" : "phones"} (
          {phones.map((p) => `${p.platform}, set up ${new Date(p.updated_at).toLocaleDateString()}`).join("; ")}).
        </p>
      ) : (
        <p className="text-sm text-muted">
          Not switched on. In the app they go to Account → Profile → Turn on phone notifications.
        </p>
      )}
      {!!phones?.length && (
        <button
          disabled={pending}
          onClick={() => start(async () => setResult(await adminSendTestPush(userId)))}
          className="btn-secondary w-full text-sm"
        >
          {pending ? "Sending…" : "Send a test notification"}
        </button>
      )}
      {result && <p className="rounded-xl bg-subtle p-3 text-sm text-ink-2">{result}</p>}
      <button
        disabled={pending}
        onClick={() => start(async () => setCheck(await adminPushCheck()))}
        className="btn-ghost w-full text-sm"
      >
        Check notification setup
      </button>
      {check.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-subtle p-3 text-xs break-words text-ink-2">
          {check.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
