export function Section({ eyebrow, title, children }: { eyebrow?: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-6xl min-w-0 px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
      {eyebrow && <p className="mb-3 min-w-0 break-words text-base font-bold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>}
      <h1 className="mb-5 max-w-3xl break-words text-3xl font-bold tracking-tight text-ink sm:text-4xl md:text-5xl">{title}</h1>
      <div className="min-w-0 break-words text-slate-700">{children}</div>
    </section>
  );
}
