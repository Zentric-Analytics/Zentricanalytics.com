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

      <section className="bg-[#F8FAFC] px-4 py-8 sm:px-6 sm:py-10 lg:py-12" aria-labelledby="engineering-process-heading">
        <div className="mx-auto max-w-6xl">
          <SectionHeader
            eyebrow="ENGINEERING PROCESS"
            heading="Every successful solution begins with a disciplined engineering process."
            headingId="engineering-process-heading"
            description="Every engagement follows a structured workflow designed to reduce risk, improve collaboration, and deliver technology that remains reliable, maintainable, and scalable over time."
            className="engineering-process-header [&_h2]:text-[clamp(1.875rem,3.2vw,2.5rem)] [&_h2]:leading-[1.12]"
          />

          <div className="relative mt-6 lg:mt-7">
            <div
              aria-hidden="true"
              className="absolute left-[26px] top-[26px] h-[calc(100%-52px)] w-0.5 bg-[#DCE3EA] md:left-[calc((100%-4rem)/6)] md:right-[calc((100%-4rem)/6)] md:top-[26px] md:h-0.5 md:w-auto lg:left-[calc((100%-8.75rem)/12)] lg:right-[calc((100%-8.75rem)/12)]"
            />
            <div className="relative grid items-stretch gap-y-6 pl-[70px] md:grid-cols-3 md:gap-x-7 md:gap-y-7 md:pl-0 lg:flex lg:flex-row lg:items-stretch lg:gap-x-7">
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
                  <h3 className="mt-0 flex w-full items-start justify-center text-center text-lg font-bold leading-[1.2] tracking-[-0.025em] text-[#0B1F3A] md:mt-4 md:text-[1.0625rem] lg:min-h-0">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 w-full max-w-[24rem] text-sm leading-[1.5] text-[#475569] sm:text-[0.9375rem] md:max-w-[13rem] md:text-center">
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
