export function ContentPage({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="container-page max-w-3xl pt-10 sm:pt-16">
        <h1 className="font-display max-w-2xl text-4xl font-semibold text-ink sm:text-5xl">{title}</h1>
        {intro && <p className="mt-4 max-w-xl text-lg text-muted">{intro}</p>}
        <div className="mt-8 border-t border-line" />
      </div>
      <div className="container-page max-w-3xl py-8">{children}</div>
    </div>
  );
}
