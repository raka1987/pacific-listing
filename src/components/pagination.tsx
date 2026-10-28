import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  totalPages,
  makeHref,
}: {
  page: number;
  totalPages: number;
  makeHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-10 flex items-center justify-center gap-3" aria-label="Pagination">
      {page > 1 ? (
        <Link href={makeHref(page - 1)} className="btn-secondary">
          <ChevronLeft className="h-4 w-4" /> Previous
        </Link>
      ) : (
        <span className="btn-secondary pointer-events-none opacity-40">
          <ChevronLeft className="h-4 w-4" /> Previous
        </span>
      )}
      <span className="text-sm text-muted">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={makeHref(page + 1)} className="btn-secondary">
          Next <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className="btn-secondary pointer-events-none opacity-40">
          Next <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}
