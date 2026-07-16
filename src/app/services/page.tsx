import { Braces, LifeBuoy, Network, Rocket, Search, ShieldCheck, type LucideIcon } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { Section } from '@/components/Section';
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
      <Section eyebrow="Services" title="Technology services with disciplined implementation.">
        <div className="grid gap-5 md:grid-cols-2">
          {services.map(([t, d]) => (
            <article className="card p-6" key={t}>
              <h2 className="text-xl font-bold text-ink">{t}</h2>
              <p className="mt-3">{d}</p>
            </article>
          ))}
        </div>
      </Section>

      <section className="bg-white px-4 py-10 sm:px-6 sm:py-12 lg:py-14" aria-labelledby="engineering-process-heading">
        <div className="mx-auto max-w-6xl rounded-3xl bg-[#122746] p-6 text-white shadow-[0_24px_60px_rgba(11,31,58,0.16)] sm:p-8 lg:p-10">
          <SectionHeader
            eyebrow="ENGINEERING PROCESS"
            heading="Every successful solution begins with a disciplined engineering process."
            headingId="engineering-process-heading"
            description="Every engagement follows a structured workflow designed to reduce risk, improve collaboration, and deliver technology that remains reliable, maintainable, and scalable over time."
            className="engineering-process-header [&_h2]:text-[clamp(1.875rem,3.2vw,2.5rem)] [&_h2]:leading-[1.12]"
            tone="dark"
          />

          <div className="relative mt-4 md:mt-6 lg:mt-7">
            <div
              aria-hidden="true"
              className="absolute left-[22px] top-[22px] h-[calc(100%-44px)] w-[1.5px] bg-white/20 md:left-[calc((100%-4rem)/6)] md:right-[calc((100%-4rem)/6)] md:top-[26px] md:h-0.5 md:w-auto md:bg-white/25 lg:left-[calc((100%-8.75rem)/12)] lg:right-[calc((100%-8.75rem)/12)]"
            />
            <div className="relative grid items-stretch gap-y-3 pl-[58px] md:grid-cols-3 md:gap-x-7 md:gap-y-7 md:pl-0 lg:flex lg:flex-row lg:items-stretch lg:gap-x-7">
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
                  <h3 className="mt-0 flex w-full items-start justify-center text-center text-lg font-bold leading-[1.2] tracking-[-0.025em] text-white md:mt-4 md:text-[1.0625rem] lg:min-h-0">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 w-full max-w-[24rem] text-sm leading-[1.5] text-white/[0.82] sm:text-[0.9375rem] md:max-w-[13rem] md:text-center">
                    {step.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
