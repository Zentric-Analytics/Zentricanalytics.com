import { PageShell } from '@/components/PageShell';

type LegalSection = {
  heading: string;
  paragraphs: readonly string[];
};

export function LegalPage({ title, introduction, sections }: { title: string; introduction: string; sections: readonly LegalSection[] }) {
  return (
    <PageShell>
      <section className="bg-[#F7F9FC] px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16" aria-labelledby="legal-page-heading">
        <article className="mx-auto max-w-4xl rounded-[22px] border border-[#DCE3EA] bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)] sm:p-8 lg:p-10">
          <header className="border-b border-[#DCE3EA] pb-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0B7F60]">Legal</p>
            <h1 id="legal-page-heading" className="mt-3 text-[1.82rem] font-bold leading-[1.1] tracking-[-0.045em] text-[#0B1F3A] sm:text-[2.15rem] lg:text-[2.65rem]">{title}</h1>
            <p className="mt-4 text-sm leading-7 text-[#475569] sm:text-[0.9375rem]">Last updated: July 28, 2026</p>
            <p className="mt-4 rounded-xl border border-[#DCE3EA] bg-[#F8FAFC] p-4 text-sm font-semibold leading-6 text-[#294A43]">Placeholder policy — this content must be reviewed and approved by qualified legal counsel before final publication.</p>
            <p className="mt-5 text-sm leading-7 text-[#475569] sm:text-[0.9375rem]">{introduction}</p>
          </header>
          <div className="mt-8 space-y-8">
            {sections.map((section) => (
              <section key={section.heading} aria-labelledby={`legal-${section.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                <h2 id={`legal-${section.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="text-xl font-bold leading-tight tracking-[-0.035em] text-[#0B1F3A] sm:text-2xl">{section.heading}</h2>
                {section.paragraphs.map((paragraph) => <p className="mt-3 text-sm leading-7 text-[#475569] sm:text-[0.9375rem]" key={paragraph}>{paragraph}</p>)}
              </section>
            ))}
          </div>
        </article>
      </section>
    </PageShell>
  );
}
