'use client';

import { Reveal, Stagger } from '@/components/Motion';
import { PageShell } from '@/components/PageShell';
import { SectionHeader } from '@/components/SectionHeader';
import { FeaturedSolutions } from './FeaturedSolutions';

const services = [
  ['Software Development', 'Custom applications, internal tools, APIs, integrations, and maintainable product engineering.'],
  ['Web Development', 'Responsive websites, portals, dashboards, and content systems with accessible user experiences.'],
  ['Artificial Intelligence Solutions', 'AI-assisted workflows, model integration, retrieval systems, automation, and governance-aware implementation.'],
  ['Data Analytics', 'Data modeling, reporting, KPI workflows, data quality checks, and decision-support dashboards.'],
  ['Research & Development', 'Computer science research, prototypes, technical feasibility studies, and experimental system design.'],
  ['Emerging Technology Solutions', 'Practical evaluation and implementation of new technology where it creates measurable operational value.'],
];

const topRowTechnologies = [
  'React',
  'Next.js',
  'TypeScript',
  'JavaScript',
  'OpenAI',
  'LangChain',
  'Hugging Face',
  'Power BI',
  'FastAPI',
  'Django',
];

const bottomRowTechnologies = [
  'Node.js',
  'Python',
  'PostgreSQL',
  'MongoDB',
  'Redis',
  'AWS',
  'Azure',
  'Google Cloud',
  'Docker',
  'GitHub Actions',
];

function TechnologyRow({ technologies, variant }: { technologies: string[]; variant: 'top' | 'bottom' }) {
  return (
    <div className={`technology-ticker__row technology-ticker__row--${variant}`}>
      <div className="technology-ticker__track">
        {[0, 1].map((groupIndex) => (
          <div className="technology-ticker__group" aria-hidden={groupIndex === 1} key={groupIndex}>
            {technologies.map((technology) => (
              <span className="technology-ticker__name" key={`${groupIndex}-${technology}`}>
                {technology}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function TechnologyTicker() {
  return (
    <div className="technology-ticker" aria-label="Technologies we build with">
      <TechnologyRow technologies={topRowTechnologies} variant="top" />
      <TechnologyRow technologies={bottomRowTechnologies} variant="bottom" />
    </div>
  );
}

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

      <section className="bg-white px-4 py-11 sm:px-6 sm:py-14 lg:py-[72px]" aria-labelledby="technologies-heading">
        <div className="mx-auto w-full max-w-6xl min-w-0">
          <Reveal>
            <SectionHeader
              eyebrow="TECHNOLOGIES"
              heading="Technologies We Build With"
              headingId="technologies-heading"
              description="We use modern software, cloud, data, and artificial intelligence technologies to build reliable and maintainable solutions."
              className="technologies-header"
            />
          </Reveal>

          <TechnologyTicker />
        </div>
      </section>

      <FeaturedSolutions />
    </PageShell>
  );
}
