import Link from 'next/link';
import { PageShell } from '@/components/PageShell';
import { Section } from '@/components/Section';

const focus = [
  'Software Development',
  'Web Development',
  'Artificial Intelligence Solutions',
  'Data Analytics',
  'Computer Science R&D',
  'Emerging Technologies',
];

export default function Home() {
  return (
    <PageShell>
      <section className="relative isolate overflow-hidden bg-[linear-gradient(135deg,#0B1F3A_0%,#173B67_64%,#0f766e_100%)] text-white">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:py-28 lg:py-36">
          <div className="max-w-[46rem]">
            <p className="mb-8 inline-flex text-xs font-bold uppercase tracking-[0.32em] text-cyan-100/90 sm:mb-9">
              ZENTRIC ANALYTICS
            </p>
            <h1 className="max-w-[44rem] text-[2.5rem] font-bold leading-[1.04] tracking-[-0.043em] text-white sm:text-[3.25rem] sm:leading-[1.02] md:text-[3.75rem] lg:text-[4rem]">
              Engineering reliable software, data, and AI systems for serious work.
            </h1>
            <p className="mt-9 max-w-[38rem] text-base leading-8 text-slate-200 sm:mt-10 sm:text-lg sm:leading-9">
              Zentric Analytics is a technology company focused on disciplined software delivery, web platforms, artificial intelligence solutions, analytics, computer science research, and emerging technology implementation.
            </p>
            <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
              <Link className="btn min-h-12 bg-white px-8 py-3.5 text-brand shadow-xl shadow-cyan-950/20 transition hover:-translate-y-0.5 hover:bg-cyan-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100" href="/services">
                Explore services
              </Link>
              <Link className="btn min-h-12 border border-white/25 bg-transparent px-8 py-3.5 text-white transition hover:-translate-y-0.5 hover:border-cyan-100/45 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100" href="/contact">
                Let&apos;s Talk
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#F8FAFC] px-4 py-20 sm:px-6 sm:py-24 lg:py-32" aria-labelledby="how-we-think-heading">
        <div className="editorial-reveal mx-auto max-w-6xl rounded-[2rem] border border-slate-200/80 bg-white px-6 py-10 text-left shadow-[0_24px_70px_rgba(15,23,42,0.07)] sm:px-10 sm:py-14 lg:px-16 lg:py-18">
          <div className="max-w-4xl">
            <p className="text-xs font-bold uppercase tracking-[0.34em] text-[#10B981]">
              HOW WE THINK
            </p>
            <h2
              id="how-we-think-heading"
              className="mt-6 max-w-4xl text-[2.05rem] font-bold leading-[1.08] tracking-[-0.045em] text-ink sm:text-[2.8rem] md:text-[3.35rem]"
            >
              Engineering isn&apos;t just what we build.
              <br className="hidden sm:block" />
              It&apos;s how we solve problems.
            </h2>
            <p className="mt-7 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg sm:leading-9">
              Every organization faces unique technology challenges. At Zentric Analytics, we approach each engagement with disciplined engineering, structured thinking, and a commitment to building solutions that remain reliable, secure, and valuable long after deployment.
            </p>
          </div>

          <div className="mt-10 border-t border-slate-200/90 sm:mt-12 lg:mt-14">
            <div className="editorial-reveal border-b border-slate-200/90 py-7 sm:grid sm:grid-cols-[minmax(11rem,0.76fr)_minmax(0,1.24fr)] sm:gap-10 sm:py-8 lg:gap-16">
              <h3 className="text-lg font-bold tracking-[-0.02em] text-ink">Engineering First</h3>
              <p className="mt-3 text-base leading-8 text-slate-600 sm:mt-0">
                Every decision begins with architecture, maintainability, scalability, and long-term reliability.
              </p>
            </div>
            <div className="editorial-reveal border-b border-slate-200/90 py-7 sm:grid sm:grid-cols-[minmax(11rem,0.76fr)_minmax(0,1.24fr)] sm:gap-10 sm:py-8 lg:gap-16">
              <h3 className="text-lg font-bold tracking-[-0.02em] text-ink">Technology With Purpose</h3>
              <p className="mt-3 text-base leading-8 text-slate-600 sm:mt-0">
                Artificial intelligence, software, and data are applied where they create measurable value rather than unnecessary complexity.
              </p>
            </div>
            <div className="editorial-reveal border-b border-slate-200/90 py-7 sm:grid sm:grid-cols-[minmax(11rem,0.76fr)_minmax(0,1.24fr)] sm:gap-10 sm:py-8 lg:gap-16">
              <h3 className="text-lg font-bold tracking-[-0.02em] text-ink">Built For Longevity</h3>
              <p className="mt-3 text-base leading-8 text-slate-600 sm:mt-0">
                Solutions are designed to evolve with changing business needs instead of becoming short-term implementations.
              </p>
            </div>
            <div className="editorial-reveal py-7 sm:grid sm:grid-cols-[minmax(11rem,0.76fr)_minmax(0,1.24fr)] sm:gap-10 sm:py-8 lg:gap-16">
              <h3 className="text-lg font-bold tracking-[-0.02em] text-ink">Continuous Innovation</h3>
              <p className="mt-3 text-base leading-8 text-slate-600 sm:mt-0">
                Research, experimentation, and emerging technologies are explored with discipline, practicality, and measurable outcomes.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Section eyebrow="Focus areas" title="Built for technical depth and responsible delivery.">
        <div className="grid gap-4 md:grid-cols-3">
          {focus.map((item) => (
            <div className="card p-6" key={item}>
              <h2 className="font-bold text-ink">{item}</h2>
              <p className="mt-2 text-sm">Structured discovery, implementation, validation, documentation, and maintainable handover practices.</p>
            </div>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}
