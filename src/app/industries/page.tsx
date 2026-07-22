import Image from 'next/image';
import { Handshake, ShieldCheck, Target, TrendingUp, type LucideIcon } from 'lucide-react';
import { IndustriesHeroTyping } from '@/components/IndustriesHeroTyping';
import { IndustriesWeServe } from '@/components/IndustriesWeServe';
import { OrganizationCapabilitiesReveal } from '@/components/OrganizationCapabilitiesReveal';
import { PageShell } from '@/components/PageShell';
import { MotionLink, Reveal, Stagger } from '@/components/Motion';

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
        className="relative isolate flex min-h-[540px] items-center overflow-hidden bg-[#0B1F3A] px-4 py-12 text-white sm:min-h-[560px] sm:px-6 sm:py-16 lg:min-h-[575px] lg:px-8 lg:py-[4.5rem]"
        aria-labelledby="industries-page-heading"
      >
        <Image
          src="/images/industries/industries-hero-bg.png"
          sizes="100vw"
          alt=""
          width={1717}
          height={916}
          priority
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 -z-20 size-full object-cover object-[62%_center] sm:object-[60%_center] lg:object-[58%_48%]"
          aria-hidden="true"
        />
        <div className="absolute inset-0 -z-10 bg-[#0B1F3A]/80" aria-hidden="true" />
        <div className="mx-auto w-full max-w-6xl">
          <div className="max-w-[44rem]">
            <Reveal as="h1" id="industries-page-heading" delay={40} className="max-w-[21rem] text-[1.82rem] font-bold leading-[1.12] tracking-[-0.045em] sm:max-w-2xl sm:text-[2.15rem] sm:leading-[1.06] lg:max-w-3xl lg:text-[2.65rem]">
              Technology Solutions for Every Industry, Organization, and Ambition
            </Reveal>
            <Reveal delay={120}>
              <IndustriesHeroTyping />
            </Reveal>
            <Reveal as="p" delay={200} className="mt-3 max-w-[43rem] text-base leading-[1.7] text-slate-100 sm:mt-4 sm:text-lg sm:leading-[1.7]">
              From enterprises and startups to public institutions and personal brands, Zentric Analytics delivers tailored technology solutions around your unique goals, challenges, and opportunities.
            </Reveal>
            <Reveal delay={280} className="mt-6 flex flex-col gap-3.5 sm:mt-7 sm:flex-row sm:items-center sm:gap-4">
              <MotionLink className="btn hero-cta-primary w-full sm:w-auto" href="/contact">Discuss Your Needs</MotionLink>
            </Reveal>
          </div>
        </div>
      </section>

      <IndustriesWeServe />

      <section className="bg-[#F8FAFC] px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16" aria-labelledby="organization-capabilities-heading">
        <div className="mx-auto grid max-w-[1280px] gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
          <Stagger as="header" className="max-w-3xl text-left" staggerDelay={80}>
            <h2
              id="organization-capabilities-heading"
              className="text-xl font-bold leading-tight tracking-[-0.02em] text-[#0B1F3A] sm:text-2xl lg:text-[2rem]"
            >
              How We Help Organizations Succeed
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#475569] sm:text-base sm:leading-7">
              Every organization has unique goals, processes, and challenges. We combine technology, strategy, and innovation to design solutions that improve efficiency, strengthen security, accelerate growth, and create measurable business value.
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-[#294A43] sm:text-base sm:leading-7">
              Whether the goal is modernization, growth, stronger security, better customer experiences, or improved operations, our solutions are shaped around the organization, not a fixed industry template.
            </p>
          </Stagger>

          <OrganizationCapabilitiesReveal />
        </div>
      </section>

      <section className="bg-[#0B1F3A] px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16" aria-labelledby="organization-values-heading">
        <div className="mx-auto max-w-[1280px]">
          <Stagger as="header" className="max-w-3xl text-left" staggerDelay={80}>
            <h2
              id="organization-values-heading"
              className="text-xl font-bold leading-tight tracking-[-0.02em] text-white sm:text-2xl lg:text-[2rem]"
            >
              Why Organizations Choose Zentric
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-100 sm:text-base sm:leading-7">
              We do not apply the same solution to every client. Our work begins with understanding your goals, operations, audience, challenges, and opportunities before designing the right technology approach.
            </p>
          </Stagger>

          <Stagger className="mt-6 grid gap-4 sm:gap-5 lg:mt-8 lg:grid-cols-4 lg:gap-6" delay={120} staggerDelay={85}>
            {organizationValues.map(({ Icon, title, description }, index) => (
              <article className="group h-full rounded-[20px] border border-white/10 bg-white/5 p-4 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md sm:p-5 lg:p-6" key={title}>
                <div className="min-w-0">
                  <Icon aria-hidden="true" className="size-6 text-[#5EE0BF] transition-colors duration-[225ms] ease-out lg:group-hover:text-[#7FEBD0]" strokeWidth={1.8} />
                  <h3 className="mt-4 text-lg font-bold leading-tight tracking-[-0.02em] text-white transition-colors duration-[225ms] ease-out lg:group-hover:text-slate-100 sm:text-xl lg:text-2xl">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm font-normal leading-6 text-slate-200 sm:text-base">{description}</p>
                </div>
              </article>
            ))}
          </Stagger>
        </div>
      </section>

      <section
          className="relative overflow-hidden bg-[#0B1F3A] px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20"
          aria-labelledby="industries-final-cta-heading"
        >
          <Image
            src="/images/careers/careers-cta-background.png"
            sizes="100vw"
            alt=""
            width={1717}
            height={916}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover object-center"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-[rgba(8,27,52,0.40)]" aria-hidden="true" />
          <Reveal className="relative z-[2] mx-auto grid max-w-[1280px] gap-7 rounded-[20px] bg-white p-6 shadow-[0_28px_80px_rgba(2,8,23,0.26),0_8px_24px_rgba(15,23,42,0.14)] sm:p-7 lg:grid-cols-[minmax(0,68fr)_minmax(16rem,32fr)] lg:items-center lg:gap-12 lg:p-10">
            <Stagger className="min-w-0" staggerDelay={80}>
              <h2
                id="industries-final-cta-heading"
                className="max-w-3xl text-2xl font-bold leading-tight tracking-[-0.02em] text-[#0B1F3A] sm:text-3xl lg:text-[2.5rem]"
              >
                Whatever Your Industry, We&apos;re Ready to Build With You
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#475569] sm:mt-4 sm:text-base sm:leading-7">
                Whether you are an established organization, a growing startup, a public institution, a professional, a creator, or a personal brand, Zentric Analytics can design a technology solution around your goals.
              </p>
            </Stagger>

            <Stagger className="flex min-w-0 flex-col items-stretch lg:items-start" delay={160} staggerDelay={80}>
              <MotionLink className="btn hero-cta-primary w-full sm:w-fit" href="/contact">Discuss Your Needs</MotionLink>
              <p className="mt-5 max-w-[22rem] text-sm leading-6 text-[#475569] sm:mt-6 sm:text-base">
                Tell us what you are trying to achieve, and we will help you identify the right next step.
              </p>
            </Stagger>
          </Reveal>
        </section>
    </PageShell>
  );
}
