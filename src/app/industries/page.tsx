import type { CSSProperties } from 'react';
import { BrainCircuit, CloudCog, Code2, Handshake, ShieldCheck, Sparkles, Target, TrendingUp, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { IndustriesWeServe } from '@/components/IndustriesWeServe';
import { PageShell } from '@/components/PageShell';
import { ScrollReveal } from '@/components/ScrollReveal';

const organizationValues: Array<{ number: string; Icon: LucideIcon; title: string; description: string }> = [
  {
    number: '01',
    Icon: Target,
    title: 'Tailored to Your Goals',
    description: 'Every solution is shaped around your organization’s priorities, workflows, audience, and long-term objectives.',
  },
  {
    number: '02',
    Icon: TrendingUp,
    title: 'Built for Growth',
    description: 'We design scalable systems that can evolve with your business, institution, startup, or personal brand.',
  },
  {
    number: '03',
    Icon: ShieldCheck,
    title: 'Secure by Design',
    description: 'Security, reliability, and responsible technology practices are considered throughout every stage of delivery.',
  },
  {
    number: '04',
    Icon: Handshake,
    title: 'Long-Term Partnership',
    description: 'We support clients beyond launch through guidance, improvement, maintenance, and continued collaboration.',
  },
];

const organizationCapabilities: Array<{ Icon: LucideIcon; title: string; description: string }> = [
  {
    Icon: Sparkles,
    title: 'Digital Transformation',
    description:
      'Modernize business processes with scalable digital solutions that improve efficiency and prepare your organization for future growth.',
  },
  {
    Icon: Code2,
    title: 'Custom Software Development',
    description:
      'Design and build secure, scalable software tailored to your organization\'s unique workflows and objectives.',
  },
  {
    Icon: CloudCog,
    title: 'Cloud & Infrastructure',
    description:
      'Deploy reliable cloud solutions that improve performance, scalability, collaboration, and operational resilience.',
  },
  {
    Icon: BrainCircuit,
    title: 'Data & AI Solutions',
    description:
      'Transform business data into actionable insights through analytics, automation, and intelligent AI-powered solutions.',
  },
  {
    Icon: ShieldCheck,
    title: 'Cybersecurity',
    description:
      "Protect critical systems, data, and operations using modern security practices designed for today's digital landscape.",
  },
  {
    Icon: Handshake,
    title: 'IT Consulting & Support',
    description:
      'Partner with experienced technology consultants who help align technology investments with long-term business goals.',
  },
];

export default function Industries() {
  return (
    <PageShell>
      <link rel="preload" as="image" href="/images/industries/industries-hero-bg.png" fetchPriority="high" />
      <section
        className="relative isolate flex min-h-[620px] items-center overflow-hidden bg-[#0B1F3A] bg-[position:60%_center] px-4 py-16 text-white sm:min-h-[640px] sm:px-6 sm:py-20 lg:min-h-[650px] lg:bg-[position:center_right] lg:px-8 lg:py-24"
        style={{
          backgroundImage: "linear-gradient(rgba(11, 31, 58, 0.8), rgba(11, 31, 58, 0.8)), url('/images/industries/industries-hero-bg.png')",
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
        }}
        aria-labelledby="industries-page-heading"
      >
        <div className="mx-auto w-full max-w-6xl">
          <div className="max-w-[44rem]">
            <h1 id="industries-page-heading" className="text-[28px] font-bold leading-[1.12] tracking-[-0.045em] sm:text-[clamp(2.35rem,4.5vw,4rem)] sm:leading-[1.06]">
              Technology Solutions for Every Industry, Organization, and Ambition
            </h1>
            <p className="mt-6 max-w-[43rem] text-base leading-[1.7] text-slate-100 sm:mt-7 sm:text-lg sm:leading-[1.7]">
              From enterprises and startups to public institutions and personal brands, Zentric Analytics delivers tailored technology solutions around your unique goals, challenges, and opportunities.
            </p>
            <div className="mt-8 flex flex-col gap-3.5 sm:mt-9 sm:flex-row sm:items-center sm:gap-4">
              <Link className="btn hero-cta-primary w-full sm:w-auto" href="/contact">Discuss Your Needs</Link>
            </div>
          </div>
        </div>
      </section>

      <IndustriesWeServe />

      <ScrollReveal>
        <section className="bg-white px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-20" aria-labelledby="organization-capabilities-heading">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] lg:gap-16">
          <header className="max-w-[30rem] text-left">
            <h2
              id="organization-capabilities-heading"
              className="industries-child-reveal text-[1.75rem] font-bold leading-[1.12] tracking-[-0.04em] text-[#0B1F3A] sm:text-[2.125rem] lg:text-[2.625rem]"
            >
              How We Help Organizations Succeed
            </h2>
            <p className="industries-child-reveal industries-delay-1 mt-4 text-base leading-[1.6] text-[#475569] sm:text-[1.0625rem]">
              Every organization has unique goals, processes, and challenges. We combine technology, strategy, and innovation to design solutions that improve efficiency, strengthen security, accelerate growth, and create measurable business value.
            </p>
            <p className="industries-child-reveal industries-delay-2 mt-5 text-base leading-[1.6] text-[#294A43] sm:text-[1.0625rem]">
              Whether the goal is modernization, growth, stronger security, better customer experiences, or improved operations, our solutions are shaped around the organization—not a fixed industry template.
            </p>
          </header>

          <div className="border-y border-[#DCE3EA]">
            {organizationCapabilities.map(({ Icon, title, description }, index) => (
              <article style={{ '--industries-reveal-delay': `${index * 75}ms` } as CSSProperties} className="industries-child-reveal group grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-3 py-5 first:pt-5 last:pb-5 not-last:border-b not-last:border-[#DCE3EA] sm:grid-cols-[3.25rem_minmax(0,1fr)] sm:gap-x-4 sm:py-6" key={title}>
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#EAF7F2] text-[#0B7F60] transition-transform duration-200 ease-out group-hover:translate-x-0.5 sm:size-11">
                  <Icon aria-hidden="true" className="size-5" strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold leading-[1.3] tracking-[-0.025em] text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#0B7F60] sm:text-xl">
                    {title}
                  </h3>
                  <p className="mt-2 text-[0.9375rem] leading-[1.6] text-[#475569] sm:text-base">
                    {description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <section className="bg-[#F3F6F9] px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-20" aria-labelledby="organization-values-heading">
        <div className="mx-auto max-w-6xl">
          <header className="max-w-[47rem] text-left">
            <h2
              id="organization-values-heading"
              className="text-[1.75rem] font-bold leading-[1.12] tracking-[-0.04em] text-[#0B1F3A] sm:text-[2.125rem] lg:text-[2.625rem]"
            >
              Why Organizations Choose Zentric
            </h2>
            <p className="mt-4 max-w-[46rem] text-base leading-[1.6] text-[#475569] sm:text-[1.0625rem]">
              We do not apply the same solution to every client. Our work begins with understanding your goals, operations, audience, challenges, and opportunities before designing the right technology approach.
            </p>
          </header>

          <div className="mt-9 divide-y divide-[#DCE3EA] lg:mt-12 lg:grid lg:grid-cols-4 lg:divide-x lg:divide-y-0">
            {organizationValues.map(({ number, Icon, title, description }, index) => (
              <article style={{ '--industries-reveal-delay': `${index * 85}ms` } as CSSProperties} className="industries-child-reveal group grid grid-cols-[2.875rem_minmax(0,1fr)] gap-x-3 py-5 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-x-4 lg:block lg:px-7 lg:py-0 first:lg:pl-0 last:lg:pr-0" key={title}>
                <span className="text-2xl font-bold leading-none tracking-[-0.05em] text-[#0B7F60] sm:text-[1.75rem] lg:block">{number}</span>
                <div className="min-w-0 lg:mt-7">
                  <Icon aria-hidden="true" className="size-5 text-[#0B7F60] transition-transform duration-200 ease-out group-hover:translate-x-0.5 sm:size-[1.375rem]" strokeWidth={1.8} />
                  <h3 className="mt-3 text-lg font-bold leading-[1.3] tracking-[-0.025em] text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#0B7F60] sm:text-xl">
                    {title}
                  </h3>
                  <p className="mt-2 text-[0.9375rem] leading-[1.6] text-[#475569] sm:text-base">{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <section className="bg-[#0B1F3A] px-4 py-12 text-white sm:px-6 sm:py-14 lg:px-8 lg:py-20" aria-labelledby="industries-final-cta-heading">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)] lg:items-center lg:gap-16">
          <div className="max-w-[44rem]">
            <h2
              id="industries-final-cta-heading"
              className="max-w-[38rem] text-[1.75rem] font-bold leading-[1.12] tracking-[-0.04em] sm:text-[2.125rem] lg:text-[2.625rem]"
            >
              Whatever Your Industry, We&apos;re Ready to Build With You
            </h2>
            <p className="mt-4 max-w-[42rem] text-base leading-[1.6] text-slate-100 sm:mt-5 sm:text-[1.0625rem]">
              Whether you are an established organization, a growing startup, a public institution, a professional, a creator, or a personal brand, Zentric Analytics can design a technology solution around your goals.
            </p>
          </div>

          <div className="border-white/15 lg:border-l lg:pl-10">
            <Link className="btn hero-cta-primary w-full sm:w-fit" href="/contact">Discuss Your Needs</Link>
            <p className="mt-4 max-w-[22rem] text-sm leading-[1.6] text-slate-300 sm:text-base">
              Tell us what you are trying to achieve, and we will help you identify the right next step.
            </p>
          </div>
        </div>
        </section>
      </ScrollReveal>
    </PageShell>
  );
}
