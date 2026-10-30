import Link from "next/link";

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="container-page flex justify-center py-10 sm:py-16">
      <div className="w-full max-w-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="mx-auto mb-6 h-14 w-14 rounded-2xl shadow-lg shadow-lagoon-600/20" />
        <div className="card p-6 sm:p-10">
          <h1 className="font-display text-3xl font-semibold text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-sm text-ink-2">{footer}</div>}
      </div>
    </div>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-lagoon-700 hover:underline">
      {children}
    </Link>
  );
}

export function FormMessage({ error, message }: { error?: string; message?: string }) {
  if (error) return <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>;
  if (message) return <p className="rounded-xl bg-lagoon-50 p-3 text-sm text-lagoon-800" role="status">{message}</p>;
  return null;
}
