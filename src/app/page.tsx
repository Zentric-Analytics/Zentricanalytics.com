import Link from 'next/link';
import Image from 'next/image';
import { Braces, BrainCircuit, ChartColumn, CloudCog, CodeXml, Cpu, DraftingCompass, FlaskConical, LifeBuoy, Network, Rocket, Search, ShieldCheck, Target, type LucideIcon } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { SectionHeader } from '@/components/SectionHeader';
import { IndustriesSlider } from '@/components/IndustriesSlider';
import { EnterpriseAccordion } from '@/components/EnterpriseAccordion';

const finalCtaMarqueeKeywords = [
  'Software Engineering',
  'Artificial Intelligence',
  'Data & Analytics',
  'Cloud & Infrastructure',
  'Research & Innovation',
  'Emerging Technologies',
] as const;

const capabilities: Array<{ Icon: LucideIcon; title: string }> = [
  {
    Icon: CodeXml,
    title: 'Software Engineering',
  },
  {
    Icon: BrainCircuit,
    title: 'Artificial Intelligence',
  },
  {
    Icon: ChartColumn,
    title: 'Data & Analytics',
  },
  {
    Icon: CloudCog,
    title: 'Cloud & Infrastructure',
  },
  {
    Icon: FlaskConical,
    title: 'Research & Innovation',
  },
  {
    Icon: Cpu,
    title: 'Emerging Technologies',
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

const trustPrinciples: Array<{ icon: 'wrench' | 'shield-check' | 'lock-keyhole' | 'microscope' | 'messages-square' | 'badge-check'; title: string; description: string }> = [
  {
    icon: 'wrench',
    title: 'Disciplined Engineering',
    description:
      'Every engagement begins with structured planning, thoughtful architecture, and implementation practices designed for reliability.',
  },
  {
    icon: 'shield-check',
    title: 'Security by Design',
    description:
      'Security, privacy, and operational resilience are considered throughout the development lifecycle, not added at the end.',
  },
  {
    icon: 'lock-keyhole',
    title: 'Long-Term Maintainability',
    description:
      'Solutions are designed to evolve with changing business requirements instead of becoming short-term technical debt.',
  },
  {
    icon: 'microscope',
    title: 'Research-Driven Innovation',
    description:
      'Emerging technologies are evaluated carefully and applied only where they create practical, measurable value.',
  },
  {
    icon: 'messages-square',
    title: 'Transparent Collaboration',
    description:
      'Clear communication, measurable milestones, and shared visibility keep teams aligned from discovery through delivery.',
  },
  {
    icon: 'badge-check',
    title: 'Quality Without Compromise',
    description:
      'Testing, review, documentation, and continuous improvement are treated as core parts of engineering delivery.',
  },
];

export default function Home() {
  return (
    <PageShell>
      <section className="hero-premium relative isolate overflow-hidden bg-[#0B1F3A] text-white">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-16 md:grid-cols-[minmax(0,1fr)_minmax(0,0.98fr)] md:gap-6 md:py-[88px] lg:gap-8">
          <div className="max-w-[700px]">
            <h1 className="hero-reveal hero-reveal-1 max-w-[600px] text-[56px] font-bold leading-[1.05] tracking-[-0.03em] text-white">
              <span className="md:block">Engineering reliable software,</span>{' '}
              <span className="md:block">data, and AI systems</span>{' '}
              <span className="md:block">for serious</span>{' '}
              <span className="md:block">work.</span>
            </h1>
            <p className="hero-reveal hero-reveal-2 mt-5 max-w-[520px] text-base font-normal leading-[1.7] text-slate-200 sm:text-lg md:text-[22px]">
              Zentric Analytics engineers reliable software, AI, and data platforms that help organizations build secure, scalable, and future-ready technology.
            </p>
            <div className="hero-reveal hero-reveal-3 mt-9 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
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
                src="/images/hero/hero-engineering-team-v2.png"
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
          className="absolute inset-x-0 bottom-[-1px] h-9 w-full text-white md:h-14 lg:h-20"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path fill="currentColor" d="M0 80V66C170 58 300 24 500 14C680 6 825 35 1000 56C1160 74 1300 54 1440 40V80H0Z" />
        </svg>
      </section>

      <section className="philosophy-section bg-white px-4 pb-9 pt-8 sm:px-6 sm:pb-11 sm:pt-10 lg:pb-14 lg:pt-13" aria-labelledby="how-we-think-heading">
        <div className="editorial-reveal editorial-reveal-4 mx-auto grid max-w-6xl gap-7 text-left md:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] md:items-start md:gap-9 lg:gap-11">
          <SectionHeader
            className="editorial-reveal editorial-reveal-1 md:sticky md:top-24 [&_h2]:max-w-[29rem] [&_h2]:text-[clamp(1.75rem,3.6vw,2.625rem)] [&_h2]:leading-[1.12] [&_p:last-child]:mt-4 [&_p:last-child]:max-w-[28rem] [&_p:last-child]:text-[0.9375rem] [&_p:last-child]:leading-[1.58] sm:[&_p:last-child]:text-base lg:[&_p:last-child]:text-[1.0625rem]"
            eyebrow="HOW WE THINK"
            heading={<>Engineering isn&apos;t just what we build. It&apos;s how we solve problems.</>}
            headingId="how-we-think-heading"
            description="Every organization faces unique technology challenges. At Zentric Analytics, we approach each engagement with disciplined engineering, structured thinking, and a commitment to building solutions that remain reliable, secure, and valuable long after deployment."
          />

          <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-4 lg:gap-5">
            {philosophyPrinciples.map((principle, index) => (
              <article
                className={`philosophy-row editorial-reveal editorial-reveal-${index + 5} group rounded-2xl border border-[#E5E7EB] bg-white p-[18px] transition-[background-color,border-color] duration-200 ease-out hover:border-[#10B981]/55 hover:bg-[#F8FAFC] sm:p-5 lg:p-6`}
                key={principle.title}
              >
                <principle.Icon
                  aria-hidden="true"
                  className="size-[1.375rem] text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981] lg:size-6"
                  strokeWidth={1.75}
                />
                <h3 className="mt-3 text-[1.1875rem] font-bold leading-[1.18] tracking-[-0.025em] text-[#0B1F3A] sm:text-xl">
                  {principle.title}
                </h3>
                <p className="mt-2 text-[0.90625rem] leading-[1.55] text-[#475569] sm:text-[0.96875rem]">
                  {principle.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#DCE3EA] bg-[#F3F6F9] px-4 py-[34px] sm:px-6 sm:py-10 lg:py-12" aria-labelledby="core-capabilities-heading">
        <div className="mx-auto max-w-6xl">
          <SectionHeader
            className="[&_h2]:mt-2.5 [&_h2]:text-[clamp(1.75rem,3.15vw,2.5rem)] [&_h2]:leading-[1.12] [&_p:last-child]:mt-3.5 [&_p:last-child]:max-w-[46rem] [&_p:last-child]:text-[0.9375rem] [&_p:last-child]:leading-[1.58] sm:[&_p:last-child]:text-base"
            eyebrow="CORE CAPABILITIES"
            heading="Engineering expertise across software, AI, data, infrastructure, and research."
            headingId="core-capabilities-heading"
            description="Zentric Analytics brings together disciplined software engineering, artificial intelligence, data platforms, cloud infrastructure, and research-led innovation to help organizations build technology that is reliable, scalable, and future-ready."
          />

          <div className="mt-6 grid gap-x-12 sm:mt-7 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-3 lg:gap-x-16">
            {capabilities.map((capability) => (
              <div
                className="group flex items-center gap-3.5 border-b border-[#DCE3EA] py-4 text-left transition-colors duration-200 ease-out last:border-b-0 sm:[&:nth-child(3)]:border-b-0 sm:[&:nth-last-child(-n+1)]:border-b-0"
                key={capability.title}
              >
                <capability.Icon
                  aria-hidden="true"
                  className="size-[21px] shrink-0 text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981] sm:size-[22px]"
                  strokeWidth={1.75}
                />
                <h3 className="text-[1.0625rem] font-bold leading-[1.2] tracking-[-0.018em] text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981] sm:text-lg">
                  {capability.title}
                </h3>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-center sm:mt-7">
            <Link className="btn zentric-primary-cta" href="/services">
              <span>Explore All Capabilities</span>
              <span className="zentric-primary-cta__arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className="why-choose-section bg-white px-4 py-8 sm:px-6 sm:py-10 lg:py-12" aria-labelledby="why-choose-heading">
        <div className="mx-auto max-w-6xl">
          <SectionHeader
            eyebrow="WHY CHOOSE ZENTRIC ANALYTICS"
            heading="Built for organizations that need technology they can depend on."
            headingId="why-choose-heading"
            description="Zentric Analytics combines disciplined engineering, responsible technology adoption, and long-term architectural thinking to help organizations build systems that remain reliable beyond launch."
            className="why-choose-header"
          />

          <EnterpriseAccordion items={trustPrinciples} />
        </div>
      </section>

      <section className="bg-[#F8FAFC] px-4 py-10 sm:px-6 sm:py-12 lg:py-14" aria-labelledby="engineering-process-heading">
        <div className="mx-auto max-w-6xl">
          <SectionHeader
            eyebrow="ENGINEERING PROCESS"
            heading="Every successful solution begins with a disciplined engineering process."
            headingId="engineering-process-heading"
            description="Every engagement follows a structured workflow designed to reduce risk, improve collaboration, and deliver technology that remains reliable, maintainable, and scalable over time."
            className="engineering-process-header [&_h2]:text-[clamp(2.375rem,3.4vw,2.625rem)] [&_h2]:leading-[1.12]"
          />

          <div className="relative mt-8 lg:mt-9">
            <div
              aria-hidden="true"
              className="absolute left-[26px] top-[26px] h-[calc(100%-52px)] w-0.5 bg-[#DCE3EA] md:left-[calc((100%-4rem)/6)] md:right-[calc((100%-4rem)/6)] md:top-[26px] md:h-0.5 md:w-auto lg:left-[calc((100%-8.75rem)/12)] lg:right-[calc((100%-8.75rem)/12)]"
            />
            <div className="relative grid items-stretch gap-y-8 pl-[70px] md:grid-cols-3 md:gap-x-8 md:gap-y-10 md:pl-0 lg:flex lg:flex-row lg:items-stretch lg:gap-x-7">
              {engineeringProcess.map((step) => (
                <article
                  className="engineering-process-card group relative flex min-h-[52px] w-full flex-col items-center text-center lg:flex-1"
                  key={step.title}
                >
                  <div className="absolute -left-[70px] top-0 flex size-[52px] shrink-0 items-center justify-center rounded-full border border-[#DCE3EA] bg-white shadow-[0_8px_22px_rgba(11,31,58,0.08)] transition-[border-color,transform,box-shadow] duration-200 ease-out group-hover:border-[#94A3B8] group-hover:shadow-[0_12px_26px_rgba(11,31,58,0.10)] motion-safe:group-hover:-translate-y-0.5 md:relative md:left-auto md:top-auto">
                    <step.Icon
                      aria-hidden="true"
                      className="size-[22px] shrink-0 text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981]"
                      strokeWidth={1.75}
                    />
                  </div>
                  <h3 className="mt-0 flex min-h-[72px] w-full items-start justify-center text-center text-lg font-bold leading-[1.2] tracking-[-0.025em] text-[#0B1F3A] md:mt-5 md:text-[1.1875rem] lg:min-h-[76px]">
                    {step.title}
                  </h3>
                  <p className="mt-2 min-h-[120px] w-full max-w-[24rem] text-sm leading-[1.5] text-[#475569] sm:text-[0.9375rem] md:max-w-[13rem] md:text-center lg:min-h-[132px]">
                    {step.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-8 sm:px-6 sm:py-10 lg:py-12" aria-labelledby="industries-heading">
        <div className="mx-auto max-w-6xl">
          <SectionHeader
            eyebrow="INDUSTRIES WE SERVE"
            heading="Engineering technology for organizations across critical industries."
            headingId="industries-heading"
            description="Every industry has unique operational, regulatory, and technical challenges. Zentric Analytics applies disciplined engineering, artificial intelligence, data platforms, and modern software solutions to help organizations build reliable, scalable, and future-ready technology."
          />

          <IndustriesSlider />
        </div>
      </section>

      <section
        className="relative isolate min-h-[420px] overflow-hidden bg-[#0B1F3A] px-4 py-[72px] sm:min-h-[460px] sm:px-6 sm:py-20 lg:min-h-[520px] lg:py-[88px]"
        aria-labelledby="careers-preview-heading"
      >
        <Image
          src="/images/careers/careers-team-collaboration.png"
          alt=""
          fill
          sizes="100vw"
          className="-z-20 object-cover object-[62%_center] sm:object-[68%_center] lg:object-[center_right]"
          priority={false}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[#0B1F3A]/72 md:bg-[linear-gradient(90deg,rgba(11,31,58,0.88)_0%,rgba(11,31,58,0.76)_42%,rgba(11,31,58,0.42)_68%,rgba(11,31,58,0.24)_100%)]"
        />
        <div className="editorial-reveal mx-auto flex max-w-6xl items-center md:min-h-[300px] lg:min-h-[344px]">
          <div className="flex max-w-[38rem] flex-col items-start md:w-[48%] lg:w-[46%]">
            <SectionHeader
              align="left"
              eyebrow="CAREERS"
              heading="Work on practical technology problems with care and accountability."
              headingId="careers-preview-heading"
              description="Zentric Analytics looks for people who value clear communication, maintainable engineering, responsible data handling, and continuous learning. If a specific role is not listed, candidates may submit a general application."
              tone="dark"
            />
            <Link
              className="btn mt-6 bg-white text-[#0B1F3A] shadow-[0_12px_28px_rgba(0,0,0,0.16)] transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#F8FAFC] hover:shadow-[0_16px_34px_rgba(0,0,0,0.20)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:mt-7"
              href="/careers"
            >
              View Careers
            </Link>
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
          <div
            className="final-cta-marquee mt-6 w-full max-w-3xl overflow-hidden sm:mt-7"
            aria-label={finalCtaMarqueeKeywords.join(' • ')}
          >
            <p className="sr-only">{finalCtaMarqueeKeywords.join(' • ')}</p>
            <div className="final-cta-marquee__track" aria-hidden="true">
              {[0, 1].map((group) => (
                <div className="final-cta-marquee__group" key={group}>
                  {[0, 1].map((set) => (
                    <span className="final-cta-marquee__sequence" key={set}>
                      {finalCtaMarqueeKeywords.map((keyword, index) => (
                        <span className="final-cta-marquee__item" key={keyword}>
                          <span>{keyword}</span>
                          {index < finalCtaMarqueeKeywords.length - 1 ? (
                            <span className="final-cta-marquee__separator">•</span>
                          ) : null}
                        </span>
                      ))}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-7 flex w-full flex-col items-center gap-4 sm:mt-8 sm:w-auto sm:flex-row sm:justify-center">
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
