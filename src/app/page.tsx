import Link from 'next/link';
import Image from 'next/image';
import { BrainCircuit, ChartColumn, CloudCog, CodeXml, Cpu, DraftingCompass, FlaskConical, Network, Rocket, Search, ShieldCheck, Target, RefreshCcw, type LucideIcon } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { SectionHeader } from '@/components/SectionHeader';

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
      <section className="hero-premium relative isolate overflow-hidden bg-[#0B1F3A] text-white">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-12 md:grid-cols-[minmax(0,1fr)_minmax(0,0.98fr)] md:gap-6 md:py-14 lg:py-16 lg:gap-8">
          <div className="max-w-[700px]">
            <h1 className="hero-reveal hero-reveal-1 max-w-[600px] text-[56px] font-bold leading-[1.05] tracking-[-0.03em] text-white">
              <span className="md:block">Engineering reliable software,</span>{' '}
              <span className="md:block">data, and AI systems</span>{' '}
              <span className="md:block">for serious</span>{' '}
              <span className="md:block">work.</span>
            </h1>
            <p className="hero-reveal hero-reveal-2 mt-4 max-w-[520px] text-base font-normal leading-[1.62] text-slate-200 sm:text-lg md:text-[20px]">
              Zentric Analytics engineers reliable software, AI, and data platforms that help organizations build secure, scalable, and future-ready technology.
            </p>
            <div className="hero-reveal hero-reveal-3 mt-7 flex flex-col gap-3.5 sm:flex-row sm:flex-wrap sm:items-center">
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
            <div className="relative aspect-[16/10.5] overflow-hidden rounded-r-xl rounded-l-none md:min-h-[25rem] lg:min-h-[27.5rem]">
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
          className="absolute inset-x-0 bottom-[-1px] h-7 w-full text-white md:h-10 lg:h-12"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path fill="currentColor" d="M0 80V66C170 58 300 24 500 14C680 6 825 35 1000 56C1160 74 1300 54 1440 40V80H0Z" />
        </svg>
      </section>

      <section className="philosophy-section bg-white px-4 py-8 sm:px-6 sm:py-9 lg:py-10" aria-labelledby="how-we-think-heading">
        <div className="editorial-reveal editorial-reveal-4 mx-auto grid max-w-6xl gap-6 text-left md:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] md:items-start md:gap-7 lg:gap-8">
          <SectionHeader
            className="editorial-reveal editorial-reveal-1 md:sticky md:top-24 [&_h2]:max-w-[29rem] [&_h2]:text-[clamp(1.75rem,3.6vw,2.625rem)] [&_h2]:leading-[1.12] [&_p:last-child]:mt-3 [&_p:last-child]:max-w-[28rem] [&_p:last-child]:text-[0.9375rem] [&_p:last-child]:leading-[1.58] sm:[&_p:last-child]:text-base lg:[&_p:last-child]:text-base"
            eyebrow="HOW WE THINK"
            heading={<>Engineering isn&apos;t just what we build. It&apos;s how we solve problems.</>}
            headingId="how-we-think-heading"
            description="Every organization faces unique technology challenges. At Zentric Analytics, we approach each engagement with disciplined engineering, structured thinking, and a commitment to building solutions that remain reliable, secure, and valuable long after deployment."
          />

          <div className="grid gap-3 sm:grid-cols-2 sm:gap-3.5 lg:gap-4">
            {philosophyPrinciples.map((principle, index) => (
              <article
                className={`philosophy-row editorial-reveal editorial-reveal-${index + 5} group rounded-2xl border border-[#E5E7EB] bg-white p-4 transition-[background-color,border-color] duration-200 ease-out hover:border-[#10B981]/55 hover:bg-[#F8FAFC] sm:p-[18px] lg:p-5`}
                key={principle.title}
              >
                <principle.Icon
                  aria-hidden="true"
                  className="size-[1.375rem] text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981] lg:size-6"
                  strokeWidth={1.75}
                />
                <h3 className="mt-2.5 text-[1.125rem] font-bold leading-[1.18] tracking-[-0.025em] text-[#0B1F3A] sm:text-xl">
                  {principle.title}
                </h3>
                <p className="mt-1.5 text-[0.90625rem] leading-[1.55] text-[#475569] sm:text-[0.96875rem]">
                  {principle.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#DCE3EA] bg-[#F3F6F9] px-4 py-8 sm:px-6 sm:py-9 lg:py-10" aria-labelledby="core-capabilities-heading">
        <div className="mx-auto max-w-6xl">
          <SectionHeader
            className="[&_h2]:mt-2.5 [&_h2]:text-[clamp(1.75rem,3.15vw,2.5rem)] [&_h2]:leading-[1.12] [&_p:last-child]:mt-3.5 [&_p:last-child]:max-w-[46rem] [&_p:last-child]:text-[0.9375rem] [&_p:last-child]:leading-[1.58] sm:[&_p:last-child]:text-base"
            eyebrow="CORE CAPABILITIES"
            heading="Engineering expertise across software, AI, data, infrastructure, and research."
            headingId="core-capabilities-heading"
            description="Zentric Analytics brings together disciplined software engineering, artificial intelligence, data platforms, cloud infrastructure, and research-led innovation to help organizations build technology that is reliable, scalable, and future-ready."
          />

          <div className="mt-5 grid gap-x-12 sm:mt-6 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-3 lg:gap-x-16">
            {capabilities.map((capability) => (
              <div
                className="group flex items-center gap-3.5 border-b border-[#DCE3EA] py-3 text-left transition-colors duration-200 ease-out last:border-b-0 sm:[&:nth-child(3)]:border-b-0 sm:[&:nth-last-child(-n+1)]:border-b-0"
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

          <div className="mt-5 flex justify-center sm:mt-6">
            <Link className="btn zentric-primary-cta" href="/services">
              <span>Explore All Capabilities</span>
              <span className="zentric-primary-cta__arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className="why-choose-section bg-white px-4 py-12 sm:px-6 sm:py-14 lg:py-16" aria-labelledby="why-choose-heading">
        <div className="mx-auto max-w-[1280px] rounded-[28px] bg-[#0B1F3A] px-6 py-16 sm:px-8 md:px-12 lg:px-16 lg:py-20">
          <SectionHeader
            eyebrow="WHY CLIENTS CHOOSE ZENTRIC"
            heading="A disciplined approach to building technology that lasts."
            headingId="why-choose-heading"
            description="Every successful partnership begins with understanding your business, designing the right solution, building with quality, deploying with confidence, and supporting long-term growth."
            tone="dark"
            className="engineering-process-header"
          />

          <div className="relative mt-6 lg:mt-7">
            <div
              aria-hidden="true"
              className="absolute left-[26px] top-[26px] h-[calc(100%-52px)] w-0.5 bg-slate-200/30 md:left-[calc((100%-4rem)/6)] md:right-[calc((100%-4rem)/6)] md:top-[26px] md:h-0.5 md:w-auto lg:left-[calc((100%-7rem)/10)] lg:right-[calc((100%-7rem)/10)]"
            />
            <div className="relative grid items-stretch gap-y-6 pl-[70px] md:grid-cols-3 md:gap-x-7 md:gap-y-7 md:pl-0 lg:flex lg:flex-row lg:items-stretch lg:gap-x-7">
              {clientChoiceProcess.map((step) => (
                <article
                  className="engineering-process-card group relative flex min-h-[52px] w-full flex-col items-center text-center lg:flex-1"
                  key={step.title}
                >
                  <div className="absolute -left-[70px] top-0 flex size-[52px] shrink-0 items-center justify-center rounded-full border border-white/70 bg-[#F8FAFC] shadow-[0_10px_24px_rgba(2,8,23,0.18)] transition-[border-color,transform,box-shadow] duration-200 ease-out group-hover:border-[#10B981]/70 group-hover:shadow-[0_12px_26px_rgba(2,8,23,0.22)] motion-safe:group-hover:-translate-y-0.5 md:relative md:left-auto md:top-auto">
                    <step.Icon
                      aria-hidden="true"
                      className="size-[22px] shrink-0 text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981]"
                      strokeWidth={1.75}
                    />
                  </div>
                  <h3 className="mt-0 flex w-full items-start justify-center text-center text-lg font-bold leading-[1.2] tracking-[-0.025em] text-white md:mt-4 md:text-[1.0625rem] lg:min-h-0">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 w-full max-w-[24rem] text-sm leading-[1.5] text-slate-300 sm:text-[0.9375rem] md:max-w-[13rem] md:text-center">
                    {step.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        className="relative isolate overflow-hidden bg-[#F7F8FA] px-4 py-8 sm:px-6 sm:py-10 lg:py-12"
        aria-labelledby="final-cta-heading"
      >
        <div className="editorial-reveal mx-auto flex max-w-3xl flex-col items-center text-center">
          <SectionHeader
            align="center"
            eyebrow="READY TO BUILD?"
            heading={<>Let&apos;s build technology that creates lasting impact.</>}
            headingId="final-cta-heading"
            description="Whether you're looking for a trusted technology partner or exploring career opportunities, Zentric Analytics is committed to solving meaningful challenges through engineering, AI, data, cloud, and research-driven innovation."
          />
          <div
            className="final-cta-marquee mt-5 w-full max-w-3xl overflow-hidden sm:mt-6"
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
          <div className="mt-5 flex w-full flex-col items-center gap-4 sm:mt-6 sm:w-auto sm:flex-row sm:justify-center">
            <Link
              className="btn btn-primary w-full min-w-[12rem] sm:w-auto"
              href="/contact"
            >
              Start a Conversation
            </Link>
            <Link
              className="btn btn-secondary w-full min-w-[12rem] sm:w-auto"
              href="/careers"
            >
              Explore Careers
            </Link>
          </div>
        </div>
      </section>

    </PageShell>
  );
}
