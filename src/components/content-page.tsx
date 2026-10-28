export function ContentPage({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="container-page pt-3 sm:pt-6">
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-ocean-900 px-6 py-12 sm:rounded-[2.5rem] sm:px-12 sm:py-16">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_85%_20%,rgba(52,194,182,0.35),transparent_45%),radial-gradient(circle_at_10%_100%,rgba(255,138,107,0.22),transparent_40%)]" />
          <h1 className="font-display max-w-2xl text-3xl font-extrabold text-white sm:text-5xl">{title}</h1>
          {intro && <p className="mt-3 max-w-xl text-lg text-slate-300">{intro}</p>}
        </div>
      </div>
      <div className="container-page max-w-3xl py-10">{children}</div>
    </div>
  );
}
