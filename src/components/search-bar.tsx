"use client";

import { Globe2, LayoutGrid, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CATEGORIES, COUNTRIES } from "@/lib/constants";
import { CategoryIcon } from "./category-icon";
import { Dropdown, type DropdownOption } from "./dropdown";

export function SearchBar({
  size = "md",
  withCountry = false,
  withCategory = false,
  defaultCountry,
}: {
  size?: "md" | "lg";
  withCountry?: boolean;
  withCategory?: boolean;
  defaultCountry?: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [country, setCountry] = useState(params.get("country") ?? defaultCountry ?? "");
  const [category, setCategory] = useState(params.get("category") ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams();
    if (q.trim()) next.set("q", q.trim());
    const c = withCountry ? country : params.get("country");
    if (c) next.set("country", c);
    // A chosen category opens that category's page; otherwise search everything.
    const base = withCategory && category ? `/category/${category}` : "/search";
    router.push(`${base}${next.size ? `?${next}` : ""}`);
  }

  const lg = size === "lg";
  const categoryOptions: DropdownOption[] = [
    { value: "", label: "All categories", icon: <LayoutGrid className="h-4 w-4" /> },
    ...CATEGORIES.map((c) => ({ value: c.slug, label: c.name, icon: <CategoryIcon icon={c.icon} className="h-4 w-4" /> })),
  ];
  const countryOptions: DropdownOption[] = [
    { value: "", label: "All Pacific", icon: <Globe2 className="h-4 w-4" /> },
    ...COUNTRIES.map((c) => ({ value: c.code, label: c.name, icon: <span className="text-base leading-none">{c.flag}</span> })),
  ];
  const triggerCls = "py-2 text-slate-700 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white";

  const categorySelect = (pillCls: string, align: "left" | "right" = "left") => (
    <Dropdown label="Category" value={category} onChange={setCategory} options={categoryOptions} align={align} className={pillCls} buttonClassName={triggerCls} />
  );
  const countrySelect = (pillCls: string, align: "left" | "right" = "left") => (
    <Dropdown label="Country" value={country} onChange={setCountry} options={countryOptions} align={align} className={pillCls} buttonClassName={triggerCls} />
  );

  return (
    <form onSubmit={submit} role="search">
      <div
        className={`flex w-full items-center gap-2 rounded-full border transition focus-within:ring-4 ${
          lg
            ? "border-white/40 bg-white/95 p-1.5 shadow-2xl shadow-ocean-950/30 focus-within:ring-white/30 dark:border-white/10 dark:bg-ocean-900/90"
            : "border-line bg-subtle p-1 focus-within:border-lagoon-400 focus-within:bg-surface focus-within:ring-lagoon-500/15"
        }`}
      >
        <label className="flex min-w-0 flex-1 items-center gap-2.5 pl-4">
          <Search className={`shrink-0 text-faint ${lg ? "h-5 w-5" : "h-4 w-4"}`} aria-hidden />
          <span className="sr-only">Search listings</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={lg ? "What are you looking for?" : "Search cars, houses, jobs…"}
            enterKeyHint="search"
            className={`w-full min-w-0 bg-transparent placeholder:text-faint focus:outline-none ${
              lg ? "py-2.5 text-base text-slate-900 dark:text-white" : "py-1.5 text-sm text-ink"
            }`}
          />
        </label>
        {withCategory && categorySelect("hidden w-44 shrink-0 border-l border-slate-200 pl-3 md:block dark:border-white/10")}
        {withCountry && countrySelect("hidden w-44 shrink-0 border-l border-slate-200 pl-3 md:block dark:border-white/10", "right")}
        <button type="submit" className={lg ? "btn-accent h-12 w-12 shrink-0 p-0 text-base md:w-auto md:px-7" : "btn-primary h-9 w-9 p-0"}>
          {lg ? (
            <>
              <Search className="h-5 w-5 md:hidden" aria-label="Search" />
              <span className="hidden md:inline">Search</span>
            </>
          ) : (
            <Search className="h-4 w-4" aria-label="Search" />
          )}
        </button>
      </div>
      {(withCategory || withCountry) && (
        // On phones the dropdowns sit under the search box
        <div className="mt-2 flex gap-2 md:hidden">
          {withCategory && categorySelect("min-w-0 flex-1 rounded-full bg-white/95 px-3.5 dark:bg-ocean-900/90")}
          {withCountry && countrySelect("min-w-0 flex-1 rounded-full bg-white/95 px-3.5 dark:bg-ocean-900/90", "right")}
        </div>
      )}
    </form>
  );
}
