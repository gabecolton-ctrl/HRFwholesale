export function Prose({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <section className="container-x max-w-3xl py-12 sm:py-16">
      <h1 className="h-display text-4xl font-semibold sm:text-5xl">{title}</h1>
      {updated && <p className="mt-2 text-sm text-muted">Last updated {updated}</p>}
      <div className="mt-8 space-y-5 leading-relaxed text-ink-soft [&_h2]:h-display [&_h2]:pt-4 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink">
        {children}
      </div>
    </section>
  );
}
