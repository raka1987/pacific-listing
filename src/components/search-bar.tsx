"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { COUNTRIES } from "@/lib/constants";

export function SearchBar({ size = "md", withCountry = false }: { size?: "md" | "lg"; withCountry?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [country, setCountry] = useState(params.get("country") ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams();
    if (q.trim()) next.set("q", q.trim());
    const c = withCountry ? country : params.get("country");
    if (c) next.set("country", c);
    router.push(`/search${next.size ? `?${next}` : ""}`);
  }

  const lg = size === "lg";
  return (
    <form
      onSubmit={submit}
      role="search"
      className={`flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white ${
        lg ? "p-2 shadow-xl shadow-ocean-950/20" : "p-1 pl-1"
      }`}
    >
      <label className="flex min-w-0 flex-1 items-center gap-2 pl-3">
        <Search className={`shrink-0 text-slate-400 ${lg ? "h-5 w-5" : "h-4 w-4"}`} aria-hidden />
        <span className="sr-only">Search listings</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={lg ? "What are you looking for?" : "Search cars, houses, jobs…"}
          className={`w-full min-w-0 bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none ${
            lg ? "py-2 text-base" : "py-1.5 text-sm"
          }`}
        />
      </label>
      {withCountry && (
        <label className="hidden border-l border-slate-200 pl-2 sm:block">
          <span className="sr-only">Country</span>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="max-w-44 bg-transparent py-2 pr-2 text-sm font-medium text-slate-700 focus:outline-none"
          >
            <option value="">All Pacific</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button type="submit" className={lg ? "btn-accent px-6 py-3 text-base" : "btn-primary px-3 py-2"}>
        {lg ? "Search" : <Search className="h-4 w-4" aria-label="Search" />}
      </button>
    </form>
  );
}
