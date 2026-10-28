"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORIES, COUNTRIES } from "@/lib/constants";
import type { SearchFilters } from "@/lib/queries";

export function SearchFiltersPanel({ filters, basePath, lockCategory }: { filters: SearchFilters; basePath: string; lockCategory?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function apply(fd: FormData) {
    const params = new URLSearchParams();
    for (const key of ["q", "category", "country", "city", "min", "max", "condition", "sort"]) {
      const v = String(fd.get(key) ?? "").trim();
      if (v && !(lockCategory && key === "category")) params.set(key, v);
    }
    setOpen(false);
    router.push(`${basePath}${params.size ? `?${params}` : ""}`);
  }

  const form = (
    <form action={apply} className="space-y-5" key={JSON.stringify(filters)}>
      <div>
        <label className="label" htmlFor="f-q">Keywords</label>
        <input id="f-q" name="q" defaultValue={filters.q} className="input" placeholder="e.g. Hilux, 3 bedroom" />
      </div>
      {!lockCategory && (
        <div>
          <label className="label" htmlFor="f-category">Category</label>
          <select id="f-category" name="category" defaultValue={filters.category ?? ""} className="input">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="label" htmlFor="f-country">Country</label>
        <select id="f-country" name="country" defaultValue={filters.country ?? ""} className="input">
          <option value="">All Pacific</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="f-city">Town / city</label>
        <input id="f-city" name="city" defaultValue={filters.city} className="input" placeholder="e.g. Suva, Apia" />
      </div>
      <div>
        <span className="label">Price</span>
        <div className="flex items-center gap-2">
          <input name="min" type="number" min={0} inputMode="numeric" defaultValue={filters.min} className="input" placeholder="Min" aria-label="Minimum price" />
          <span className="text-slate-400">–</span>
          <input name="max" type="number" min={0} inputMode="numeric" defaultValue={filters.max} className="input" placeholder="Max" aria-label="Maximum price" />
        </div>
      </div>
      <div>
        <span className="label">Condition</span>
        <div className="grid grid-cols-3 gap-2">
          {[["", "Any"], ["new", "New"], ["used", "Used"]].map(([v, l]) => (
            <label key={v} className="cursor-pointer">
              <input type="radio" name="condition" value={v} defaultChecked={(filters.condition ?? "") === v} className="peer sr-only" />
              <span className="block rounded-xl border border-slate-200 bg-white py-2 text-center text-sm font-medium text-slate-600 peer-checked:border-lagoon-500 peer-checked:bg-lagoon-50 peer-checked:text-lagoon-700 peer-focus-visible:ring-2 peer-focus-visible:ring-lagoon-400">
                {l}
              </span>
            </label>
          ))}
        </div>
      </div>
      <input type="hidden" name="sort" defaultValue={filters.sort} />
      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-primary flex-1">Show results</button>
        <button type="button" onClick={() => { setOpen(false); router.push(basePath); }} className="btn-secondary">
          Reset
        </button>
      </div>
    </form>
  );

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary lg:hidden">
        <SlidersHorizontal className="h-4 w-4" /> Filters
      </button>
      <aside className="card hidden h-fit p-5 lg:sticky lg:top-24 lg:block">
        <h2 className="mb-4 font-bold text-slate-900">Filters</h2>
        {form}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Filters</h2>
              <button onClick={() => setOpen(false)} className="btn-ghost p-2" aria-label="Close filters">
                <X className="h-5 w-5" />
              </button>
            </div>
            {form}
          </div>
        </div>
      )}
    </>
  );
}

export function SortSelect({ value }: { value?: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-slate-500">
      <span className="hidden sm:inline">Sort</span>
      <select
        value={value ?? ""}
        onChange={(e) => {
          const url = new URL(window.location.href);
          if (e.target.value) url.searchParams.set("sort", e.target.value);
          else url.searchParams.delete("sort");
          url.searchParams.delete("page");
          router.push(url.pathname + url.search);
        }}
        className="rounded-xl border border-slate-200 bg-white py-2 pr-8 pl-3 text-sm font-medium text-slate-700"
      >
        <option value="">Newest first</option>
        <option value="price_asc">Price: low to high</option>
        <option value="price_desc">Price: high to low</option>
        <option value="oldest">Oldest first</option>
      </select>
    </label>
  );
}
