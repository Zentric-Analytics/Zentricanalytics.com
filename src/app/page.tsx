import Link from 'next/link';
import { BadgeCheck, Braces, BrainCircuit, Building2, ChartColumn, CloudCog, CodeXml, Cpu, Factory, FlaskConical, GraduationCap, HeartPulse, Landmark, LifeBuoy, LockKeyhole, MessagesSquare, Microscope, Network, Rocket, Search, ShieldCheck, Truck, Wrench, type LucideIcon } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { SectionHeader } from '@/components/SectionHeader';
import { DesignSystemCard } from '@/components/DesignSystemCard';

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

const industries: Array<{ Icon: LucideIcon; title: string; description: string }> = [
  {
    title: 'Healthcare',
    description:
      'Reliable digital platforms, secure data systems, and intelligent healthcare technology that improve operational efficiency.',
    Icon: HeartPulse,
  },
  {
    title: 'Financial Services',
    description:
      'Modern software, analytics, and secure digital solutions built for financial institutions and business operations.',
    Icon: Landmark,
  },
  {
    title: 'Government & Public Sector',
    description:
      'Scalable digital platforms and technology solutions that support efficient public service delivery.',
    Icon: Building2,
  },
  {
    title: 'Education',
    description:
      'Modern learning platforms, institutional systems, analytics, and digital transformation for education.',
    Icon: GraduationCap,
  },
  {
    title: 'Manufacturing',
    description:
      'Engineering software and intelligent systems that improve operational visibility, automation, and productivity.',
    Icon: Factory,
  },
  {
    title: 'Logistics & Supply Chain',
    description:
      'Technology solutions that optimize movement, visibility, planning, and operational decision-making.',
    Icon: Truck,
  },
];

const engineeringProcess = [
  {
    Icon: Search,
    title: 'Discovery',
    description:
      'Understanding objectives, stakeholders, technical constraints, and project requirements.',
  },
  {
    Icon: Network,
    title: 'Architecture',
    description:
      'Designing secure, scalable, and maintainable technical foundations before implementation begins.',
  },
  {
    Icon: Braces,
    title: 'Engineering',
    description:
      'Building reliable software using disciplined engineering practices and modern development standards.',
  },
  {
    Icon: ShieldCheck,
    title: 'Testing & Quality',
    description:
      'Verifying functionality, security, performance, and reliability before release.',
  },
  {
    Icon: Rocket,
    title: 'Deployment',
    description:
      'Delivering production-ready solutions through structured release and deployment practices.',
  },
  {
    Icon: LifeBuoy,
    title: 'Continuous Support',
    description:
      'Monitoring, improving, maintaining, and evolving solutions as business needs grow.',
  },
];

const trustPrinciples: Array<{ Icon: LucideIcon; number: string; title: string; description: string }> = [
  {
    Icon: Wrench,
    number: '01',
    title: 'Disciplined Engineering',
    description:
      'Every engagement begins with structured planning, thoughtful architecture, and implementation practices designed for reliability.',
  },
  {
    Icon: ShieldCheck,
    number: '02',
    title: 'Security by Design',
    description:
      'Security, privacy, and operational resilience are considered throughout the development lifecycle, not added at the end.',
  },
  {
    Icon: LockKeyhole,
    number: '03',
    title: 'Long-Term Maintainability',
    description:
      'Solutions are designed to evolve with changing business requirements instead of becoming short-term technical debt.',
  },
  {
    Icon: MessagesSquare,
    number: '04',
    title: 'Transparent Collaboration',
    description:
      'Clear communication, measurable milestones, and shared visibility keep teams aligned from discovery through delivery.',
  },
  {
    Icon: Microscope,
    number: '05',
    title: 'Research-Driven Innovation',
    description:
      'Emerging technologies are evaluated carefully and applied only where they create practical, measurable value.',
  },
  {
    Icon: BadgeCheck,
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
              <Link className="btn hero-cta-primary" href="/services">
                Explore services
              </Link>
              <Link className="btn hero-cta-secondary" href="/contact">
                Let&apos;s Talk
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="philosophy-section relative isolate overflow-hidden bg-white px-4 py-16 sm:px-6 sm:py-20 lg:py-28" aria-labelledby="how-we-think-heading">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.025] [background-image:linear-gradient(rgba(15,23,42,0.95)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.95)_1px,transparent_1px),linear-gradient(45deg,transparent_48%,rgba(16,185,129,0.9)_49%,rgba(16,185,129,0.9)_51%,transparent_52%)] [background-size:56px_56px,56px_56px,168px_168px]" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 bg-gradient-to-b from-white/60 to-transparent" aria-hidden="true" />
        <div className="editorial-reveal editorial-reveal-4 mx-auto max-w-6xl rounded-[1.65rem] border border-[#E5E7EB] bg-white px-7 py-12 text-left shadow-[0_26px_80px_rgba(15,23,42,0.08),0_2px_10px_rgba(15,23,42,0.035)] sm:rounded-[1.75rem] sm:px-11 sm:py-16 lg:px-16 lg:py-20">
          <SectionHeader
            className="editorial-reveal editorial-reveal-1"
            eyebrow="HOW WE THINK"
            heading={<>Engineering isn&apos;t just what we build. It&apos;s how we solve problems.</>}
            headingId="how-we-think-heading"
            description="Every organization faces unique technology challenges. At Zentric Analytics, we approach each engagement with disciplined engineering, structured thinking, and a commitment to building solutions that remain reliable, secure, and valuable long after deployment."
          />

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

      <section className="bg-[#F8FAFC] px-4 py-16 sm:px-6 sm:py-20 lg:py-28" aria-labelledby="core-capabilities-heading">
        <div className="mx-auto max-w-6xl">
          <SectionHeader
            eyebrow="CORE CAPABILITIES"
            heading="Engineering expertise across software, AI, data, infrastructure, and research."
            headingId="core-capabilities-heading"
            description="Zentric Analytics brings together disciplined software engineering, artificial intelligence, data platforms, cloud infrastructure, and research-led innovation to help organizations build technology that is reliable, scalable, and future-ready."
          />

          <div className="mt-12 grid items-stretch gap-6 md:grid-cols-2 lg:mt-14 lg:gap-7">
            {capabilities.map((capability) => (
              <DesignSystemCard
                as={Link}
                className={`core-capability-card ${capability.featured ? 'md:col-span-2' : ''}`}
                href="/services"
                interactive
                key={capability.title}
                variant={capability.featured ? 'featured' : 'capability'}
              >
                <div className={`flex h-full w-full flex-col ${capability.featured ? 'lg:grid lg:grid-cols-[0.72fr_1.28fr] lg:gap-10' : ''}`}>
                  <div>
                    <capability.Icon
                      aria-hidden="true"
                      className="size-6 text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981] group-focus-visible:text-[#10B981] sm:size-7"
                      strokeWidth={1.75}
                    />
                    <h3 className="mt-6 text-[1.375rem] font-bold leading-[1.18] tracking-[-0.03em] text-[#111827] sm:text-[1.55rem]">
                      {capability.title}
                    </h3>
                  </div>
                  <div className={`flex flex-1 flex-col ${capability.featured ? 'mt-6 lg:mt-0' : 'mt-6'}`}>
                    <p className="max-w-2xl text-base leading-8 text-[#475569] sm:text-[1.0625rem] sm:leading-8">
                      {capability.description}
                    </p>
                  </div>
                </div>
              </DesignSystemCard>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 sm:px-6 sm:py-20 lg:py-28" aria-labelledby="why-choose-heading">
        <div className="mx-auto max-w-6xl">
          <SectionHeader
            eyebrow="WHY CHOOSE ZENTRIC ANALYTICS"
            heading="Built for organizations that need technology they can depend on."
            headingId="why-choose-heading"
            description="Zentric Analytics combines disciplined engineering, responsible technology adoption, and long-term architectural thinking to help organizations build systems that remain reliable beyond launch."
          />

          <div className="mt-12 grid items-stretch gap-6 md:grid-cols-2 lg:mt-14 lg:gap-7">
            {trustPrinciples.map((principle) => (
              <DesignSystemCard className="trust-principle-card" interactive key={principle.number} variant="standard">
                <principle.Icon
                  aria-hidden="true"
                  className="size-6 shrink-0 text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981] sm:size-7"
                  strokeWidth={1.75}
                />
                <h3 className="mt-6 max-w-[34rem] text-[1.375rem] font-bold leading-[1.2] tracking-[-0.03em] text-[#111827] sm:text-2xl">
                  {principle.title}
                </h3>
                <p className="mt-4 max-w-[36rem] text-base leading-[1.7] text-[#475569] sm:text-[1.0625rem]">
                  {principle.description}
                </p>
              </DesignSystemCard>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F8FAFC] px-4 py-16 sm:px-6 sm:py-20 lg:py-28" aria-labelledby="engineering-process-heading">
        <div className="mx-auto max-w-6xl">
          <SectionHeader
            eyebrow="ENGINEERING PROCESS"
            heading="Every successful solution begins with a disciplined engineering process."
            headingId="engineering-process-heading"
            description="Every engagement follows a structured workflow designed to reduce risk, improve collaboration, and deliver technology that remains reliable, maintainable, and scalable over time."
          />

          <div className="mt-12 lg:mt-14">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-7">
              {engineeringProcess.map((step) => (
                <article
                  className="engineering-process-card group relative rounded-[20px] border border-[#E5E7EB] bg-white p-6 shadow-[0_8px_24px_rgba(11,31,58,0.06)] transition-[border-color,box-shadow,transform] duration-200 ease-out motion-safe:hover:-translate-y-0.5 hover:border-[#10B981]/55 hover:shadow-[0_16px_36px_rgba(11,31,58,0.10)] sm:p-7"
                  key={step.title}
                >
                  <div className="flex size-11 items-center justify-center rounded-[11px] bg-[#F8FAFC]">
                    <step.Icon
                      aria-hidden="true"
                      className="size-6 shrink-0 text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981] sm:size-7"
                      strokeWidth={1.75}
                    />
                  </div>
                  <h3 className="mt-6 text-xl font-bold leading-[1.2] tracking-[-0.03em] text-[#0B1F3A] sm:text-2xl">
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-[32rem] text-sm leading-7 text-[#475569] sm:text-base sm:leading-[1.75]">
                    {step.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 sm:px-6 sm:py-20 lg:py-28" aria-labelledby="industries-heading">
        <div className="mx-auto max-w-6xl">
          <SectionHeader
            eyebrow="INDUSTRIES WE SERVE"
            heading="Engineering technology for organizations across critical industries."
            headingId="industries-heading"
            description="Every industry has unique operational, regulatory, and technical challenges. Zentric Analytics applies disciplined engineering, artificial intelligence, data platforms, and modern software solutions to help organizations build reliable, scalable, and future-ready technology."
          />

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:mt-14 lg:grid-cols-3 lg:gap-7">
            {industries.map((industry) => (
              <DesignSystemCard className="industry-card" interactive key={industry.title} variant="standard">
                <industry.Icon
                  aria-hidden="true"
                  className="size-6 shrink-0 text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981] sm:size-7"
                  strokeWidth={1.75}
                />
                <h3 className="mt-6 text-[1.25rem] font-bold leading-[1.2] tracking-[-0.03em] text-[#0B1F3A] sm:text-[1.4375rem]">
                  {industry.title}
                </h3>
                <p className="mt-4 max-w-[34rem] text-base leading-[1.7] text-[#475569] sm:text-[1.0625rem] sm:leading-8">
                  {industry.description}
                </p>
              </DesignSystemCard>
            ))}
          </div>
        </div>
      </section>

      <section
        className="relative isolate overflow-hidden bg-[#F8FAFC] px-4 py-20 sm:px-6 sm:py-24 lg:py-28"
        aria-labelledby="careers-preview-heading"
      >
        <div className="editorial-reveal mx-auto flex max-w-3xl flex-col items-center text-center">
          <SectionHeader
            align="center"
            eyebrow="CAREERS"
            heading="Work on practical technology problems with care and accountability."
            headingId="careers-preview-heading"
            description="Zentric Analytics looks for people who value clear communication, maintainable engineering, responsible data handling, and continuous learning. If a specific role is not listed, candidates may submit a general application."
          />
          <Link className="btn btn-primary mt-10" href="/careers">
            View Careers
          </Link>
        </div>
      </section>

      <section
        className="relative isolate overflow-hidden bg-white px-4 py-20 sm:px-6 sm:py-24 lg:py-28"
        aria-labelledby="final-cta-heading"
      >
        <div className="editorial-reveal mx-auto flex max-w-3xl flex-col items-center text-center">
          <SectionHeader
            align="center"
            eyebrow="READY TO BUILD?"
            heading={<>Let&apos;s build technology that lasts.</>}
            headingId="final-cta-heading"
            description="Whether you're planning a new platform, modernizing existing systems, exploring artificial intelligence, or developing a research-led technology initiative, Zentric Analytics can help you move from idea to reliable execution."
          />
          <div className="mt-10 flex w-full flex-col items-center gap-4 sm:mt-12 sm:w-auto sm:flex-row sm:justify-center">
            <Link
              className="btn btn-primary w-full sm:w-auto"
              href="/contact"
            >
              Let&apos;s Talk
            </Link>
          </div>
        </div>
      </section>

    </PageShell>
  );
}
