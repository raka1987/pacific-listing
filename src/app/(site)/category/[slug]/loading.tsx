import { ListingGridSkeleton } from "@/components/listing-card";

export default function Loading() {
  return (
    <div className="container-page py-8">
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="skeleton hidden h-[560px] rounded-3xl lg:block" />
        <div>
          <div className="skeleton mb-2 h-8 w-56 rounded-full" />
          <div className="skeleton mb-6 h-4 w-24 rounded-full" />
          <ListingGridSkeleton />
        </div>
      </div>
    </div>
  );
}
