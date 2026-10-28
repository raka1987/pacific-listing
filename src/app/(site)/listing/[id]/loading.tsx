export default function Loading() {
  return (
    <div className="container-page pt-4 sm:py-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
        <div className="space-y-6">
          <div className="skeleton aspect-[4/3] rounded-3xl" />
          <div className="skeleton h-64 rounded-3xl" />
        </div>
        <div className="skeleton h-80 rounded-3xl" />
      </div>
    </div>
  );
}
