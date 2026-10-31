import { Star } from "lucide-react";

/** Read-only star rating, e.g. 4.5 → four and a half filled stars. */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-line" style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="text-amber-400" style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** "★★★★☆ 4.2 (12 ratings)" or "No ratings yet". */
export function RatingSummary({ rating, size = 14 }: { rating: { average: number; total: number } | null; size?: number }) {
  if (!rating || !rating.total) return <span className="text-sm text-muted">No ratings yet</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Stars value={Number(rating.average)} size={size} />
      <span className="font-semibold text-ink">{Number(rating.average).toFixed(1)}</span>
      <span className="text-muted">({rating.total} {rating.total === 1 ? "rating" : "ratings"})</span>
    </span>
  );
}
