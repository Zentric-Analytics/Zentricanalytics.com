import { Braces, LifeBuoy, Network, Rocket, Search, ShieldCheck, type LucideIcon } from 'lucide-react';
import { Reveal, Stagger } from '@/components/Motion';
import { PageShell } from '@/components/PageShell';
import { SectionHeader } from '@/components/SectionHeader';

const services = [
  ['Software Development', 'Custom applications, internal tools, APIs, integrations, and maintainable product engineering.'],
  ['Web Development', 'Responsive websites, portals, dashboards, and content systems with accessible user experiences.'],
  ['Artificial Intelligence Solutions', 'AI-assisted workflows, model integration, retrieval systems, automation, and governance-aware implementation.'],
  ['Data Analytics', 'Data modeling, reporting, KPI workflows, data quality checks, and decision-support dashboards.'],
  ['Research & Development', 'Computer science research, prototypes, technical feasibility studies, and experimental system design.'],
  ['Emerging Technology Solutions', 'Practical evaluation and implementation of new technology where it creates measurable operational value.'],
];

const engineeringProcess: Array<{ Icon: LucideIcon; title: string; description: string }> = [
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

export default function Services() {
  return (
    <PageShell>
      <section className="mx-auto w-full max-w-6xl min-w-0 px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
        <Stagger className="min-w-0" staggerDelay={90}>
          <p className="mb-3 min-w-0 break-words text-sm font-bold uppercase tracking-[0.18em] text-accent">Services</p>
          <h1 className="mb-5 max-w-3xl break-words text-[1.82rem] font-bold tracking-tight text-ink sm:text-[2.15rem] lg:text-[2.65rem]">
            Technology services with disciplined implementation.
          </h1>
        </Stagger>

        <Stagger className="grid min-w-0 gap-5 break-words text-slate-700 md:grid-cols-2" staggerDelay={90}>
          {services.map(([t, d]) => (
            <article
              className="card za-hover za-hover-lift group p-6 hover:shadow-[0_16px_34px_rgba(11,31,58,0.10)]"
              key={t}
            >
              <h2 className="text-lg font-bold text-ink sm:text-xl lg:text-2xl">{t}</h2>
              <p className="mt-3 text-sm sm:text-[0.9375rem]">{d}</p>
            </article>
          ))}
        </Stagger>
      </section>

      <section className="bg-white px-4 py-10 sm:px-6 sm:py-12 lg:py-14" aria-labelledby="engineering-process-heading">
        <div className="mx-auto max-w-6xl rounded-2xl sm:rounded-3xl bg-[#122746] p-6 text-white shadow-[0_12px_30px_rgba(11,31,58,0.10)] sm:shadow-[0_24px_60px_rgba(11,31,58,0.16)] sm:p-8 lg:p-10">
          <Reveal>
            <SectionHeader
              eyebrow="ENGINEERING PROCESS"
              heading="Every successful solution begins with a disciplined engineering process."
              headingId="engineering-process-heading"
              description="Every engagement follows a structured workflow designed to reduce risk, improve collaboration, and deliver technology that remains reliable, maintainable, and scalable over time."
              className="engineering-process-header [&_h2]:text-xl sm:[&_h2]:text-2xl lg:[&_h2]:text-[2rem] [&_h2]:leading-[1.12]"
              tone="dark"
            />
          </Reveal>

          <div className="relative mt-4 md:mt-6 lg:mt-7">
            <div
              aria-hidden="true"
              className="absolute left-[22px] top-[22px] h-[calc(100%-44px)] w-[1.5px] bg-white/20 md:left-[calc((100%-4rem)/6)] md:right-[calc((100%-4rem)/6)] md:top-[26px] md:h-0.5 md:w-auto md:bg-white/25 lg:left-[calc((100%-8.75rem)/12)] lg:right-[calc((100%-8.75rem)/12)]"
            />
            <Stagger className="relative grid items-stretch gap-y-3 pl-[58px] md:grid-cols-3 md:gap-x-7 md:gap-y-7 md:pl-0 lg:flex lg:flex-row lg:items-stretch lg:gap-x-7" staggerDelay={90}>
              {engineeringProcess.map((step) => (
                <article
                  className="engineering-process-card group relative flex min-h-[44px] w-full flex-col items-center text-center md:min-h-[52px] lg:flex-1"
                  key={step.title}
                >
                  <div className="absolute -left-[58px] top-0 flex size-[44px] shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/[0.10] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_14px_30px_rgba(0,0,0,0.20)] backdrop-blur transition-[border-color,transform,box-shadow,background-color] duration-200 ease-out group-hover:border-white/40 group-hover:bg-white/[0.14] group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.20),0_18px_34px_rgba(0,0,0,0.24)] motion-safe:group-hover:-translate-y-0.5 md:relative md:left-auto md:top-auto md:size-[52px]">
                    <step.Icon
                      aria-hidden="true"
                      className="size-[22px] shrink-0 text-white transition-colors duration-200 ease-out group-hover:text-[#10B981]"
                      strokeWidth={1.75}
                    />
                  </div>
                  <h3 className="mt-0 flex w-full items-start justify-center text-center text-lg font-bold leading-[1.2] tracking-[-0.025em] text-white md:mt-4 sm:text-[1.1875rem] lg:min-h-0 lg:text-[1.25rem]">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 w-full max-w-[24rem] text-sm leading-[1.5] text-white/[0.82] sm:text-[0.9375rem] md:max-w-[13rem] md:text-center">
                    {step.description}
                  </p>
                </article>
              ))}
            </Stagger>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
