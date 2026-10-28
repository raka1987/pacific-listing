import Link from "next/link";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Pacific Listing home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-mark.svg" alt="" width={36} height={36} className="h-9 w-9" />
      <span className="leading-none">
        <span className={`block text-[17px] font-extrabold tracking-tight ${light ? "text-white" : "text-ocean-900"}`}>
          Pacific
        </span>
        <span className={`block text-[11px] font-semibold uppercase tracking-[0.2em] ${light ? "text-lagoon-200" : "text-lagoon-600"}`}>
          Listing
        </span>
      </span>
    </Link>
  );
}
