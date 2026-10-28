import Image from "next/image";
import Link from "next/link";
import { CATEGORIES } from "@/lib/constants";
import { CategoryIcon } from "./category-icon";

export function CategoryTiles({ counts }: { counts: Record<string, number> }) {
  return (
    <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-5 sm:gap-4 sm:overflow-visible sm:px-0">
      {CATEGORIES.map((c, i) => (
        <Link
          key={c.slug}
          href={`/category/${c.slug}`}
          className="group relative aspect-[4/5] w-[38%] shrink-0 snap-start overflow-hidden rounded-3xl bg-subtle sm:aspect-[5/4] sm:w-auto"
        >
          <Image
            src={`/images/cat-${c.slug}.jpg`}
            alt=""
            fill
            sizes="(min-width: 640px) 20vw, 40vw"
            className="object-cover transition duration-700 ease-out group-hover:scale-110"
            priority={i < 5}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ocean-950/85 via-ocean-950/20 to-transparent" />
          <span className={`absolute top-3 left-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 text-slate-800 shadow-sm backdrop-blur`}>
            <CategoryIcon icon={c.icon} className="h-[18px] w-[18px]" />
          </span>
          <span className="absolute inset-x-3 bottom-3">
            <span className="block text-[15px] leading-tight font-bold text-white">{c.name}</span>
            <span className="text-xs text-white/75">{counts[c.slug] ? `${counts[c.slug]} ${counts[c.slug] === 1 ? "ad" : "ads"}` : "Be the first"}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
