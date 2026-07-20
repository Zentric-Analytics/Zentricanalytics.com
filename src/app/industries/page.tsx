import type { CSSProperties } from 'react';
import { Handshake, ShieldCheck, Target, TrendingUp, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { IndustriesWeServe } from '@/components/IndustriesWeServe';
import { OrganizationCapabilitiesReveal } from '@/components/OrganizationCapabilitiesReveal';
import { PageShell } from '@/components/PageShell';
import { ScrollReveal } from '@/components/ScrollReveal';

const organizationValues: Array<{ Icon: LucideIcon; title: string; description: string }> = [
  {
    Icon: Target,
    title: 'Tailored to Your Goals',
    description: 'Every solution is shaped around your organization’s priorities, workflows, audience, and long-term objectives.',
  },
  {
    Icon: TrendingUp,
    title: 'Built for Growth',
    description: 'We design scalable systems that can evolve with your business, institution, startup, or personal brand.',
  },
  {
    Icon: ShieldCheck,
    title: 'Secure by Design',
    description: 'Security, reliability, and responsible technology practices are considered throughout every stage of delivery.',
  },
  {
    Icon: Handshake,
    title: 'Long-Term Partnership',
    description: 'We support clients beyond launch through guidance, improvement, maintenance, and continued collaboration.',
  },
];

export default function Industries() {
  return (
    <PageShell>
      <link rel="preload" as="image" href="/images/industries/industries-hero-bg.png" fetchPriority="high" />
      <section
        className="relative isolate flex min-h-[540px] items-center overflow-hidden bg-[#0B1F3A] bg-[position:60%_center] px-4 py-12 text-white sm:min-h-[560px] sm:px-6 sm:py-16 lg:min-h-[575px] lg:bg-[position:center_right] lg:px-8 lg:py-[4.5rem]"
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
            <p className="mt-4 max-w-[43rem] text-base leading-[1.7] text-slate-100 sm:mt-5 sm:text-lg sm:leading-[1.7]">
              From enterprises and startups to public institutions and personal brands, Zentric Analytics delivers tailored technology solutions around your unique goals, challenges, and opportunities.
            </p>
            <div className="mt-6 flex flex-col gap-3.5 sm:mt-7 sm:flex-row sm:items-center sm:gap-4">
              <Link className="btn hero-cta-primary w-full sm:w-auto" href="/contact">Discuss Your Needs</Link>
            </div>
          </div>
        </div>
      </section>

      <IndustriesWeServe />

      <ScrollReveal>
        <section className="bg-white px-4 py-8 sm:px-6 sm:py-9 lg:px-8 lg:py-14" aria-labelledby="organization-capabilities-heading">
        <div className="mx-auto grid max-w-[58rem] gap-7 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] lg:items-start lg:gap-6">
          <header className="max-w-[30rem] pt-[1.125rem] text-left sm:pt-6 lg:pt-[1.125rem]">
            <h2
              id="organization-capabilities-heading"
              className="industries-child-reveal text-[1.75rem] font-bold leading-[1.12] tracking-[-0.04em] text-[#0B1F3A] sm:text-[2.125rem] lg:text-[2.625rem]"
            >
              How We Help Organizations Succeed
            </h2>
            <p className="industries-child-reveal industries-delay-1 mt-3 text-base leading-[1.6] text-[#475569] sm:text-[1.0625rem]">
              Every organization has unique goals, processes, and challenges. We combine technology, strategy, and innovation to design solutions that improve efficiency, strengthen security, accelerate growth, and create measurable business value.
            </p>
            <p className="industries-child-reveal industries-delay-2 mt-4 text-base leading-[1.6] text-[#294A43] sm:text-[1.0625rem]">
              Whether the goal is modernization, growth, stronger security, better customer experiences, or improved operations, our solutions are shaped around the organization—not a fixed industry template.
            </p>
          </header>

          <OrganizationCapabilitiesReveal />
        </div>
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <section className="bg-[#0B1F3A] px-4 py-8 sm:px-6 sm:py-9 lg:px-8 lg:py-14" aria-labelledby="organization-values-heading">
        <div className="mx-auto max-w-6xl">
          <header className="max-w-[45rem] text-left">
            <h2
              id="organization-values-heading"
              className="text-[1.75rem] font-bold leading-[1.12] tracking-[-0.04em] text-white sm:text-[2.125rem] lg:text-[2.625rem]"
            >
              Why Organizations Choose Zentric
            </h2>
            <p className="mt-2.5 max-w-[45rem] text-base leading-[1.6] text-slate-100 sm:text-[1.0625rem]">
              We do not apply the same solution to every client. Our work begins with understanding your goals, operations, audience, challenges, and opportunities before designing the right technology approach.
            </p>
          </header>

          <div className="mt-6 divide-y divide-white/10 lg:mt-7 lg:grid lg:grid-cols-4 lg:divide-x lg:divide-y-0">
            {organizationValues.map(({ Icon, title, description }, index) => (
              <article style={{ '--industries-reveal-delay': `${index * 85}ms` } as CSSProperties} className="industries-child-reveal group py-5 transition-transform duration-[225ms] ease-out lg:px-6 lg:py-0 lg:hover:-translate-y-1 first:lg:pl-0 last:lg:pr-0" key={title}>
                <div className="min-w-0">
                  <Icon aria-hidden="true" className="size-[1.375rem] text-[#5EE0BF] transition-colors duration-[225ms] ease-out lg:group-hover:text-[#7FEBD0] sm:size-6" strokeWidth={1.8} />
                  <h3 className="mt-4 text-lg font-bold leading-[1.3] tracking-[-0.025em] text-white transition-colors duration-[225ms] ease-out lg:group-hover:text-slate-100 sm:text-xl">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-[0.9375rem] leading-[1.6] text-slate-200 sm:text-base">{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <section className="bg-white px-4 py-9 sm:px-6 sm:py-11 lg:px-8 lg:py-16" aria-labelledby="industries-final-cta-heading">
        <div className="mx-auto grid max-w-6xl gap-7 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)] lg:items-center lg:gap-12">
          <div className="max-w-[44rem]">
            <h2
              id="industries-final-cta-heading"
              className="max-w-[38rem] text-[1.75rem] font-bold leading-[1.12] tracking-[-0.04em] text-[#0B1F3A] sm:text-[2.125rem] lg:text-[2.625rem]"
            >
              Whatever Your Industry, We&apos;re Ready to Build With You
            </h2>
            <p className="mt-3 max-w-[42rem] text-base leading-[1.6] text-[#475569] sm:mt-4 sm:text-[1.0625rem]">
              Whether you are an established organization, a growing startup, a public institution, a professional, a creator, or a personal brand, Zentric Analytics can design a technology solution around your goals.
            </p>
          </div>

          <div className="border-[#DCE3EA] lg:border-l lg:pl-8">
            <Link className="btn hero-cta-primary w-full sm:w-fit" href="/contact">Discuss Your Needs</Link>
            <p className="mt-3 max-w-[22rem] text-sm leading-[1.6] text-[#475569] sm:text-base">
              Tell us what you are trying to achieve, and we will help you identify the right next step.
            </p>
          </div>
        </div>
        </section>
      </ScrollReveal>
    </PageShell>
  );
}
