"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export type DropdownOption = { value: string; label: string; icon?: React.ReactNode };

/**
 * A styled replacement for <select>: the list follows the site's colours in
 * light and dark mode, and works with mouse, touch and keyboard.
 */
export function Dropdown({
  value,
  onChange,
  options,
  label,
  align = "left",
  className = "",
  buttonClassName = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  /** Read out to screen readers, e.g. "Category" */
  label: string;
  align?: "left" | "right";
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => root.current && !root.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  // Keep the highlighted option in view while moving with the keyboard.
  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function show() {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function choose(i: number) {
    onChange(options[i].value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={`${label}: ${current?.label}`}
        className={`flex w-full min-w-0 items-center gap-2 text-left text-sm font-medium transition focus:outline-none ${buttonClassName}`}
      >
        {current?.icon && <span className="flex shrink-0 items-center">{current.icon}</span>}
        <span className="min-w-0 flex-1 truncate">{current?.label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 opacity-60 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          className={`absolute top-full z-50 mt-2 max-h-80 w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 text-ink shadow-xl shadow-slate-900/10 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {options.map((o, i) => {
            const selected = o.value === value;
            return (
              <li
                key={o.value || "all"}
                id={`${id}-${i}`}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm ${
                  i === active ? "bg-subtle" : ""
                } ${selected ? "font-medium text-ink" : "text-ink-2"}`}
              >
                {o.icon && <span className="flex w-5 shrink-0 justify-center text-muted">{o.icon}</span>}
                <span className="flex-1 truncate">{o.label}</span>
                {selected && <Check className="h-4 w-4 shrink-0 text-lagoon-600" aria-hidden />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
