export function Section({ eyebrow, title, children }: { eyebrow?: string; title: string; children: React.ReactNode }) {
  return (
    <section className="za-container za-section-compact">
      {eyebrow && <p className="za-eyebrow mb-3 min-w-0 break-words">{eyebrow}</p>}
      <h1 className="za-page-heading mb-5 max-w-3xl break-words text-ink">{title}</h1>
      <div className="za-body min-w-0 break-words text-text-secondary">{children}</div>
    </section>
  );
}
