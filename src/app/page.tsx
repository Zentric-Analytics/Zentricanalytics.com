import Link from 'next/link';
import { BrainCircuit, ChartColumn, CloudCog, CodeXml, Cpu, FlaskConical, type LucideIcon } from 'lucide-react';
import { PageShell } from '@/components/PageShell';

const capabilities: Array<{ Icon: LucideIcon; title: string; description: string; featured?: boolean }> = [
  {
    Icon: CodeXml,
    title: 'Software Engineering',
    description:
      'Reliable software systems built for performance, scalability, security, and long-term maintainability.',
    featured: true,
  },
  {
    Icon: BrainCircuit,
    title: 'Artificial Intelligence',
    description:
      'Applied AI solutions that improve decision-making, automate workflows, and create measurable business value.',
  },
  {
    Icon: ChartColumn,
    title: 'Data & Analytics',
    description:
      'Modern analytics platforms that transform data into meaningful insights and informed decisions.',
  },
  {
    Icon: FlaskConical,
    title: 'Research & Innovation',
    description:
      'Research-led exploration of emerging technologies with practical engineering outcomes.',
  },
  {
    Icon: CloudCog,
    title: 'Cloud & Infrastructure',
    description:
      'Secure, resilient, and scalable cloud platforms designed for enterprise environments.',
  },
  {
    Icon: Cpu,
    title: 'Emerging Technologies',
    description:
      'Evaluating, validating, and implementing future-ready technologies responsibly and strategically.',
    featured: true,
  },
];

const industries = [
  {
    title: 'Healthcare',
    description:
      'Reliable digital platforms, secure data systems, and intelligent healthcare technology that improve operational efficiency.',
    icon: (
      <path d="M12 5v14M5 12h14M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z" />
    ),
  },
  {
    title: 'Financial Services',
    description:
      'Modern software, analytics, and secure digital solutions built for financial institutions and business operations.',
    icon: (
      <path d="M4 10h16M6 10v8M10 10v8M14 10v8M18 10v8M5 18h14M12 4 4 8h16l-8-4Z" />
    ),
  },
  {
    title: 'Government & Public Sector',
    description:
      'Scalable digital platforms and technology solutions that support efficient public service delivery.',
    icon: (
      <path d="M4 20h16M6 9h12M7 9v8M11 9v8M15 9v8M17 9v8M12 4 5 8h14l-7-4Z" />
    ),
  },
  {
    title: 'Education',
    description:
      'Modern learning platforms, institutional systems, analytics, and digital transformation for education.',
    icon: (
      <path d="m4 8 8-4 8 4-8 4-8-4ZM7 10v5c0 1.7 2.2 3 5 3s5-1.3 5-3v-5M20 8v6" />
    ),
  },
  {
    title: 'Manufacturing',
    description:
      'Engineering software and intelligent systems that improve operational visibility, automation, and productivity.',
    icon: (
      <path d="M4 19V9l5 3V9l5 3V7h6v12H4ZM8 16h2M13 16h2M18 16h2" />
    ),
  },
  {
    title: 'Logistics & Supply Chain',
    description:
      'Technology solutions that optimize movement, visibility, planning, and operational decision-making.',
    icon: (
      <path d="M3 16h2m14 0h2M7 16a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm6 0h1m1 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM5 16V7h9v9M14 10h3l3 3v3" />
    ),
  },
];

const engineeringProcess = [
  {
    number: '01',
    title: 'Discovery',
    description:
      'Understanding objectives, stakeholders, technical constraints, and project requirements.',
    className: 'lg:col-start-1 lg:row-start-1',
  },
  {
    number: '02',
    title: 'Architecture',
    description:
      'Designing secure, scalable, and maintainable technical foundations before implementation begins.',
    className: 'lg:col-start-2 lg:row-start-2',
  },
  {
    number: '03',
    title: 'Engineering',
    description:
      'Building reliable software using disciplined engineering practices and modern development standards.',
    className: 'lg:col-start-3 lg:row-start-1',
  },
  {
    number: '04',
    title: 'Testing & Quality',
    description:
      'Verifying functionality, security, performance, and reliability before release.',
    className: 'lg:col-start-1 lg:row-start-3',
  },
  {
    number: '05',
    title: 'Deployment',
    description:
      'Delivering production-ready solutions through structured release and deployment practices.',
    className: 'lg:col-start-3 lg:row-start-3',
  },
  {
    number: '06',
    title: 'Continuous Support',
    description:
      'Monitoring, improving, maintaining, and evolving solutions as business needs grow.',
    className: 'lg:col-start-2 lg:row-start-4',
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
      <section className="hero-premium relative isolate flex overflow-hidden bg-[linear-gradient(135deg,#0B1F3A_0%,#173B67_68%,#10B981_100%)] text-white md:min-h-[calc(76svh-80px)] lg:min-h-[calc(78svh-82px)] lg:max-h-[720px]">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_18%,rgba(79,195,247,0.16),transparent_32%),radial-gradient(circle_at_78%_82%,rgba(16,185,129,0.12),transparent_34%),linear-gradient(180deg,rgba(11,31,58,0.06),rgba(11,31,58,0.26))]" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.055] [background-image:radial-gradient(ellipse_at_50%_20%,rgba(255,255,255,0.42),transparent_58%)]" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-b from-transparent to-[#F8FAFC]/18" aria-hidden="true" />
        <div className="mx-auto flex w-full max-w-6xl items-center px-4 py-16 sm:py-[4.5rem] md:py-20 lg:py-[5.5rem]">
          <div className="max-w-[47rem]">
            <p className="hero-reveal hero-reveal-1 mb-5 inline-flex text-xs font-bold uppercase tracking-[0.32em] text-cyan-100/90 sm:mb-6">
              ZENTRIC ANALYTICS
            </p>
            <h1 className="hero-reveal hero-reveal-2 max-w-[46rem] text-[clamp(2.45rem,6.7vw,4.25rem)] font-bold leading-[1.06] tracking-[-0.048em] text-white sm:leading-[1.05]">
              Engineering reliable software, data, and AI systems for serious work.
            </h1>
            <p className="hero-reveal hero-reveal-3 mt-6 max-w-[39rem] text-base leading-8 text-slate-100/90 sm:mt-7 sm:text-lg sm:leading-9">
              Zentric Analytics is a technology company focused on disciplined software delivery, web platforms, artificial intelligence solutions, analytics, computer science research, and emerging technology implementation.
            </p>
            <div className="hero-reveal hero-reveal-4 mt-8 flex flex-col gap-3.5 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <Link className="btn min-h-12 bg-white px-7 py-3.5 text-brand shadow-[0_16px_34px_rgba(5,20,38,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-cyan-50 hover:shadow-[0_18px_38px_rgba(5,20,38,0.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100" href="/services">
                Explore services
              </Link>
              <Link className="btn min-h-12 border border-white/25 bg-white/[0.03] px-7 py-3.5 text-white shadow-[0_12px_28px_rgba(5,20,38,0.14)] transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-100/45 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100" href="/contact">
                Let&apos;s Talk
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="philosophy-section relative isolate overflow-hidden bg-[#F8FAFC] px-4 py-20 sm:px-6 sm:py-24 lg:py-32" aria-labelledby="how-we-think-heading">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.025] [background-image:linear-gradient(rgba(15,23,42,0.95)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.95)_1px,transparent_1px),linear-gradient(45deg,transparent_48%,rgba(16,185,129,0.9)_49%,rgba(16,185,129,0.9)_51%,transparent_52%)] [background-size:56px_56px,56px_56px,168px_168px]" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 bg-gradient-to-b from-white/60 to-transparent" aria-hidden="true" />
        <div className="editorial-reveal editorial-reveal-4 mx-auto max-w-6xl rounded-[1.65rem] border border-[#E5E7EB] bg-white px-7 py-12 text-left shadow-[0_26px_80px_rgba(15,23,42,0.08),0_2px_10px_rgba(15,23,42,0.035)] sm:rounded-[1.75rem] sm:px-11 sm:py-16 lg:px-16 lg:py-20">
          <div className="max-w-4xl">
            <p className="editorial-reveal editorial-reveal-1 text-xs font-bold uppercase tracking-[0.34em] text-[#10B981]">
              HOW WE THINK
            </p>
            <h2
              id="how-we-think-heading"
              className="editorial-reveal editorial-reveal-2 mt-7 max-w-4xl text-[2.05rem] font-bold leading-[1.12] tracking-[-0.045em] text-ink sm:text-[2.8rem] sm:leading-[1.08] md:text-[3.35rem]"
            >
              Engineering isn&apos;t just what we build.
              <br className="hidden sm:block" />
              It&apos;s how we solve problems.
            </h2>
            <p className="editorial-reveal editorial-reveal-3 mt-8 max-w-[46rem] text-base leading-8 text-slate-600 sm:text-lg sm:leading-9">
              Every organization faces unique technology challenges. At Zentric Analytics, we approach each engagement with disciplined engineering, structured thinking, and a commitment to building solutions that remain reliable, secure, and valuable long after deployment.
            </p>
          </div>

          <div className="mt-12 border-t border-slate-200/70 pt-2 sm:mt-14 lg:mt-16">
            <div className="philosophy-row editorial-reveal editorial-reveal-5 border-b border-slate-200/70 px-4 py-7 sm:grid sm:grid-cols-[minmax(11rem,0.76fr)_minmax(0,1.24fr)] sm:gap-10 sm:px-5 sm:py-8 lg:gap-16">
              <h3 className="text-[1.08rem] font-bold tracking-[-0.025em] text-ink sm:text-xl">Engineering First</h3>
              <p className="mt-3 text-base leading-8 text-slate-600 sm:mt-0">
                Every decision begins with architecture, maintainability, scalability, and long-term reliability.
              </p>
            </div>
            <div className="philosophy-row editorial-reveal editorial-reveal-6 border-b border-slate-200/70 px-4 py-7 sm:grid sm:grid-cols-[minmax(11rem,0.76fr)_minmax(0,1.24fr)] sm:gap-10 sm:px-5 sm:py-8 lg:gap-16">
              <h3 className="text-[1.08rem] font-bold tracking-[-0.025em] text-ink sm:text-xl">Technology With Purpose</h3>
              <p className="mt-3 text-base leading-8 text-slate-600 sm:mt-0">
                Artificial intelligence, software, and data are applied where they create measurable value rather than unnecessary complexity.
              </p>
            </div>
            <div className="philosophy-row editorial-reveal editorial-reveal-7 border-b border-slate-200/70 px-4 py-7 sm:grid sm:grid-cols-[minmax(11rem,0.76fr)_minmax(0,1.24fr)] sm:gap-10 sm:px-5 sm:py-8 lg:gap-16">
              <h3 className="text-[1.08rem] font-bold tracking-[-0.025em] text-ink sm:text-xl">Built For Longevity</h3>
              <p className="mt-3 text-base leading-8 text-slate-600 sm:mt-0">
                Solutions are designed to evolve with changing business needs instead of becoming short-term implementations.
              </p>
            </div>
            <div className="philosophy-row editorial-reveal editorial-reveal-8 px-4 py-7 sm:grid sm:grid-cols-[minmax(11rem,0.76fr)_minmax(0,1.24fr)] sm:gap-10 sm:px-5 sm:py-8 lg:gap-16">
              <h3 className="text-[1.08rem] font-bold tracking-[-0.025em] text-ink sm:text-xl">Continuous Innovation</h3>
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
              className="mt-6 max-w-[56rem] text-[2.05rem] font-bold leading-[1.09] tracking-[-0.045em] text-[#111827] sm:text-[2.75rem] sm:leading-[1.07] md:text-[3.25rem]"
            >
              Engineering expertise across software, AI, data, infrastructure, and research.
            </h2>
            <p className="mt-7 max-w-[48rem] text-base leading-8 text-[#475569] sm:text-lg sm:leading-9">
              Zentric Analytics brings together disciplined software engineering, artificial intelligence, data platforms, cloud infrastructure, and research-led innovation to help organizations build technology that is reliable, scalable, and future-ready.
            </p>
          </div>

          <div className="mt-12 grid items-stretch gap-5 md:grid-cols-2 md:gap-6 lg:mt-16 lg:gap-7">
            {capabilities.map((capability) => (
              <article
                className={`core-capability-card group relative flex min-h-full overflow-hidden rounded-[1.375rem] border border-[#E5E7EB] bg-white p-7 shadow-[0_18px_48px_rgba(15,23,42,0.055),0_2px_8px_rgba(15,23,42,0.035)] transition-[border-color,box-shadow,transform] duration-300 ease-out hover:-translate-y-1 hover:border-[#10B981]/55 hover:shadow-[0_24px_60px_rgba(15,23,42,0.095),0_4px_14px_rgba(15,23,42,0.045)] sm:rounded-[1.5rem] sm:p-8 ${
                  capability.featured ? 'md:col-span-2 lg:p-9' : ''
                }`}
                key={capability.title}
              >
                <div className="absolute inset-x-7 top-0 h-[2px] bg-[#10B981]/0 transition-colors duration-300 group-hover:bg-[#10B981]/80 sm:inset-x-8 lg:inset-x-9" />
                <div className={`flex w-full flex-col ${capability.featured ? 'lg:grid lg:grid-cols-[0.72fr_1.28fr] lg:gap-10' : ''}`}>
                  <div>
                    <capability.Icon
                      aria-hidden="true"
                      className="size-6 text-[#0B1F3A] transition-colors duration-200 group-hover:text-[#10B981] sm:size-7"
                      strokeWidth={1.75}
                    />
                    <h3 className="mt-5 text-[1.45rem] font-bold leading-[1.16] tracking-[-0.035em] text-[#111827] sm:text-[1.7rem]">
                      {capability.title}
                    </h3>
                  </div>
                  <div className={`flex flex-1 flex-col ${capability.featured ? 'mt-6 lg:mt-0' : 'mt-5'}`}>
                    <p className="max-w-2xl text-[0.98rem] leading-8 text-[#475569] sm:text-base">
                      {capability.description}
                    </p>
                    <Link
                      aria-label={`Learn more about ${capability.title}`}
                      className="mt-7 inline-flex min-h-11 w-fit items-center text-sm font-bold tracking-[-0.01em] text-[#0B1F3A] underline decoration-[#10B981]/0 underline-offset-4 transition-[color,decoration-color] duration-300 group-hover:text-[#047857] group-hover:decoration-[#10B981]/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#10B981]"
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

      <section className="bg-[#F8FAFC] px-4 py-20 sm:px-6 sm:py-24 lg:py-32" aria-labelledby="engineering-process-heading">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-4xl">
            <p className="text-xs font-bold uppercase tracking-[0.34em] text-[#10B981]">
              ENGINEERING PROCESS
            </p>
            <h2
              id="engineering-process-heading"
              className="mt-6 max-w-4xl text-[2.05rem] font-bold leading-[1.08] tracking-[-0.045em] text-[#111827] sm:text-[2.75rem] md:text-[3.25rem]"
            >
              Every successful solution begins with a disciplined engineering process.
            </h2>
            <p className="mt-7 max-w-3xl text-base leading-8 text-[#475569] sm:text-lg sm:leading-9">
              Every engagement follows a structured workflow designed to reduce risk, improve collaboration, and deliver technology that remains reliable, maintainable, and scalable over time.
            </p>
          </div>

          <div className="mt-12 rounded-[2rem] border border-[#D1D5DB]/75 bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.07)] sm:p-8 lg:mt-16 lg:p-10">
            <div className="relative overflow-hidden rounded-[1.5rem] border border-[#173B67]/10 bg-[#F8FAFC] p-5 sm:p-7 lg:p-10">
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-[0.42] [background-image:linear-gradient(rgba(23,59,103,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(23,59,103,0.08)_1px,transparent_1px)] [background-size:32px_32px]"
              />
              <div aria-hidden="true" className="absolute inset-x-8 top-8 hidden h-px bg-[#10B981]/25 lg:block" />
              <div aria-hidden="true" className="absolute inset-y-8 left-8 hidden w-px bg-[#4FC3F7]/25 lg:block" />

              <div className="engineering-blueprint relative mx-auto max-w-5xl lg:min-h-[46rem]">
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible lg:block"
                  fill="none"
                  preserveAspectRatio="none"
                  viewBox="0 0 1000 736"
                >
                  <path className="blueprint-path" d="M175 112 C240 160 290 205 365 265" />
                  <path className="blueprint-path" d="M480 255 C575 188 660 144 820 112" />
                  <path className="blueprint-path" d="M438 350 C350 424 260 486 176 527" />
                  <path className="blueprint-path" d="M490 350 C585 432 688 488 822 527" />
                  <path className="blueprint-path" d="M741 590 C650 642 570 670 500 672" />
                  <path className="blueprint-path blueprint-path-secondary" d="M175 590 C255 654 352 682 500 672" />
                  {[ [175,112], [365,265], [820,112], [176,527], [822,527], [500,672] ].map(([cx, cy]) => (
                    <circle className="blueprint-joint" cx={cx} cy={cy} key={`${cx}-${cy}`} r="6" />
                  ))}
                </svg>

                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-[auto_auto_auto_auto] lg:gap-x-10 lg:gap-y-12">
                  {engineeringProcess.map((step) => (
                    <article
                      className={`group relative z-10 rounded-[1.35rem] border border-[#173B67]/15 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-[#10B981]/55 hover:shadow-[0_26px_60px_rgba(15,23,42,0.11)] focus-within:-translate-y-1 focus-within:border-[#10B981]/55 sm:p-7 ${step.className}`}
                      key={step.number}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm font-bold tracking-[0.28em] text-[#10B981] transition duration-300 group-hover:text-[#0B1F3A]">
                          {step.number}
                        </span>
                        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border border-[#10B981]/55 bg-[#10B981]/20 shadow-[0_0_0_5px_rgba(16,185,129,0.08)]" />
                      </div>
                      <h3 className="mt-5 text-xl font-bold tracking-[-0.03em] text-[#0B1F3A] sm:text-2xl">
                        {step.title}
                      </h3>
                      <p className="mt-4 text-sm leading-7 text-[#475569] sm:text-base sm:leading-8">
                        {step.description}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-20 sm:px-6 sm:py-24 lg:py-32" aria-labelledby="industries-heading">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-4xl">
            <p className="text-xs font-bold uppercase tracking-[0.34em] text-[#10B981]">
              INDUSTRIES WE SERVE
            </p>
            <h2
              id="industries-heading"
              className="mt-6 max-w-4xl text-[2.05rem] font-bold leading-[1.08] tracking-[-0.045em] text-[#111827] sm:text-[2.75rem] md:text-[3.25rem]"
            >
              Engineering technology for organizations across critical industries.
            </h2>
            <p className="mt-7 max-w-3xl text-base leading-8 text-[#475569] sm:text-lg sm:leading-9">
              Every industry has unique operational, regulatory, and technical challenges. Zentric Analytics applies disciplined engineering, artificial intelligence, data platforms, and modern software solutions to help organizations build reliable, scalable, and future-ready technology.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:gap-6 md:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-7">
            {industries.map((industry) => (
              <article
                className="group rounded-[1.35rem] border border-[#D1D5DB]/80 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:border-[#10B981]/50 hover:shadow-[0_26px_64px_rgba(15,23,42,0.11)] focus-within:-translate-y-1 focus-within:border-[#10B981]/50 sm:p-7"
                key={industry.title}
              >
                <div
                  aria-hidden="true"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#173B67]/10 bg-[#F8FAFC] text-[#173B67] transition duration-300 group-hover:border-[#10B981]/35 group-hover:bg-[#10B981]/[0.08] group-hover:text-[#10B981]"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.7"
                    viewBox="0 0 24 24"
                  >
                    {industry.icon}
                  </svg>
                </div>
                <h3 className="mt-6 text-xl font-bold tracking-[-0.03em] text-[#111827] sm:text-2xl">
                  {industry.title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-[#475569] sm:text-base sm:leading-8">
                  {industry.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className="relative isolate overflow-hidden border-b border-white/10 bg-[#0B1F3A] px-4 py-32 sm:px-6 sm:py-36 lg:py-44"
        aria-labelledby="final-cta-heading"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_12%,rgba(16,185,129,0.22),transparent_34%),radial-gradient(circle_at_50%_80%,rgba(255,255,255,0.10),transparent_42%),linear-gradient(180deg,rgba(11,31,58,0.94),#0B1F3A)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.72)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.72)_1px,transparent_1px)] [background-size:44px_44px]"
        />
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-10 -z-10 h-56 w-[38rem] -translate-x-1/2 rounded-full bg-white/10 blur-3xl"
        />
        <div className="editorial-reveal mx-auto flex max-w-3xl flex-col items-center text-center">
          <p className="text-xs font-bold uppercase tracking-[0.34em] text-[#10B981]">
            READY TO BUILD?
          </p>
          <h2
            id="final-cta-heading"
            className="mt-6 text-[2.15rem] font-bold leading-[1.08] tracking-[-0.045em] text-white sm:text-[2.85rem] md:text-[3.35rem]"
          >
            Let&apos;s build technology that lasts.
          </h2>
          <p className="mt-7 max-w-2xl text-base leading-8 text-white/[0.82] sm:text-lg sm:leading-9">
            Whether you&apos;re planning a new platform, modernizing existing systems, exploring artificial intelligence, or developing a research-led technology initiative, Zentric Analytics can help you move from idea to reliable execution.
          </p>
          <Link
            className="btn mt-10 min-h-12 bg-white px-8 py-3.5 text-[#0B1F3A] shadow-[0_18px_44px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_24px_58px_rgba(0,0,0,0.34)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#10B981]"
            href="/contact"
          >
            Let&apos;s Talk
          </Link>
        </div>
      </section>

    </PageShell>
  );
}
