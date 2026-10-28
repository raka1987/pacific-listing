"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Mode = "light" | "dark" | "system";
const NEXT: Record<Mode, Mode> = { light: "dark", dark: "system", system: "light" };
const LABEL: Record<Mode, string> = { light: "Light mode", dark: "Dark mode", system: "Match device" };

function apply(mode: Mode) {
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    let saved: Mode = "system";
    try {
      saved = (localStorage.getItem("theme") as Mode) || "system";
    } catch {}
    setMode(saved);
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      let current: Mode = "system";
      try {
        current = (localStorage.getItem("theme") as Mode) || "system";
      } catch {}
      if (current === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function cycle() {
    const next = NEXT[mode];
    setMode(next);
    try {
      if (next === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {}
    apply(next);
  }

  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;
  return (
    <button
      onClick={cycle}
      className={`flex h-10 w-10 items-center justify-center rounded-full text-ink-2 transition hover:bg-subtle hover:text-ink ${className}`}
      aria-label={`Theme: ${LABEL[mode]}. Click to change.`}
      title={LABEL[mode]}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}
