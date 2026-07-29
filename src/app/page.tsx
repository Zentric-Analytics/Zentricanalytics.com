'use client';

import { useId, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { BrainCircuit, ChartColumn, ChevronDown, CloudCog, CodeXml, Cpu, DraftingCompass, FlaskConical, Network, Rocket, Search, ShieldCheck, Target, RefreshCcw, type LucideIcon } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { SectionHeader } from '@/components/SectionHeader';
import { ScrollReveal } from '@/components/ScrollReveal';

const capabilities: Array<{ Icon: LucideIcon; title: string }> = [
  {
    Icon: CodeXml,
    title: 'Build Reliable Digital Products',
  },
  {
    Icon: BrainCircuit,
    title: 'Apply AI Responsibly',
  },
  {
    Icon: ChartColumn,
    title: 'Turn Data Into Decisions',
  },
  {
    Icon: CloudCog,
    title: 'Modernize Infrastructure',
  },
  {
    Icon: FlaskConical,
    title: 'Test New Ideas Before Investing',
  },
  {
    Icon: Cpu,
    title: 'Evaluate Technology With Purpose',
  },
];

const philosophyPrinciples: Array<{ Icon: LucideIcon; title: string; description: string }> = [
  {
    Icon: DraftingCompass,
    title: 'Engineering First',
    description:
      'Architecture, maintainability, testing, and operational needs guide decisions from the start.',
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
      'Clear architecture and documented decisions help systems adapt as requirements and teams change.',
  },
  {
    Icon: FlaskConical,
    title: 'Continuous Innovation',
    description:
      'Focused prototypes test assumptions and value before an organization commits to a larger investment.',
  },
];

const clientChoiceProcess: Array<{ Icon: LucideIcon; title: string; description: string }> = [
  {
    Icon: Search,
    title: 'Understand Your Business',
    description:
      'We begin by learning your goals, challenges, and technical requirements before proposing any solution.',
  },
  {
    Icon: Network,
    title: 'Design the Right Solution',
    description:
      'We create scalable architectures and practical implementation plans tailored to your organization.',
  },
  {
    Icon: CodeXml,
    title: 'Build with Quality',
    description:
      'Our engineers develop secure, maintainable, and high-performance software using modern engineering practices.',
  },
  {
    Icon: Rocket,
    title: 'Deploy with Confidence',
    description:
      'Solutions are thoroughly tested and released using reliable deployment practices.',
  },
  {
    Icon: RefreshCcw,
    title: 'Support & Improve',
    description:
      'We continue monitoring, maintaining, and improving your systems as your business evolves.',
  },
];

export default function Home() {
  const [isClientChoiceExpanded, setIsClientChoiceExpanded] = useState(false);
  const clientChoiceDetailsId = useId();
  const renderClientChoiceStep = (
    step: (typeof clientChoiceProcess)[number],
    index: number,
    isMobileDetail = false,
  ) => (
    <article
      className={`industries-child-reveal group relative min-h-[56px] w-full flex-col items-start text-left md:min-h-[52px] md:items-center md:text-center lg:flex-1 ${isMobileDetail && !isClientChoiceExpanded ? 'hidden md:flex' : 'flex'}`}
      key={step.title}
      style={{ '--industries-reveal-delay': `${120 + index * 100}ms` } as CSSProperties}
    >
      <div className="absolute -left-20 top-0 flex size-14 shrink-0 items-center justify-center rounded-full border border-white/70 bg-[#F8FAFC] shadow-[0_10px_24px_rgba(2,8,23,0.18)] transition-[border-color,transform,box-shadow] duration-200 ease-out group-hover:border-[#10B981]/70 group-hover:shadow-[0_12px_26px_rgba(2,8,23,0.22)] motion-safe:group-hover:-translate-y-0.5 md:relative md:left-auto md:top-auto md:size-[52px]">
        <step.Icon
          aria-hidden="true"
          className="size-[22px] shrink-0 text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981]"
          strokeWidth={1.75}
        />
      </div>
      <h3 className="mt-0 w-full text-left text-[18px] font-bold leading-[1.25] tracking-[-0.02em] text-white md:mt-3 md:text-center lg:min-h-0">
        {step.title}
      </h3>
      <p className="mt-1.5 w-full max-w-[24rem] text-left text-[14px] font-normal leading-[1.5] text-slate-300 md:max-w-[13rem] md:text-center">
        {step.description}
      </p>
    </article>
  );

  return (
    <PageShell>
      <section className="hero-premium relative isolate overflow-hidden bg-[#0B1F3A] text-white">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-3 px-4 pb-5 pt-0 md:grid-cols-[minmax(0,48fr)_minmax(0,52fr)] md:gap-6 md:px-4 md:pb-16 md:pt-10 lg:max-w-[90rem] lg:gap-6 lg:pb-20 lg:pt-12 xl:pt-14">
          <div className="min-w-0">
            <h1 className="home-hero-heading hero-reveal hero-reveal-1 text-white">
              A technology consultancy helping organizations improve how they operate.
            </h1>
            <p className="home-hero-description hero-reveal hero-reveal-2 text-slate-200">
              We design and build dependable software, data, and AI systems around real operational needs, from initial decisions through long-term support.
            </p>
            <div className="hero-reveal hero-reveal-3 mt-7 flex flex-col gap-2.5 md:mt-8 md:flex-row md:flex-wrap md:items-center md:gap-3">
              <Link className="btn hero-cta-primary h-[48px] text-[15px] font-bold leading-none min-h-[48px] w-full md:h-[50px] md:min-h-[50px] md:w-auto" href="/contact">
                Start a Project
              </Link>
              <Link className="btn hero-cta-secondary h-[48px] text-[15px] font-bold leading-none min-h-[48px] w-full md:h-[50px] md:min-h-[50px] md:w-auto" href="/services">
                <span>Explore Services</span>
                <span className="zentric-primary-cta__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </div>
          </div>

          <div className="hero-reveal hero-reveal-4 -mt-1 w-full max-w-[34rem] justify-self-center md:mt-0 md:-mr-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))] md:w-[52vw] md:max-w-none md:justify-self-end">
            <div className="relative aspect-[16/10.5] overflow-hidden rounded-r-xl rounded-l-none md:aspect-auto md:h-[24rem] lg:h-[25rem] xl:h-[26rem]">
              <Image
                src="/images/hero/hero-engineering-team-v2.webp"
                alt="Software engineers collaborating on code and system architecture in a modern office"
                fill
                priority
                decoding="async"
                quality={75}
                sizes="(min-width: 1180px) 50vw, (min-width: 768px) 50vw, calc(100vw - 2rem)"
                className="object-cover object-[62%_center] sm:object-[60%_center] lg:object-[58%_48%] [mask-image:linear-gradient(90deg,transparent_0%,rgba(0,0,0,0.18)_12%,rgba(0,0,0,0.82)_32%,#000_43%)] [mask-repeat:no-repeat] [mask-size:100%_100%]"
              />
            </div>
          </div>
        </div>
        <svg
          className="absolute inset-x-0 bottom-[-1px] h-7 w-full text-white md:h-10 lg:h-12"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path fill="currentColor" d="M0 80V66C170 58 300 24 500 14C680 6 825 35 1000 56C1160 74 1300 54 1440 40V80H0Z" />
        </svg>
      </section>

      <section className="philosophy-section bg-white px-4 py-8 sm:px-6 sm:py-9 lg:py-10" aria-labelledby="how-we-think-heading">
        <ScrollReveal>
          <div className="mx-auto grid max-w-6xl gap-2 text-left sm:gap-6 md:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] md:items-start md:gap-7 lg:gap-8">
            <SectionHeader
              className="industries-child-reveal md:sticky md:top-24 [&_h2]:max-w-[29rem] [&_h2]:!text-[28px] sm:[&_h2]:!text-[30px] lg:[&_h2]:!text-[32px] [&_h2]:!font-bold [&_h2]:!leading-[1.12] [&_h2]:!tracking-[-0.04em] [&_p:last-child]:mt-3 [&_p:last-child]:max-w-[28rem] [&_p:last-child]:!text-[14px] [&_p:last-child]:!leading-[1.65] sm:[&_p:last-child]:!text-[15px] lg:[&_p:last-child]:!text-[15px]"
              eyebrow="HOW WE THINK"
              heading={<>Clear decisions before technology choices.</>}
              headingId="how-we-think-heading"
              description="We clarify the problem, users, constraints, and measures of success before recommending an approach. This keeps delivery focused and gives teams a maintainable foundation."
            />

            <div className="grid auto-rows-fr border-y border-[#DCE3EA] sm:grid-cols-2 md:auto-rows-auto">
              {philosophyPrinciples.map((principle, index) => (
                <article
                  className="philosophy-row industries-child-reveal group h-full border-b border-[#DCE3EA] px-2 py-5 transition-colors duration-200 ease-out hover:bg-[#F8FAFC] sm:px-5 sm:[&:nth-child(odd)]:border-r sm:[&:nth-last-child(-n+2)]:border-b-0"
                  key={principle.title}
                  style={{ '--industries-reveal-delay': `${80 + index * 100}ms` } as CSSProperties}
                >
                  <principle.Icon
                    aria-hidden="true"
                    className="size-[1.375rem] text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981] lg:size-6"
                    strokeWidth={1.75}
                  />
                  <h3 className="mt-2.5 text-[18px] font-bold leading-[1.25] tracking-[-0.02em] text-[#0B1F3A]">
                    {principle.title}
                  </h3>
                  <p className="mt-1.5 text-[14px] font-normal leading-[1.5] text-[#475569]">
                    {principle.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </section>

      <section className="core-capabilities-section border-t border-[#DCE3EA] bg-[#F3F6F9] px-4 py-8 sm:px-6 sm:py-9 lg:py-10" aria-labelledby="core-capabilities-heading">
        <ScrollReveal>
          <div className="mx-auto max-w-6xl">
            <SectionHeader
              className="industries-child-reveal [&_h2]:mt-2.5 [&_h2]:!text-[28px] sm:[&_h2]:!text-[30px] lg:[&_h2]:!text-[32px] [&_h2]:!font-bold [&_h2]:!leading-[1.12] [&_h2]:!tracking-[-0.04em] [&_p:last-child]:mt-2 [&_p:last-child]:max-w-[46rem] [&_p:last-child]:!text-[14px] [&_p:last-child]:!leading-[1.65] sm:[&_p:last-child]:mt-3.5 sm:[&_p:last-child]:!text-[15px] lg:[&_p:last-child]:!text-[15px]"
              heading="Explore what better technology operations can enable."
              headingId="core-capabilities-heading"
              description="These previews show the outcomes our capabilities support. Explore Services for what we build, who it serves, and how each engagement creates value."
            />

            <div className="mt-4 grid gap-x-12 sm:mt-6 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-3 lg:gap-x-16">
              {capabilities.map((capability, index) => (
                <Link href="/services"
                  className="industries-child-reveal group flex items-center gap-3.5 border-b border-[#DCE3EA] py-2.5 text-left transition-colors duration-200 ease-out last:border-b-0 sm:py-3 sm:[&:nth-child(3)]:border-b-0 sm:[&:nth-last-child(-n+1)]:border-b-0"
                  key={capability.title}
                  style={{ '--industries-reveal-delay': `${80 + index * 100}ms` } as CSSProperties}
                >
                  <capability.Icon
                    aria-hidden="true"
                    className="size-[23px] shrink-0 text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981] sm:size-[22px]"
                    strokeWidth={1.75}
                  />
                  <h3 className="text-[18px] font-bold leading-[1.25] tracking-[-0.02em] text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981]">
                    {capability.title}
                  </h3>
                </Link>
              ))}
            </div>

            <div className="industries-child-reveal mt-4 flex justify-start sm:mt-6" style={{ '--industries-reveal-delay': '680ms' } as CSSProperties}>
              <Link className="btn zentric-primary-cta w-full text-[15px] font-bold leading-none sm:w-auto" href="/services">
                <span>Explore All Capabilities</span>
                <span className="zentric-primary-cta__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </section>

      <section className="why-choose-section bg-white px-4 py-12 sm:px-4 sm:py-12 md:px-6 lg:py-14" aria-labelledby="why-choose-heading">
        <ScrollReveal>
          <div className="mx-auto max-w-[1280px] rounded-[28px] bg-[#0B1F3A] px-6 py-10 sm:px-8 sm:py-12 md:px-12 lg:px-16 lg:py-14">
            <SectionHeader
              eyebrow="WHY CLIENTS CHOOSE ZENTRIC"
              heading="A disciplined approach to building technology that lasts."
              headingId="why-choose-heading"
              description="We work in visible stages, make decisions with your team, test before release, and plan for ownership and support after launch."
              tone="dark"
              className="industries-child-reveal engineering-process-header why-choose-header [&_h2]:!text-[28px] sm:[&_h2]:!text-[30px] lg:[&_h2]:!text-[32px] [&_h2]:!font-bold [&_h2]:!leading-[1.12] [&_h2]:!tracking-[-0.04em] [&_p:last-child]:!text-[14px] [&_p:last-child]:!leading-[1.65] sm:[&_p:last-child]:!text-[15px] lg:[&_p:last-child]:!text-[15px]"
            />

            <div className="relative mt-5 px-4 md:mt-4 md:px-0 lg:mt-5">
              <div className="relative grid items-stretch gap-y-8 pl-20 md:grid-cols-3 md:gap-x-7 md:gap-y-5 md:pl-0 lg:flex lg:flex-row lg:items-stretch lg:gap-x-7">
                <div
                  aria-hidden="true"
                  className="absolute left-7 top-7 bottom-7 w-px bg-slate-200/30 md:left-[calc((100%-4rem)/6)] md:right-[calc((100%-4rem)/6)] md:top-[26px] md:bottom-auto md:h-0.5 md:w-auto lg:left-[calc((100%-7rem)/10)] lg:right-[calc((100%-7rem)/10)]"
                />
                {clientChoiceProcess.slice(0, 3).map((step, index) => renderClientChoiceStep(step, index))}
                <div className="contents" id={clientChoiceDetailsId}>
                  {clientChoiceProcess.slice(3).map((step, detailIndex) => renderClientChoiceStep(step, detailIndex + 3, true))}
                </div>
              </div>
              <button
                aria-controls={clientChoiceDetailsId}
                aria-expanded={isClientChoiceExpanded}
                className="ml-20 mt-5 inline-flex min-h-11 items-center gap-1.5 border-0 bg-transparent px-0 py-2 text-left text-[14px] font-bold leading-none text-[#10B981] transition-colors duration-200 ease-out hover:text-[#34D399] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#10B981] md:hidden"
                type="button"
                onClick={() => setIsClientChoiceExpanded((current) => !current)}
              >
                <span>{isClientChoiceExpanded ? 'Show Less' : 'Show More'}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={`size-4 transition-transform duration-300 ease-out motion-reduce:transition-none ${isClientChoiceExpanded ? 'rotate-180' : ''}`}
                  strokeWidth={2.25}
                />
              </button>
            </div>
          </div>
        </ScrollReveal>
      </section>

      <section
        className="relative isolate overflow-hidden bg-[#F7F8FA] px-4 py-12 md:px-6 md:py-10 lg:py-12"
        aria-labelledby="final-cta-heading"
      >
        <Image
          src="/images/careers/careers-team-collaboration.webp"
          sizes="(min-width: 1280px) 1280px, 100vw"
          alt=""
          width={1536}
          height={1024}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 z-0 size-full object-cover object-center"
          aria-hidden="true"
        />
        <div aria-hidden="true" className="absolute inset-0 z-0 bg-white/90" />
        <ScrollReveal>
          <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
            <SectionHeader
              className="industries-child-reveal [&_h2]:!text-[30px] sm:[&_h2]:!text-[36px] lg:[&_h2]:!text-[40px] [&_h2]:!font-bold [&_h2]:!leading-[1.12] [&_h2]:!tracking-[-0.04em] max-md:[&_p:last-child]:mt-3 [&_p:last-child]:!text-[14px] [&_p:last-child]:!leading-[1.6] sm:[&_p:last-child]:!text-[15px] max-md:[&_p:last-child]:font-normal"
              align="center"
              heading={<>Turn an operational priority into a practical project.</>}
              headingId="final-cta-heading"
              description="Tell us what needs to improve, who it affects, and the constraints involved. We will help define a responsible next step."
            />
            <div className="industries-child-reveal mt-5 flex w-full flex-col items-center sm:mt-7 sm:w-auto max-md:[&_.btn]:h-[48px] max-md:[&_.btn]:min-h-[48px] [&_.btn]:text-[15px] [&_.btn]:font-bold [&_.btn]:leading-none" style={{ '--industries-reveal-delay': '100ms' } as CSSProperties}>
              <Link
                className="btn btn-primary w-full min-w-[12rem] text-[15px] font-bold leading-none sm:w-auto"
                href="/contact"
              >
                Start a Project
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </section>

    </PageShell>
  );
}
