import Link from 'next/link';
import Image from 'next/image';
import { BadgeCheck, Braces, BrainCircuit, Building2, ChartColumn, CloudCog, CodeXml, Cpu, DraftingCompass, Factory, FlaskConical, GraduationCap, HeartPulse, Landmark, LifeBuoy, LockKeyhole, MessagesSquare, Microscope, Network, Rocket, Search, ShieldCheck, Target, Truck, Wrench, type LucideIcon } from 'lucide-react';
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

const philosophyPrinciples: Array<{ Icon: LucideIcon; title: string; description: string }> = [
  {
    Icon: DraftingCompass,
    title: 'Engineering First',
    description:
      'Every decision begins with architecture, maintainability, scalability, and long-term reliability.',
  },
  {
    Icon: Target,
    title: 'Technology With Purpose',
    description:
      'Artificial intelligence, software, and data are applied where they create measurable value rather than unnecessary complexity.',
  },
  {
    Icon: ShieldCheck,
    title: 'Built For Longevity',
    description:
      'Solutions are designed to evolve with changing business needs instead of becoming short-term implementations.',
  },
  {
    Icon: FlaskConical,
    title: 'Continuous Innovation',
    description:
      'Research, experimentation, and emerging technologies are explored with discipline, practicality, and measurable outcomes.',
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
      <section className="hero-premium relative isolate overflow-hidden bg-[#0B1F3A] pb-8 text-white md:pb-12">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 pb-10 pt-8 sm:pt-9 md:min-h-[34rem] md:grid-cols-[minmax(0,1fr)_minmax(0,0.98fr)] md:gap-6 md:py-10 lg:min-h-[38rem] lg:gap-8 lg:py-14">
          <div className="max-w-[42rem]">
            <h1 className="hero-reveal hero-reveal-1 max-w-[34.5rem] text-balance text-[clamp(2rem,4.05vw,3.5rem)] font-bold leading-[1.12] tracking-[-0.025em] text-white">
              Engineering reliable software, data, and AI systems for serious work.
            </h1>
            <p className="hero-reveal hero-reveal-2 mt-5 max-w-[33.5rem] text-base font-normal leading-[1.6] text-slate-200 sm:text-lg">
              Zentric Analytics is a technology company focused on disciplined software delivery, web platforms, artificial intelligence solutions, analytics, computer science research, and emerging technology implementation.
            </p>
            <div className="hero-reveal hero-reveal-3 mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
              <Link className="btn hero-cta-primary" href="/services">
                Explore Services
              </Link>
              <Link className="btn hero-cta-secondary" href="/contact">
                <span>Let&apos;s Talk</span>
                <span className="zentric-primary-cta__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </div>
          </div>

          <div className="hero-reveal hero-reveal-4 w-full max-w-[34rem] justify-self-center md:-mr-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))] md:w-[50vw] md:max-w-none md:justify-self-end lg:w-[49vw]">
            <div className="relative aspect-[16/10.5] overflow-hidden rounded-r-xl rounded-l-none md:min-h-[29rem] lg:min-h-[31.5rem]">
              <Image
                src="/images/hero/hero-engineering-team.png"
                alt="Software engineers collaborating on code and system architecture in a modern office"
                fill
                priority
                sizes="(min-width: 1180px) 50vw, (min-width: 768px) 50vw, calc(100vw - 2rem)"
                className="object-cover object-[67%_30%] [mask-image:linear-gradient(90deg,transparent_0%,rgba(0,0,0,0.18)_12%,rgba(0,0,0,0.82)_32%,#000_43%)] [mask-repeat:no-repeat] [mask-size:100%_100%]"
              />
            </div>
          </div>
        </div>
        <svg
          className="absolute inset-x-0 bottom-[-1px] h-12 w-full text-white md:h-16 lg:h-20"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path fill="currentColor" d="M0 80V20C360 74 1080 74 1440 20V80H0Z" />
        </svg>
      </section>

      <section className="philosophy-section bg-white px-4 py-11 sm:px-6 sm:py-12 lg:py-[68px]" aria-labelledby="how-we-think-heading">
        <div className="editorial-reveal editorial-reveal-4 mx-auto grid max-w-6xl gap-8 text-left md:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] md:items-start md:gap-12 lg:gap-16">
          <SectionHeader
            className="editorial-reveal editorial-reveal-1 md:sticky md:top-24 [&_h2]:max-w-[31rem] [&_h2]:text-[clamp(1.85rem,4.25vw,2.75rem)] [&_h2]:leading-[1.12] [&_p:last-child]:mt-5 [&_p:last-child]:max-w-[30rem] [&_p:last-child]:text-base [&_p:last-child]:leading-[1.6] sm:[&_p:last-child]:text-[1.0625rem] lg:[&_p:last-child]:text-lg"
            eyebrow="HOW WE THINK"
            heading={<>Engineering isn&apos;t just what we build. It&apos;s how we solve problems.</>}
            headingId="how-we-think-heading"
            description="Every organization faces unique technology challenges. At Zentric Analytics, we approach each engagement with disciplined engineering, structured thinking, and a commitment to building solutions that remain reliable, secure, and valuable long after deployment."
          />

          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6">
            {philosophyPrinciples.map((principle, index) => (
              <article
                className={`philosophy-row editorial-reveal editorial-reveal-${index + 5} group rounded-2xl border border-[#E5E7EB] bg-white p-5 transition-[background-color,border-color] duration-200 ease-out hover:border-[#10B981]/55 hover:bg-[#F8FAFC] sm:p-6`}
                key={principle.title}
              >
                <principle.Icon
                  aria-hidden="true"
                  className="size-6 text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981]"
                  strokeWidth={1.75}
                />
                <h3 className="mt-4 text-xl font-bold leading-[1.2] tracking-[-0.025em] text-[#0B1F3A] sm:text-[1.375rem]">
                  {principle.title}
                </h3>
                <p className="mt-3 text-[0.9375rem] leading-[1.62] text-[#475569] sm:text-base">
                  {principle.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F8FAFC] px-4 py-10 sm:px-6 sm:py-14 lg:py-16" aria-labelledby="core-capabilities-heading">
        <div className="mx-auto max-w-6xl">
          <SectionHeader
            eyebrow="CORE CAPABILITIES"
            heading="Engineering expertise across software, AI, data, infrastructure, and research."
            headingId="core-capabilities-heading"
            description="Zentric Analytics brings together disciplined software engineering, artificial intelligence, data platforms, cloud infrastructure, and research-led innovation to help organizations build technology that is reliable, scalable, and future-ready."
          />

          <div className="mt-8 grid items-stretch gap-4 md:grid-cols-2 sm:gap-5 lg:mt-9 lg:gap-6">
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
                    <h3 className="mt-4 text-[1.375rem] font-bold leading-[1.18] tracking-[-0.03em] text-[#111827] sm:text-[1.55rem]">
                      {capability.title}
                    </h3>
                  </div>
                  <div className={`flex flex-1 flex-col ${capability.featured ? 'mt-4 lg:mt-0' : 'mt-4'}`}>
                    <p className="max-w-2xl text-base leading-[1.6] text-[#475569] sm:text-[1.0625rem] sm:leading-[1.6]">
                      {capability.description}
                    </p>
                  </div>
                </div>
              </DesignSystemCard>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-10 sm:px-6 sm:py-14 lg:py-16" aria-labelledby="why-choose-heading">
        <div className="mx-auto max-w-6xl">
          <SectionHeader
            eyebrow="WHY CHOOSE ZENTRIC ANALYTICS"
            heading="Built for organizations that need technology they can depend on."
            headingId="why-choose-heading"
            description="Zentric Analytics combines disciplined engineering, responsible technology adoption, and long-term architectural thinking to help organizations build systems that remain reliable beyond launch."
          />

          <div className="mt-8 grid items-stretch gap-4 md:grid-cols-2 sm:gap-5 lg:mt-9 lg:gap-6">
            {trustPrinciples.map((principle) => (
              <DesignSystemCard className="trust-principle-card" interactive key={principle.number} variant="standard">
                <principle.Icon
                  aria-hidden="true"
                  className="size-6 shrink-0 text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981] sm:size-7"
                  strokeWidth={1.75}
                />
                <h3 className="mt-4 max-w-[34rem] text-[1.375rem] font-bold leading-[1.2] tracking-[-0.03em] text-[#111827] sm:text-2xl">
                  {principle.title}
                </h3>
                <p className="mt-3 max-w-[36rem] text-base leading-[1.6] text-[#475569] sm:text-[1.0625rem]">
                  {principle.description}
                </p>
              </DesignSystemCard>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F8FAFC] px-4 py-10 sm:px-6 sm:py-14 lg:py-16" aria-labelledby="engineering-process-heading">
        <div className="mx-auto max-w-6xl">
          <SectionHeader
            eyebrow="ENGINEERING PROCESS"
            heading="Every successful solution begins with a disciplined engineering process."
            headingId="engineering-process-heading"
            description="Every engagement follows a structured workflow designed to reduce risk, improve collaboration, and deliver technology that remains reliable, maintainable, and scalable over time."
          />

          <div className="mt-8 lg:mt-9">
            <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {engineeringProcess.map((step) => (
                <article
                  className="engineering-process-card group relative rounded-[20px] border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_24px_rgba(11,31,58,0.06)] transition-[border-color,box-shadow,transform] duration-200 ease-out motion-safe:hover:-translate-y-0.5 hover:border-[#10B981]/55 hover:shadow-[0_16px_36px_rgba(11,31,58,0.10)] sm:p-6"
                  key={step.title}
                >
                  <div className="flex size-11 items-center justify-center rounded-[11px] bg-[#F8FAFC]">
                    <step.Icon
                      aria-hidden="true"
                      className="size-6 shrink-0 text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981] sm:size-7"
                      strokeWidth={1.75}
                    />
                  </div>
                  <h3 className="mt-4 text-xl font-bold leading-[1.2] tracking-[-0.03em] text-[#0B1F3A] sm:text-2xl">
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-[32rem] text-sm leading-[1.6] text-[#475569] sm:text-base sm:leading-[1.6]">
                    {step.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-10 sm:px-6 sm:py-14 lg:py-16" aria-labelledby="industries-heading">
        <div className="mx-auto max-w-6xl">
          <SectionHeader
            eyebrow="INDUSTRIES WE SERVE"
            heading="Engineering technology for organizations across critical industries."
            headingId="industries-heading"
            description="Every industry has unique operational, regulatory, and technical challenges. Zentric Analytics applies disciplined engineering, artificial intelligence, data platforms, and modern software solutions to help organizations build reliable, scalable, and future-ready technology."
          />

          <div className="mt-8 grid gap-4 sm:gap-5 md:grid-cols-2 lg:mt-9 lg:grid-cols-3 lg:gap-6">
            {industries.map((industry) => (
              <DesignSystemCard className="industry-card" interactive key={industry.title} variant="standard">
                <industry.Icon
                  aria-hidden="true"
                  className="size-6 shrink-0 text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981] sm:size-7"
                  strokeWidth={1.75}
                />
                <h3 className="mt-4 text-[1.25rem] font-bold leading-[1.2] tracking-[-0.03em] text-[#0B1F3A] sm:text-[1.4375rem]">
                  {industry.title}
                </h3>
                <p className="mt-3 max-w-[34rem] text-base leading-[1.6] text-[#475569] sm:text-[1.0625rem] sm:leading-[1.6]">
                  {industry.description}
                </p>
              </DesignSystemCard>
            ))}
          </div>
        </div>
      </section>

      <section
        className="relative isolate overflow-hidden bg-[#F8FAFC] px-4 py-10 sm:px-6 sm:py-14 lg:py-16"
        aria-labelledby="careers-preview-heading"
      >
        <div className="editorial-reveal mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)] lg:gap-10">
          <div className="flex flex-col items-start">
            <SectionHeader
              align="left"
              eyebrow="CAREERS"
              heading="Work on practical technology problems with care and accountability."
              headingId="careers-preview-heading"
              description="Zentric Analytics looks for people who value clear communication, maintainable engineering, responsible data handling, and continuous learning. If a specific role is not listed, candidates may submit a general application."
            />
            <Link className="btn btn-primary mt-6 sm:mt-7" href="/careers">
              View Careers
            </Link>
          </div>
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[22px] border border-[#E5E7EB] shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
            <Image
              src="/images/careers/careers-team-collaboration.png"
              alt="Software engineers collaborating on system architecture and application development"
              fill
              sizes="(min-width: 1024px) 475px, (min-width: 768px) 42vw, calc(100vw - 32px)"
              className="object-cover object-[50%_45%]"
              priority={false}
            />
          </div>
        </div>
      </section>

      <section
        className="relative isolate overflow-hidden bg-white px-4 py-10 sm:px-6 sm:py-14 lg:py-16"
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
          <div className="mt-6 flex w-full flex-col items-center gap-4 sm:mt-7 sm:w-auto sm:flex-row sm:justify-center">
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
