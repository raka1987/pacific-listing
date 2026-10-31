import Image from "next/image";
import Link from "next/link";
import { CATEGORIES } from "@/lib/constants";

export function CategoryTiles({ country }: { country?: string | null }) {
  return (
    <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-5 sm:gap-x-4 sm:gap-y-6 sm:overflow-visible sm:px-0">
      {CATEGORIES.map((c, i) => (
        <Link key={c.slug} href={`/category/${c.slug}${country ? `?country=${country}` : ""}`} className="group w-[34%] shrink-0 snap-start sm:w-auto">
          <span className="relative block aspect-[4/3] overflow-hidden rounded-2xl bg-subtle">
            <Image
              src={`/images/cat-${c.slug}.jpg`}
              alt=""
              fill
              sizes="(min-width: 640px) 20vw, 35vw"
              className="object-cover transition duration-500 ease-out group-hover:scale-105"
              priority={i < 5}
            />
          </span>
          <span className="mt-2 block text-sm font-medium text-ink">{c.name}</span>
        </Link>
      ))}
    </div>
  );
}
