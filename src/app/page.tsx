import Link from 'next/link';
import { PageShell } from '@/components/PageShell';

const capabilities = [
  {
    number: '01',
    title: 'Software Engineering',
    description:
      'Reliable software systems built for performance, scalability, security, and long-term maintainability.',
    featured: true,
  },
  {
    number: '02',
    title: 'Artificial Intelligence',
    description:
      'Applied AI solutions that improve decision-making, automate workflows, and create measurable business value.',
  },
  {
    number: '03',
    title: 'Data & Analytics',
    description:
      'Modern analytics platforms that transform data into meaningful insights and informed decisions.',
  },
  {
    number: '04',
    title: 'Research & Innovation',
    description:
      'Research-led exploration of emerging technologies with practical engineering outcomes.',
  },
  {
    number: '05',
    title: 'Cloud & Infrastructure',
    description:
      'Secure, resilient, and scalable cloud platforms designed for enterprise environments.',
  },
  {
    number: '06',
    title: 'Emerging Technologies',
    description:
      'Evaluating, validating, and implementing future-ready technologies responsibly and strategically.',
    featured: true,
  },
];

const trustPrinciples = [
  {
    number: '01',
    title: 'Disciplined Engineering',
    description:
      'Every engagement begins with structured planning, thoughtful architecture, and implementation practices designed for reliability.',
  },
  {
    number: '02',
    title: 'Security by Design',
    description:
      'Security, privacy, and operational resilience are considered throughout the development lifecycle, not added at the end.',
  },
  {
    number: '03',
    title: 'Long-Term Maintainability',
    description:
      'Solutions are designed to evolve with changing business requirements instead of becoming short-term technical debt.',
  },
  {
    number: '04',
    title: 'Transparent Collaboration',
    description:
      'Clear communication, measurable milestones, and shared visibility keep teams aligned from discovery through delivery.',
  },
  {
    number: '05',
    title: 'Research-Driven Innovation',
    description:
      'Emerging technologies are evaluated carefully and applied only where they create practical, measurable value.',
  },
  {
    number: '06',
    title: 'Quality Without Compromise',
    description:
      'Testing, review, documentation, and continuous improvement are treated as core parts of engineering delivery.',
  },
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

      <section className="bg-white px-4 py-20 sm:px-6 sm:py-24 lg:py-32" aria-labelledby="core-capabilities-heading">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-4xl">
            <p className="text-xs font-bold uppercase tracking-[0.34em] text-[#10B981]">
              CORE CAPABILITIES
            </p>
            <h2
              id="core-capabilities-heading"
              className="mt-6 max-w-4xl text-[2.05rem] font-bold leading-[1.08] tracking-[-0.045em] text-[#111827] sm:text-[2.75rem] md:text-[3.25rem]"
            >
              Engineering expertise across software, AI, data, infrastructure, and research.
            </h2>
            <p className="mt-7 max-w-3xl text-base leading-8 text-[#475569] sm:text-lg sm:leading-9">
              Zentric Analytics brings together disciplined software engineering, artificial intelligence, data platforms, cloud infrastructure, and research-led innovation to help organizations build technology that is reliable, scalable, and future-ready.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:mt-16 lg:gap-8">
            {capabilities.map((capability) => (
              <article
                className={`group relative overflow-hidden rounded-[1.5rem] border border-[#D1D5DB]/80 bg-white p-7 shadow-[0_20px_55px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-1.5 hover:border-[#10B981]/45 hover:shadow-[0_28px_70px_rgba(15,23,42,0.12)] sm:p-8 ${
                  capability.featured ? 'md:col-span-2 lg:p-10' : ''
                }`}
                key={capability.number}
              >
                <div className="absolute inset-x-7 top-0 h-px bg-[#10B981]/30 opacity-60 transition-opacity duration-300 group-hover:opacity-100 sm:inset-x-8 lg:inset-x-10" />
                <div className={capability.featured ? 'lg:grid lg:grid-cols-[0.7fr_1.3fr] lg:gap-12' : ''}>
                  <div>
                    <p className="text-sm font-bold tracking-[0.28em] text-[#10B981]">
                      {capability.number}
                    </p>
                    <h3 className="mt-6 text-2xl font-bold tracking-[-0.035em] text-[#111827] sm:text-3xl">
                      {capability.title}
                    </h3>
                  </div>
                  <div className={capability.featured ? 'mt-6 lg:mt-0' : 'mt-5'}>
                    <p className="max-w-2xl text-base leading-8 text-[#475569] sm:text-lg sm:leading-9">
                      {capability.description}
                    </p>
                    <Link
                      aria-label={`Learn more about ${capability.title}`}
                      className="mt-8 inline-flex text-sm font-bold tracking-[-0.01em] text-[#0B1F3A] transition duration-300 group-hover:translate-x-1 group-hover:text-[#10B981] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#10B981]"
                      href="/services"
                    >
                      Learn More →
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F8FAFC] px-4 py-20 sm:px-6 sm:py-24 lg:py-32" aria-labelledby="why-choose-heading">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-4xl">
            <p className="text-xs font-bold uppercase tracking-[0.34em] text-[#10B981]">
              WHY CHOOSE ZENTRIC ANALYTICS
            </p>
            <h2
              id="why-choose-heading"
              className="mt-6 max-w-4xl text-[2.05rem] font-bold leading-[1.08] tracking-[-0.045em] text-[#111827] sm:text-[2.75rem] md:text-[3.25rem]"
            >
              Built for organizations that need technology they can depend on.
            </h2>
            <p className="mt-7 max-w-3xl text-base leading-8 text-[#475569] sm:text-lg sm:leading-9">
              Zentric Analytics combines disciplined engineering, responsible technology adoption, and long-term architectural thinking to help organizations build systems that remain reliable beyond launch.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:mt-16 lg:gap-8">
            {trustPrinciples.map((principle) => (
              <article
                className="group relative overflow-hidden rounded-[1.75rem] border border-[#D1D5DB]/80 bg-white p-7 shadow-[0_20px_55px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:border-[#10B981]/45 hover:shadow-[0_30px_75px_rgba(15,23,42,0.11)] sm:p-8 lg:p-9"
                key={principle.number}
              >
                <div className="absolute inset-x-7 top-0 h-px bg-[#10B981]/25 opacity-60 transition-opacity duration-300 group-hover:opacity-100 sm:inset-x-8 lg:inset-x-9" />
                <div className="flex items-start gap-5">
                  <div
                    aria-hidden="true"
                    className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#10B981]/20 bg-[#10B981]/[0.07] text-sm font-bold tracking-[0.16em] text-[#10B981] transition duration-300 group-hover:border-[#10B981]/45 group-hover:bg-[#10B981]/10"
                  >
                    {principle.number}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-[-0.03em] text-[#111827] sm:text-2xl">
                      {principle.title}
                    </h3>
                    <p className="mt-4 text-base leading-8 text-[#475569]">
                      {principle.description}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

    </PageShell>
  );
}
