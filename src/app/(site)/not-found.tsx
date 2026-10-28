import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-lagoon-50 text-lagoon-600">
        <Compass className="h-8 w-8" />
      </span>
      <h1 className="mt-5 text-3xl font-extrabold text-ocean-900">Lost at sea</h1>
      <p className="mt-2 max-w-md text-slate-500">This page doesn&apos;t exist, or the ad has been removed by the seller.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="btn-primary">Go home</Link>
        <Link href="/search" className="btn-secondary">Browse listings</Link>
      </div>
    </div>
  );
}
