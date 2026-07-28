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
      <section
        className="relative isolate h-[500px] overflow-hidden bg-[#0B1F3A] text-white sm:h-[520px] lg:h-[540px]"
        aria-labelledby="industries-page-heading"
      >
        <Image
          src="/images/industries/industries-hero-bg.webp"
          sizes="100vw"
          alt=""
          fill
          priority
          decoding="async"
          quality={75}
          className="absolute inset-0 z-0 size-full object-cover object-[62%_center] sm:object-[60%_center] lg:object-[58%_48%]"
          aria-hidden="true"
        />
        <div className="absolute inset-0 z-[1] bg-[#0B1F3A]/80" aria-hidden="true" />
        <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col justify-center px-4 pb-[40px] pt-[56px] sm:px-6 lg:px-8">
          <div className="max-w-[44rem]">
            <Reveal as="h1" id="industries-page-heading" delay={40} className="max-w-[21rem] text-[36px] font-bold leading-[1.1] tracking-[-0.04em] sm:max-w-2xl sm:text-[40px] sm:leading-[1.08] lg:max-w-3xl lg:text-[42px]">
              Technology Solutions for Every Industry, Organization, and Ambition
            </Reveal>
            <Reveal delay={120}>
              <IndustriesHeroTyping />
            </Reveal>
            <Reveal as="p" delay={200} className="mt-3 max-w-[43rem] text-[15px] leading-[1.65] text-slate-100 sm:mt-4 sm:text-[15px] sm:leading-[1.65] lg:text-[16px]">
              From enterprises and startups to public institutions and personal brands, Zentric Analytics delivers tailored technology solutions around your unique goals, challenges, and opportunities.
            </Reveal>
            <Reveal delay={280} className="mt-6 flex flex-col gap-3.5 sm:mt-7 sm:flex-row sm:items-center sm:gap-4">
              <MotionLink className="btn hero-cta-primary w-full text-[16px] sm:w-auto" href="/contact">Discuss Your Needs</MotionLink>
            </Reveal>
          </div>
        </div>
      </section>

      <IndustriesWeServe />

      <section className="bg-white px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-12" aria-labelledby="organization-capabilities-heading">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] lg:gap-6">
          <Stagger as="header" className="max-w-[30rem] text-left" staggerDelay={80}>
            <h2
              id="organization-capabilities-heading"
              className="text-[28px] font-bold leading-[1.12] tracking-[-0.04em] text-[#0B1F3A] sm:text-[30px] lg:text-[32px]"
            >
              How We Help Organizations Succeed
            </h2>
            <p className="mt-2.5 text-[14px] leading-[1.65] text-[#475569] sm:text-[15px] lg:text-[15px]">
              Every organization has unique goals, processes, and challenges. We combine technology, strategy, and innovation to design solutions that improve efficiency, strengthen security, accelerate growth, and create measurable business value.
            </p>
            <p className="mt-3 text-[14px] leading-[1.65] text-[#294A43] sm:text-[15px] lg:text-[15px]">
              Whether the goal is modernization, growth, stronger security, better customer experiences, or improved operations, our solutions are shaped around the organization, not a fixed industry template.
            </p>
          </Stagger>

          <OrganizationCapabilitiesReveal />
        </div>
      </section>

      <section className="bg-[#0B1F3A] px-4 py-8 sm:px-6 sm:py-9 lg:px-8 lg:py-14" aria-labelledby="organization-values-heading">
        <div className="mx-auto max-w-6xl">
          <Stagger as="header" className="max-w-[45rem] text-left" staggerDelay={80}>
            <h2
              id="organization-values-heading"
              className="text-[28px] font-bold leading-[1.12] tracking-[-0.04em] text-white sm:text-[30px] lg:text-[32px]"
            >
              Why Organizations Choose Zentric
            </h2>
            <p className="mt-2.5 max-w-[45rem] text-[14px] leading-[1.65] text-slate-100 sm:text-[15px]">
              We do not apply the same solution to every client. Our work begins with understanding your goals, operations, audience, challenges, and opportunities before designing the right technology approach.
            </p>
          </Stagger>

          <Stagger className="mt-6 divide-y divide-white/10 lg:mt-7 lg:grid lg:grid-cols-4 lg:divide-x lg:divide-y-0" delay={120} staggerDelay={85}>
            {organizationValues.map(({ Icon, title, description }, index) => (
              <article className="group py-5 transition-transform duration-[225ms] ease-out lg:px-6 lg:py-0 motion-safe:lg:hover:-translate-y-1 first:lg:pl-0 last:lg:pr-0" key={title}>
                <div className="min-w-0">
                  <Icon aria-hidden="true" className="size-[1.375rem] text-[#5EE0BF] transition-colors duration-[225ms] ease-out lg:group-hover:text-[#7FEBD0] sm:size-6" strokeWidth={1.8} />
                  <h3 className="mt-4 text-[18px] font-bold leading-[1.3] tracking-[-0.025em] text-white transition-colors duration-[225ms] ease-out sm:text-[19px] lg:group-hover:text-slate-100 lg:text-[20px]">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-[14px] leading-[1.6] text-slate-200 sm:text-[14px] lg:text-[15px]">{description}</p>
                </div>
              </article>
            ))}
          </Stagger>
        </div>
      </section>

      <section
          className="relative isolate overflow-hidden bg-[#0B1F3A] py-10 sm:py-12 lg:py-14"
          aria-labelledby="industries-final-cta-heading"
        >
          <Image
            src="/images/careers/careers-cta-background.webp"
            sizes="100vw"
            alt=""
            fill
            loading="lazy"
            decoding="async"
            quality={70}
            className="absolute inset-0 z-0 object-cover object-center"
            aria-hidden="true"
          />
          <div className="absolute inset-0 z-[1] bg-[rgba(8,27,52,0.40)]" aria-hidden="true" />
          <Reveal className="relative z-[2] mx-auto grid w-[calc(100%-32px)] max-w-[73.75rem] gap-7 rounded-[1.25rem] bg-white p-6 shadow-[0_28px_80px_rgba(2,8,23,0.26),0_8px_24px_rgba(15,23,42,0.14)] sm:p-7 lg:w-[calc(100%-80px)] lg:grid-cols-[minmax(0,68fr)_minmax(16rem,32fr)] lg:items-start lg:gap-12 lg:p-10">
            <Stagger className="min-w-0" staggerDelay={80}>
              <h2
                id="industries-final-cta-heading"
                className="max-w-[38rem] text-[34px] font-bold leading-[1.12] tracking-[-0.04em] text-[#0B1F3A] sm:text-[38px] lg:text-[40px]"
              >
              Your Context Should Shape the Solution
              </h2>
              <p className="mt-3 max-w-[42rem] text-[14px] leading-[1.65] text-[#475569] sm:mt-4 sm:text-[15px]">
                Whatever your sector, scale, or operating model, we begin with your users, constraints, governance needs, and goals—not a fixed technology package.
              </p>
            </Stagger>

            <Stagger className="flex min-w-0 flex-col items-stretch lg:items-start" delay={160} staggerDelay={80}>
              <MotionLink className="btn hero-cta-primary w-full text-[16px] sm:w-fit" href="/contact">Discuss Your Needs</MotionLink>
              <p className="mt-5 max-w-[22rem] text-[14px] leading-[1.65] text-[#475569] sm:mt-6 sm:text-[15px]">
                Tell us what you are trying to achieve, and we will help you identify the right next step.
              </p>
            </Stagger>
          </Reveal>
        </section>
    </PageShell>
  );
}
