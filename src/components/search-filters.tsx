"use client";

import { Globe2, LayoutGrid, SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORIES, categoryBySlug, COUNTRIES } from "@/lib/constants";
import { rememberSearchCountry } from "@/lib/search-country";
import type { SearchFilters } from "@/lib/queries";
import { CategoryIcon } from "./category-icon";
import { Dropdown, type DropdownOption } from "./dropdown";

export function SearchFiltersPanel({ filters, basePath, lockCategory }: { filters: SearchFilters; basePath: string; lockCategory?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function apply(fd: FormData) {
    const params = new URLSearchParams();
    for (const key of ["q", "category", "sub", "country", "city", "min", "max", "condition", "sort"]) {
      const v = String(fd.get(key) ?? "").trim();
      if (v && !(lockCategory && key === "category")) params.set(key, v);
    }
    rememberSearchCountry(String(fd.get("country") ?? ""));
    setOpen(false);
    router.push(`${basePath}${params.size ? `?${params}` : ""}`);
  }

  const form = (
    <form action={apply} className="space-y-5" key={JSON.stringify(filters)}>
      <div>
        <label className="label" htmlFor="f-q">Keywords</label>
        <input id="f-q" name="q" defaultValue={filters.q} className="input" placeholder="e.g. Hilux, 3 bedroom" />
      </div>
      <CategoryAndType lockCategory={lockCategory} initialCategory={filters.category ?? ""} initialSub={filters.sub ?? ""} />
      <div>
        <span className="label">Country</span>
        <FieldDropdown
          name="country"
          label="Country"
          initial={filters.country ?? ""}
          options={[
            { value: "", label: "All Pacific", icon: <Globe2 className="h-4 w-4" /> },
            ...COUNTRIES.map((c) => ({ value: c.code, label: c.name, icon: <span className="text-base leading-none">{c.flag}</span> })),
          ]}
        />
      </div>
      <div>
        <label className="label" htmlFor="f-city">Town / city</label>
        <input id="f-city" name="city" defaultValue={filters.city} className="input" placeholder="e.g. Suva, Apia" />
      </div>
      <div>
        <span className="label">Price</span>
        <div className="flex items-center gap-2">
          <input name="min" type="number" min={0} inputMode="numeric" defaultValue={filters.min} className="input" placeholder="Min" aria-label="Minimum price" />
          <span className="text-faint">–</span>
          <input name="max" type="number" min={0} inputMode="numeric" defaultValue={filters.max} className="input" placeholder="Max" aria-label="Maximum price" />
        </div>
      </div>
      <div>
        <span className="label">Condition</span>
        <div className="grid grid-cols-3 gap-2">
          {[["", "Any"], ["new", "New"], ["used", "Used"]].map(([v, l]) => (
            <label key={v} className="cursor-pointer">
              <input type="radio" name="condition" value={v} defaultChecked={(filters.condition ?? "") === v} className="peer sr-only" />
              <span className="block rounded-xl border border-line bg-surface py-2 text-center text-sm font-medium text-ink-2 peer-checked:border-lagoon-500 peer-checked:bg-lagoon-50 peer-checked:text-lagoon-700 peer-focus-visible:ring-2 peer-focus-visible:ring-lagoon-400">
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
      <button onClick={() => setOpen(true)} className="btn-secondary w-fit lg:hidden">
        <SlidersHorizontal className="h-4 w-4" /> Filters
      </button>
      <aside className="card hidden h-fit p-6 lg:sticky lg:top-24 lg:block">
        <h2 className="mb-4 font-bold text-ink">Filters</h2>
        {form}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[2rem] bg-surface p-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
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
    <label className="flex items-center gap-2 text-sm text-muted">
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
        className="rounded-full border border-line bg-surface py-2 pr-8 pl-4 text-sm font-medium text-ink-2"
      >
        <option value="">Newest first</option>
        <option value="price_asc">Price: low to high</option>
        <option value="price_desc">Price: high to low</option>
        <option value="oldest">Oldest first</option>
      </select>
    </label>
  );
}

/** Category, then the types within it (e.g. Property > For rent). */
function CategoryAndType({ lockCategory, initialCategory, initialSub }: { lockCategory?: boolean; initialCategory: string; initialSub: string }) {
  const [category, setCategory] = useState(initialCategory);
  const [sub, setSub] = useState(initialSub);
  const cat = categoryBySlug(category);
  const field = "rounded-xl border border-line bg-surface px-3.5 transition focus-within:border-lagoon-500 focus-within:ring-4 focus-within:ring-lagoon-500/10";
  return (
    <>
      {!lockCategory && (
        <div>
          <span className="label">Category</span>
          <input type="hidden" name="category" value={category} />
          <Dropdown
            label="Category"
            value={category}
            onChange={(v) => {
              setCategory(v);
              setSub("");
            }}
            options={[
              { value: "", label: "All categories", icon: <LayoutGrid className="h-4 w-4" /> },
              ...CATEGORIES.map((c) => ({ value: c.slug, label: c.name, icon: <CategoryIcon icon={c.icon} className="h-4 w-4" /> })),
            ]}
            className={field}
            buttonClassName="py-2.5 font-normal text-ink"
          />
        </div>
      )}
      {cat && cat.subcategories.length > 0 && (
        <div>
          <span className="label">Type</span>
          <input type="hidden" name="sub" value={sub} />
          <Dropdown
            label="Type"
            value={sub}
            onChange={setSub}
            options={[{ value: "", label: `All ${cat.name.toLowerCase()}` }, ...cat.subcategories.map((x) => ({ value: x.slug, label: x.name }))]}
            className={field}
            buttonClassName="py-2.5 font-normal text-ink"
          />
        </div>
      )}
    </>
  );
}

/** A dropdown that submits with its form, like a <select name="...">. */
function FieldDropdown({ name, label, initial, options }: { name: string; label: string; initial: string; options: DropdownOption[] }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Dropdown
        label={label}
        value={value}
        onChange={setValue}
        options={options}
        className="rounded-xl border border-line bg-surface px-3.5 transition focus-within:border-lagoon-500 focus-within:ring-4 focus-within:ring-lagoon-500/10"
        buttonClassName="py-2.5 font-normal text-ink"
      />
    </>
  );
}
