"use client";

import { Bell } from "lucide-react";
import { useState, useTransition } from "react";
import { setNotifyPrefs } from "@/app/alerts-actions";

/** Email on/off switches on the profile page. */
export function EmailSettings({ initial }: { initial: { chat: boolean; alerts: boolean } }) {
  const [prefs, setPrefs] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [, start] = useTransition();

  function change(next: typeof prefs) {
    setPrefs(next);
    setSaved(false);
    start(async () => {
      const res = await setNotifyPrefs(next.chat, next.alerts);
      if (res.error) setError(res.error);
      else setSaved(true);
    });
  }

  const row = (key: "chat" | "alerts", title: string, text: string) => (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block font-medium text-ink">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
      <span className="relative mt-1 inline-flex shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={prefs[key]}
          onChange={(e) => change({ ...prefs, [key]: e.target.checked })}
        />
        <span className="h-6 w-11 rounded-full bg-line transition peer-checked:bg-lagoon-600 peer-focus-visible:ring-4 peer-focus-visible:ring-lagoon-500/20" />
        <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );

  return (
    <section className="card mt-6 p-5">
      <h2 className="flex items-center gap-2 font-bold text-ink">
        <Bell className="h-4 w-4 text-lagoon-600" /> Notifications
      </h2>
      <div className="mt-1 divide-y divide-line">
        {row("chat", "New chat messages", "A phone notification in the app, and an email if a message waits unread for a few minutes.")}
        {row("alerts", "Saved searches and price drops", "One email a day at most, with new ads for your saved searches and price drops on ads you saved.")}
      </div>
      {saved && <p className="text-sm text-lagoon-700">Saved.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
