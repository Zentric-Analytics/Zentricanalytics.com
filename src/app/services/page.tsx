'use client';

import { BarChart3, BrainCircuit, Code2, FlaskConical, Globe, Sparkles, type LucideIcon } from 'lucide-react';
import { MotionLink, Reveal, Stagger } from '@/components/Motion';
import { PageShell } from '@/components/PageShell';
import { SectionHeader } from '@/components/SectionHeader';
import { FeaturedSolutions } from './FeaturedSolutions';
import { ServicesHero } from './ServicesHero';
import styles from './ServicesCapabilities.module.css';

type Service = {
  title: string;
  description: string;
  category: string;
  technologies: string[];
  Icon: LucideIcon;
};

const services: Service[] = [
  { title: 'Software Development', description: 'Custom applications, internal tools, APIs, integrations, and maintainable product engineering.', category: 'ENGINEERING', technologies: ['React', 'Next.js', 'Node.js'], Icon: Code2 },
  { title: 'Web Development', description: 'Responsive websites, portals, dashboards, and content systems with accessible user experiences.', category: 'WEB', technologies: ['TypeScript', 'Next.js', 'Tailwind'], Icon: Globe },
  { title: 'Artificial Intelligence Solutions', description: 'AI-assisted workflows, model integration, retrieval systems, automation, and governance-aware implementation.', category: 'AI', technologies: ['OpenAI', 'Python', 'LangChain'], Icon: BrainCircuit },
  { title: 'Data Analytics', description: 'Data modeling, reporting, KPI workflows, data quality checks, and decision-support dashboards.', category: 'DATA', technologies: ['Power BI', 'PostgreSQL', 'Python'], Icon: BarChart3 },
  { title: 'Research & Development', description: 'Computer science research, prototypes, technical feasibility studies, and experimental system design.', category: 'RESEARCH', technologies: ['Python', 'TensorFlow', 'Jupyter'], Icon: FlaskConical },
  { title: 'Emerging Technology Solutions', description: 'Practical evaluation and implementation of new technology where it creates measurable operational value.', category: 'INNOVATION', technologies: ['IoT', 'Automation', 'Cloud'], Icon: Sparkles },
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
      <ServicesHero />

      <section className="mx-auto w-full max-w-6xl min-w-0 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-10" aria-label="Service offerings">
        <Stagger className={`${styles.grid} grid min-w-0 break-words text-slate-700 md:grid-cols-2`} staggerDelay={90}>
          {services.map(({ title, description, category, technologies, Icon }) => (
            <article className={styles.card} key={title}>
              <span className={styles.accent} aria-hidden="true" />
              <span className={styles.icon} aria-hidden="true">
                <Icon size={22} strokeWidth={2} />
              </span>
              <p className={styles.category}>{category}</p>
              <h2 className={styles.title}>{title}</h2>
              <p className={styles.description}>{description}</p>
              <ul className={styles.technologies} aria-label={`${title} technologies`}>
                {technologies.map((technology) => <li key={technology}>{technology}</li>)}
              </ul>
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

      <section
        className="bg-[#0B1F3A] px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16"
        aria-labelledby="services-final-cta-heading"
      >
        <Stagger
          className="mx-auto grid w-full max-w-6xl gap-7 rounded-[20px] border border-white/10 bg-white/[0.035] p-6 shadow-[0_20px_50px_rgba(2,8,23,0.18)] sm:p-8 md:grid-cols-[minmax(0,68fr)_minmax(14rem,32fr)] md:items-center md:gap-10 lg:px-12 lg:py-11"
          staggerDelay={90}
        >
          <div className="min-w-0">
            <h2
              id="services-final-cta-heading"
              className="max-w-[42rem] text-[30px] font-bold leading-[1.12] tracking-[-0.04em] text-white sm:text-[36px] lg:text-[40px]"
            >
              Ready to Build a Solution Around Your Business?
            </h2>
            <p className="mt-3 max-w-[44rem] text-[15px] leading-[1.65] text-white/90 sm:mt-4 lg:text-[16px] lg:leading-[1.7]">
              Tell us what you are planning, what is slowing your team down, or what you want to improve. Zentric Analytics can help you identify the right software, AI, data, or cloud approach.
            </p>
          </div>

          <div className="flex min-w-0 md:justify-end">
            <MotionLink className="btn hero-cta-primary group w-full text-[16px] sm:w-auto" href="/contact">
              Start a Project
              <span
                aria-hidden="true"
                className="transition-transform duration-200 ease-out group-hover:translate-x-[3px] motion-reduce:transition-none"
              >
                →
              </span>
            </MotionLink>
          </div>
        </Stagger>
      </section>
    </PageShell>
  );
}
