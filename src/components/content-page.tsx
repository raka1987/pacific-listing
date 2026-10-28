export function ContentPage({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="bg-ocean-900">
        <div className="container-page max-w-3xl py-12 sm:py-16">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{title}</h1>
          {intro && <p className="mt-3 text-lg text-slate-300">{intro}</p>}
        </div>
      </div>
      <div className="container-page max-w-3xl py-10">{children}</div>
    </div>
  );
}
