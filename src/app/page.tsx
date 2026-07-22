import type { CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { BrainCircuit, ChartColumn, CloudCog, CodeXml, Cpu, DraftingCompass, FlaskConical, Network, Rocket, Search, ShieldCheck, Target, RefreshCcw, type LucideIcon } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { SectionHeader } from '@/components/SectionHeader';
import { ScrollReveal } from '@/components/ScrollReveal';

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
  return (
    <PageShell>
      <link rel="preload" as="image" href="/images/hero/hero-engineering-team-v2.png" fetchPriority="high" />
      <section className="hero-premium relative isolate overflow-hidden bg-[#0B1F3A] text-white">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-3 px-4 pb-5 pt-0 md:grid-cols-[minmax(0,1fr)_minmax(0,0.98fr)] md:gap-6 md:px-4 md:py-14 lg:py-16 lg:gap-8">
          <div className="max-w-[700px]">
            <h1 className="hero-reveal hero-reveal-1 max-w-[21rem] text-[1.82rem] font-extrabold leading-[1.09] tracking-[-0.03em] text-white sm:max-w-2xl sm:text-[2.15rem] md:font-bold md:leading-[1.05] lg:max-w-[48rem] lg:text-[2.65rem]">
              <span className="md:block">Engineering reliable software,</span>{' '}
              <span className="md:block">data, and AI systems</span>{' '}
              <span className="md:block">for serious</span>{' '}
              <span className="md:block lg:inline">work.</span>
            </h1>
            <p className="hero-reveal hero-reveal-2 mt-4 max-w-[520px] text-[15px] font-normal leading-[1.6] text-slate-200 md:text-[20px] md:leading-[1.62]">
              Zentric Analytics engineers reliable software, AI, and data platforms that help organizations build secure, scalable, and future-ready technology.
            </p>
            <div className="hero-reveal hero-reveal-3 mt-5 flex flex-col gap-2.5 md:gap-3 md:flex-row md:flex-wrap md:items-center">
              <Link className="btn hero-cta-primary h-[48px] min-h-[48px] w-full md:h-[50px] md:min-h-[50px] md:w-auto" href="/services">
                Explore Services
              </Link>
              <Link className="btn hero-cta-secondary h-[48px] min-h-[48px] w-full md:h-[50px] md:min-h-[50px] md:w-auto" href="/contact">
                <span>Let&apos;s Talk</span>
                <span className="zentric-primary-cta__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </div>
          </div>

          <div className="hero-reveal hero-reveal-4 -mt-1 w-full max-w-[34rem] justify-self-center md:mt-0 md:-mr-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))] md:w-[50vw] md:max-w-none md:justify-self-end lg:w-[49vw]">
            <div className="relative aspect-[16/10.5] overflow-hidden rounded-r-xl rounded-l-none md:min-h-[25rem] lg:min-h-[27.5rem]">
              <Image
                src="/images/hero/hero-engineering-team-v2.png"
                alt="Software engineers collaborating on code and system architecture in a modern office"
                fill
                priority
                fetchPriority="high"
                decoding="async"
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

      <section className="philosophy-section bg-white px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16" aria-labelledby="how-we-think-heading">
        <ScrollReveal>
          <div className="mx-auto grid max-w-[1280px] gap-4 text-left sm:gap-5 md:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] md:items-start lg:gap-6">
            <SectionHeader
              className="industries-child-reveal max-w-3xl md:sticky md:top-24 [&_h2]:max-w-3xl [&_h2]:text-xl sm:[&_h2]:text-2xl lg:[&_h2]:text-[2rem] [&_h2]:font-bold [&_h2]:tracking-[-0.02em] [&_p:last-child]:mt-3 [&_p:last-child]:max-w-2xl [&_p:last-child]:text-sm sm:[&_p:last-child]:text-base [&_p:last-child]:leading-6 sm:[&_p:last-child]:leading-7"
              eyebrow="HOW WE THINK"
              heading={<>Engineering isn&apos;t just what we build. It&apos;s how we solve problems.</>}
              headingId="how-we-think-heading"
              description="Every organization faces unique technology challenges. At Zentric Analytics, we approach each engagement with disciplined engineering, structured thinking, and a commitment to building solutions that remain reliable, secure, and valuable long after deployment."
            />

            <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 sm:gap-5 md:auto-rows-auto lg:gap-6">
              {philosophyPrinciples.map((principle, index) => (
                <article
                  className="philosophy-row industries-child-reveal group h-full rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:border-[#10B981]/40 hover:bg-[#F8FAFC] hover:shadow-md sm:p-5 md:hover:border-[#10B981]/55 lg:p-6"
                  key={principle.title}
                  style={{ '--industries-reveal-delay': `${80 + index * 100}ms` } as CSSProperties}
                >
                  <principle.Icon
                    aria-hidden="true"
                    className="h-12 w-12 rounded-2xl p-3 text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981]"
                    strokeWidth={1.75}
                  />
                  <h3 className="mt-4 text-lg font-bold leading-[1.2] tracking-[-0.02em] text-[#0B1F3A] sm:text-xl lg:text-2xl">
                    {principle.title}
                  </h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-[#475569] sm:text-base">
                    {principle.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </section>

      <section className="core-capabilities-section border-t border-[#DCE3EA] bg-[#F8FAFC] px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16" aria-labelledby="core-capabilities-heading">
        <ScrollReveal>
          <div className="mx-auto max-w-[1280px]">
            <SectionHeader
              className="industries-child-reveal max-w-3xl [&_h2]:mt-2.5 [&_h2]:max-w-3xl [&_h2]:text-xl sm:[&_h2]:text-2xl lg:[&_h2]:text-[2rem] [&_h2]:font-bold [&_h2]:tracking-[-0.02em] [&_p:last-child]:mt-3 [&_p:last-child]:max-w-3xl [&_p:last-child]:text-sm sm:[&_p:last-child]:text-base [&_p:last-child]:leading-6 sm:[&_p:last-child]:leading-7"
              eyebrow="CORE CAPABILITIES"
              heading="Engineering expertise across software, AI, data, infrastructure, and research."
              headingId="core-capabilities-heading"
              description="Zentric Analytics brings together disciplined software engineering, artificial intelligence, data platforms, cloud infrastructure, and research-led innovation to help organizations build technology that is reliable, scalable, and future-ready."
            />

            <div className="mt-6 grid gap-4 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-3 sm:gap-5 lg:gap-6">
              {capabilities.map((capability, index) => (
                <div
                  className="industries-child-reveal group flex items-center gap-3.5 border-b border-[#DCE3EA] py-2.5 text-left transition-colors duration-200 ease-out last:border-b-0 sm:py-3 sm:[&:nth-child(3)]:border-b-0 sm:[&:nth-last-child(-n+1)]:border-b-0"
                  key={capability.title}
                  style={{ '--industries-reveal-delay': `${80 + index * 100}ms` } as CSSProperties}
                >
                  <capability.Icon
                    aria-hidden="true"
                    className="h-12 w-12 shrink-0 rounded-2xl p-3 text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981]"
                    strokeWidth={1.75}
                  />
                  <h3 className="text-lg font-bold leading-[1.2] tracking-[-0.02em] text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981] sm:text-xl lg:text-2xl">
                    {capability.title}
                  </h3>
                </div>
              ))}
            </div>

            <div className="industries-child-reveal mt-4 flex justify-center sm:mt-6" style={{ '--industries-reveal-delay': '680ms' } as CSSProperties}>
              <Link className="btn zentric-primary-cta min-h-12 w-full rounded-full px-6 sm:w-auto sm:px-7" href="/services">
                <span>Explore All Capabilities</span>
                <span className="zentric-primary-cta__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </section>

      <section className="why-choose-section bg-white px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20" aria-labelledby="why-choose-heading">
        <ScrollReveal>
          <div className="mx-auto max-w-[1280px] rounded-[20px] bg-[#0B1F3A] px-4 py-12 sm:px-6 sm:py-14 md:px-8 lg:px-10 lg:py-16">
            <SectionHeader
              eyebrow="WHY CLIENTS CHOOSE ZENTRIC"
              heading="A disciplined approach to building technology that lasts."
              headingId="why-choose-heading"
              description="Every successful partnership begins with understanding your business, designing the right solution, building with quality, deploying with confidence, and supporting long-term growth."
              tone="dark"
              className="industries-child-reveal engineering-process-header why-choose-header max-w-3xl [&_h2]:max-w-3xl [&_h2]:text-xl sm:[&_h2]:text-2xl lg:[&_h2]:text-[2rem] [&_h2]:tracking-[-0.02em] [&_p:last-child]:max-w-3xl [&_p:last-child]:text-sm sm:[&_p:last-child]:text-base [&_p:last-child]:leading-6 sm:[&_p:last-child]:leading-7"
            />

            <div className="relative mt-4 lg:mt-5">
              <div
                aria-hidden="true"
                className="absolute left-[23px] top-[23px] h-[calc(100%-46px)] w-px bg-slate-200/30 md:left-[calc((100%-4rem)/6)] md:right-[calc((100%-4rem)/6)] md:top-[26px] md:h-0.5 md:w-auto lg:left-[calc((100%-7rem)/10)] lg:right-[calc((100%-7rem)/10)]"
              />
              <div className="relative grid items-stretch gap-y-5 pl-[62px] md:grid-cols-3 md:gap-x-5 md:gap-y-5 md:pl-0 lg:flex lg:flex-row lg:items-stretch lg:gap-x-6">
                {clientChoiceProcess.map((step, index) => (
                  <article
                    className="industries-child-reveal group relative flex min-h-[46px] w-full flex-col items-center text-center md:min-h-[52px] lg:flex-1"
                    key={step.title}
                    style={{ '--industries-reveal-delay': `${120 + index * 100}ms` } as CSSProperties}
                  >
                    <div className="absolute -left-[62px] top-0 flex size-[46px] shrink-0 items-center justify-center rounded-full border border-white/70 bg-[#F8FAFC] shadow-[0_10px_24px_rgba(2,8,23,0.18)] transition-[border-color,transform,box-shadow] duration-200 ease-out group-hover:border-[#10B981]/70 group-hover:shadow-[0_12px_26px_rgba(2,8,23,0.22)] motion-safe:group-hover:-translate-y-0.5 md:relative md:left-auto md:top-auto md:h-12 md:w-12 md:rounded-2xl">
                      <step.Icon
                        aria-hidden="true"
                        className="size-[22px] shrink-0 text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981]"
                        strokeWidth={1.75}
                      />
                    </div>
                    <h3 className="mt-0 flex w-full items-start justify-center text-center text-lg font-bold leading-[1.3] tracking-[-0.02em] text-white md:mt-3 sm:text-xl md:leading-[1.2] lg:min-h-0 lg:text-2xl">
                      {step.title}
                    </h3>
                    <p className="mt-2 w-full max-w-[24rem] text-sm font-medium leading-6 text-slate-300 sm:text-base md:max-w-[13rem] md:text-center">
                      {step.description}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      <section
        className="relative isolate overflow-hidden bg-[#F8FAFC] px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16"
        aria-labelledby="final-cta-heading"
      >
        <Image
          src="/images/careers/careers-team-collaboration.png"
          sizes="100vw"
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
          <div className="relative z-10 mx-auto flex max-w-[1280px] flex-col items-center text-center">
            <SectionHeader
              className="industries-child-reveal max-w-3xl [&_h2]:max-w-3xl [&_h2]:text-xl sm:[&_h2]:text-2xl lg:[&_h2]:text-[2rem] [&_h2]:font-bold [&_h2]:tracking-[-0.02em] [&_p:last-child]:mt-3 [&_p:last-child]:max-w-3xl [&_p:last-child]:text-sm sm:[&_p:last-child]:text-base [&_p:last-child]:leading-6 sm:[&_p:last-child]:leading-7"
              align="center"
              eyebrow="READY TO BUILD?"
              heading={<>Let&apos;s build technology that creates lasting impact.</>}
              headingId="final-cta-heading"
              description="Whether you're looking for a trusted technology partner or exploring career opportunities, Zentric Analytics is committed to solving meaningful challenges through engineering, AI, data, cloud, and research-driven innovation."
            />
            <div
              className="final-cta-marquee industries-child-reveal mt-4 w-full max-w-3xl overflow-hidden sm:mt-6"
              aria-label={finalCtaMarqueeKeywords.join(' • ')}
              style={{ '--industries-reveal-delay': '100ms' } as CSSProperties}
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
            <div className="industries-child-reveal mt-4 flex w-full flex-col items-center gap-3 sm:mt-6 sm:w-auto sm:flex-row sm:justify-center max-md:[&_.btn]:h-[48px] max-md:[&_.btn]:min-h-[48px] max-md:[&_.btn]:text-[16px] max-md:[&_.btn]:font-semibold" style={{ '--industries-reveal-delay': '200ms' } as CSSProperties}>
              <Link
                className="btn btn-primary min-h-12 w-full min-w-[12rem] rounded-full px-6 sm:w-auto sm:px-7"
                href="/contact"
              >
                Start a Conversation
              </Link>
              <Link
                className="btn btn-secondary min-h-12 w-full min-w-[12rem] rounded-full px-6 sm:w-auto sm:px-7"
                href="/careers"
              >
                Explore Careers
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </section>

    </PageShell>
  );
}
