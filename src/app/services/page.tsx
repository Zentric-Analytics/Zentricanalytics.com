'use client';

import Image from 'next/image';
import {
  BarChart3,
  BrainCircuit,
  Code2,
  FlaskConical,
  Globe,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { MotionLink, Reveal, Stagger } from '@/components/Motion';
import { PageShell } from '@/components/PageShell';
import { SectionHeader } from '@/components/SectionHeader';
import { FeaturedSolutions } from './FeaturedSolutions';
import { ServicesHero } from './ServicesHero';
import styles from './ServicesCapabilities.module.css';

type Service = {
  title: string;
  description: string;
  technologies: string[];
  Icon: LucideIcon;
};

const services: Service[] = [
  { title: 'Software Development', description: 'Applications, internal tools, APIs, and integrations for teams replacing manual work or extending critical systems, built to improve control and maintainability.', technologies: ['React', 'Next.js', 'Node.js'], Icon: Code2 },
  { title: 'Web Development', description: 'Websites, portals, dashboards, and content systems for organizations serving customers, staff, or partners, designed to make essential tasks easier to complete.', technologies: ['TypeScript', 'Next.js', 'Tailwind'], Icon: Globe },
  { title: 'Artificial Intelligence Solutions', description: 'AI-assisted workflows, retrieval systems, and model integrations for teams with a defined use case, implemented with evaluation, oversight, and responsible data boundaries.', technologies: ['OpenAI', 'Python', 'LangChain'], Icon: BrainCircuit },
  { title: 'Data Analytics', description: 'Data models, pipelines, quality controls, reports, and dashboards for decision-makers who need consistent measures and faster access to useful information.', technologies: ['Power BI', 'PostgreSQL', 'Python'], Icon: BarChart3 },
  { title: 'Research & Development', description: 'Prototypes, feasibility studies, and experimental systems for leaders evaluating an uncertain technical investment before committing to full delivery.', technologies: ['Python', 'TensorFlow', 'Jupyter'], Icon: FlaskConical },
  { title: 'Emerging Technology Solutions', description: 'Focused evaluation and implementation for organizations considering automation, connected devices, or new platforms, reducing uncertainty before adoption.', technologies: ['IoT', 'Automation', 'Cloud'], Icon: Sparkles },
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

const simpleIconsBaseUrl = 'https://cdn.simpleicons.org';

const technologyLogos: Record<string, string> = {
  React: `${simpleIconsBaseUrl}/react`,
  'Next.js': `${simpleIconsBaseUrl}/nextdotjs`,
  TypeScript: `${simpleIconsBaseUrl}/typescript`,
  JavaScript: `${simpleIconsBaseUrl}/javascript`,
  OpenAI: `${simpleIconsBaseUrl}/openai`,
  LangChain: `${simpleIconsBaseUrl}/langchain`,
  'Hugging Face': `${simpleIconsBaseUrl}/huggingface`,
  'Power BI': `${simpleIconsBaseUrl}/powerbi`,
  FastAPI: `${simpleIconsBaseUrl}/fastapi`,
  Django: `${simpleIconsBaseUrl}/django`,
  'Node.js': `${simpleIconsBaseUrl}/nodedotjs`,
  Python: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg',
  PostgreSQL: `${simpleIconsBaseUrl}/postgresql`,
  MongoDB: `${simpleIconsBaseUrl}/mongodb`,
  Redis: `${simpleIconsBaseUrl}/redis`,
  AWS: `${simpleIconsBaseUrl}/amazonwebservices`,
  Azure: `${simpleIconsBaseUrl}/microsoftazure`,
  'Google Cloud': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/googlecloud/googlecloud-original.svg',
  Docker: `${simpleIconsBaseUrl}/docker`,
  'GitHub Actions': `${simpleIconsBaseUrl}/githubactions`,
};

function TechnologyLogo({ technology }: { technology: string }) {
  const logo = technologyLogos[technology];

  if (!logo) return null;

  return <Image className="technology-ticker__logo" src={logo} alt="" width={24} height={24} unoptimized aria-hidden="true" />;
}

function TechnologyRow({ technologies, variant }: { technologies: string[]; variant: 'top' | 'bottom' }) {
  return (
    <div className={`technology-ticker__row technology-ticker__row--${variant}`} tabIndex={0} aria-label={`${variant === 'top' ? 'First' : 'Second'} technology list; focus to pause movement`}>
      <div className="technology-ticker__track">
        {[0, 1].map((groupIndex) => (
          <div className="technology-ticker__group" aria-hidden={groupIndex === 1} key={groupIndex}>
            {technologies.map((technology) => (
              <span className="technology-ticker__name" key={`${groupIndex}-${technology}`}>
                <TechnologyLogo technology={technology} />
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

      <section id="service-capabilities" className="mx-auto w-full max-w-6xl min-w-0 scroll-mt-20 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-10" aria-labelledby="service-capabilities-heading">
        <Reveal as="header" className="mb-7 max-w-[46rem] text-left sm:mb-8" disabled>
          <h2 id="service-capabilities-heading" className="text-[28px] font-bold leading-[1.12] tracking-[-0.04em] text-[#0B1F3A] sm:text-[30px] lg:text-[32px]">Core Service Capabilities</h2>
          <p className="mt-3 text-[14px] leading-[1.65] text-[#475569] sm:text-[15px]">A detailed view of the software, web, AI, data, research, and emerging-technology work we can design, integrate, and support.</p>
        </Reveal>
        <Stagger className={`${styles.grid} grid min-w-0 break-words text-slate-700 md:grid-cols-2`} staggerDelay={90}>
          {services.map(({ title, description, technologies, Icon }) => (
            <article className={styles.card} key={title}>
              <span className={styles.accent} aria-hidden="true" />
              <div className={styles.header}>
                <span className={styles.icon} aria-hidden="true">
                  <Icon size={20} strokeWidth={2} />
                </span>
                <h3 className={styles.title}>{title}</h3>
              </div>
              <p className={styles.description}>{description}</p>
              <ul className={styles.technologies} aria-label={`${title} technologies`}>
                {technologies.map((technology) => <li key={technology}>{technology}</li>)}
              </ul>
            </article>
          ))}
        </Stagger>
      </section>

      <section className="bg-white px-4 py-[var(--za-section-compact)] sm:px-6" aria-labelledby="technologies-heading">
        <div className="mx-auto w-full max-w-6xl min-w-0">
          <Reveal disabled>
            <SectionHeader
              eyebrow="TECHNOLOGIES"
              heading="Technology Choices That Fit the Work"
              headingId="technologies-heading"
              description="We select technologies for the required security boundaries, integration needs, performance, maintainability, and the team that will operate the system, not for novelty."
              className="technologies-header"
            />
          </Reveal>

          <TechnologyTicker />
        </div>
      </section>

      <FeaturedSolutions />

      <section
        className="bg-[#F7F9FC] px-4 py-10 sm:px-6 sm:py-12 lg:px-8"
        aria-labelledby="services-final-cta-heading"
      >
        <Stagger
          className="mx-auto grid w-full max-w-6xl gap-7 rounded-[24px] border border-white/10 bg-[#0B1F3A] p-6 shadow-[0_20px_50px_rgba(2,8,23,0.16)] sm:p-8 md:grid-cols-[minmax(0,68fr)_minmax(14rem,32fr)] md:items-center md:gap-10 lg:px-12 lg:py-10"
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

          <div className="flex min-w-0 flex-col items-start md:items-end">
            <MotionLink className="btn hero-cta-primary group w-full text-[16px] sm:w-auto" href="/contact">
              Start Your Project
              <span
                aria-hidden="true"
                className="transition-transform duration-200 ease-out group-hover:translate-x-[3px] motion-reduce:transition-none"
              >
                →
              </span>
            </MotionLink>
            <MotionLink className="mt-4 inline-flex text-sm font-bold text-[#5EE0BF] underline-offset-4 hover:underline" href="/industries">Explore how we adapt by industry</MotionLink>
          </div>
        </Stagger>
      </section>
    </PageShell>
  );
}
