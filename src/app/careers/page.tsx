import type { CSSProperties } from 'react';
import {
  BadgeCheck,
  BookOpenCheck,
  BrainCircuit,
  ChartNoAxesCombined,
  Code2,
  FileUser,
  FlaskConical,
  MessagesSquare,
  PanelsTopLeft,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { PageShell } from '@/components/PageShell';
import { ScrollReveal } from '@/components/ScrollReveal';

type Role = {
  Icon: LucideIcon;
  title: string;
  description: string;
  action: string;
};

const roles: Role[] = [
  {
    Icon: Code2,
    title: 'Software Engineer',
    description: 'Build reliable application features, integrations, and systems with maintainable engineering practices.',
    action: 'View Role',
  },
  {
    Icon: PanelsTopLeft,
    title: 'Web Developer',
    description: 'Create accessible, responsive web experiences that support practical business and user needs.',
    action: 'View Role',
  },
  {
    Icon: BrainCircuit,
    title: 'AI Solutions Engineer',
    description: 'Design applied AI workflows that are useful, responsible, measurable, and grounded in real problems.',
    action: 'View Role',
  },
  {
    Icon: ChartNoAxesCombined,
    title: 'Data Analyst',
    description: 'Turn structured information into clear analysis, reporting, and decisions stakeholders can trust.',
    action: 'View Role',
  },
  {
    Icon: FlaskConical,
    title: 'Research Associate',
    description: 'Support discovery, market research, documentation, and careful evaluation of technology opportunities.',
    action: 'View Role',
  },
  {
    Icon: FileUser,
    title: 'General Application',
    description: 'Share your background for future opportunities if your experience does not match a listed role.',
    action: 'Apply',
  },
];

const values: Array<{ Icon: LucideIcon; title: string; description: string }> = [
  {
    Icon: MessagesSquare,
    title: 'Clear Communication',
    description: 'Share ideas, decisions, risks, and progress clearly with teammates and stakeholders.',
  },
  {
    Icon: Wrench,
    title: 'Responsible Engineering',
    description: 'Build systems that are maintainable, secure, reliable, and appropriate for the problem.',
  },
  {
    Icon: BookOpenCheck,
    title: 'Continuous Learning',
    description: 'Stay curious, improve your craft, and learn from feedback, research, and experience.',
  },
  {
    Icon: BadgeCheck,
    title: 'Ownership and Accountability',
    description: 'Take responsibility for outcomes, follow through on commitments, and raise concerns early.',
  },
];

const hiringSteps = [
  {
    number: '01',
    title: 'Application Review',
    description: 'We review your experience, interests, and alignment with the role.',
  },
  {
    number: '02',
    title: 'Initial Conversation',
    description: 'A short discussion helps us understand your goals, experience, and expectations.',
  },
  {
    number: '03',
    title: 'Practical Assessment',
    description: 'Depending on the role, you may complete a focused technical, analytical, or problem-solving exercise.',
  },
  {
    number: '04',
    title: 'Final Discussion',
    description: 'We discuss the team, responsibilities, working expectations, and next steps.',
  },
];

export default function Careers() {
  return (
    <PageShell>
      <section className="bg-white px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24" aria-labelledby="careers-hero-heading">
        <div className="mx-auto w-full max-w-6xl">
          <div className="max-w-[46rem]">
            <h1 id="careers-hero-heading" className="text-[1.8rem] font-bold leading-[1.12] tracking-[-0.045em] text-[#0B1F3A] sm:text-[2.6rem] lg:text-[3.75rem]">
              Build Practical Technology With Care and Accountability
            </h1>
            <p className="mt-4 max-w-[44rem] text-base leading-[1.7] text-[#475569] sm:mt-5 sm:text-lg">
              Zentric Analytics looks for people who value clear communication, maintainable engineering, responsible data handling, thoughtful problem-solving, and continuous learning. If a specific role is not listed, candidates may submit a general application.
            </p>
          </div>
        </div>
      </section>

      <ScrollReveal>
        <section className="bg-[#F3F6F9] px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-16" aria-labelledby="open-roles-heading">
          <div className="mx-auto max-w-6xl">
            <header className="max-w-[45rem] text-left">
              <h2 id="open-roles-heading" className="text-[1.75rem] font-bold leading-[1.12] tracking-[-0.04em] text-[#0B1F3A] sm:text-[2.125rem] lg:text-[2.625rem]">Open Roles</h2>
              <p className="mt-3 text-base leading-[1.6] text-[#475569] sm:text-[1.0625rem]">
                Explore current opportunities or submit a general application if your experience does not match a listed role.
              </p>
            </header>

            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:mt-9 lg:grid-cols-3">
              {roles.map(({ Icon, title, description, action }, index) => (
                <Link
                  href="/apply"
                  key={title}
                  style={{ '--industries-reveal-delay': `${index * 70}ms` } as CSSProperties}
                  className="industries-child-reveal group flex min-h-[13rem] min-w-0 flex-col rounded-[1.25rem] border border-[#DCE3EA] bg-white p-5 text-left no-underline shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition duration-200 ease-out hover:-translate-y-0.5 hover:border-[#BFD0DD] hover:shadow-[0_16px_34px_rgba(15,23,42,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#10B981] sm:p-6"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#E8F5F0] text-[#0B7F60]">
                    <Icon aria-hidden="true" className="size-5" strokeWidth={1.8} />
                  </span>
                  <h3 className="mt-4 text-xl font-bold leading-[1.25] tracking-[-0.025em] text-[#0B1F3A]">{title}</h3>
                  <p className="mt-2 min-w-0 flex-1 text-[0.9375rem] leading-[1.6] text-[#475569]">{description}</p>
                  <span className="mt-4 text-sm font-bold text-[#0B7F60] transition-colors group-hover:text-[#0B1F3A]">{action}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <section className="bg-white px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-16" aria-labelledby="careers-values-heading">
          <div className="mx-auto max-w-6xl">
            <header className="max-w-[45rem] text-left">
              <h2 id="careers-values-heading" className="text-[1.75rem] font-bold leading-[1.12] tracking-[-0.04em] text-[#0B1F3A] sm:text-[2.125rem] lg:text-[2.625rem]">What We Value</h2>
              <p className="mt-3 text-base leading-[1.6] text-[#475569] sm:text-[1.0625rem]">
                We value people who approach technology with discipline, curiosity, integrity, and respect for the people affected by their work.
              </p>
            </header>

            <div className="mt-7 divide-y divide-[#DCE3EA] lg:mt-9 lg:grid lg:grid-cols-4 lg:divide-x lg:divide-y-0">
              {values.map(({ Icon, title, description }) => (
                <article className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 py-5 lg:block lg:px-6 lg:py-0 first:lg:pl-0 last:lg:pr-0" key={title}>
                  <Icon aria-hidden="true" className="mt-1 size-5 text-[#0B7F60] lg:mt-0" strokeWidth={1.8} />
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold leading-[1.3] tracking-[-0.025em] text-[#0B1F3A] lg:mt-4 sm:text-xl">{title}</h3>
                    <p className="mt-1.5 text-[0.9375rem] leading-[1.6] text-[#475569] sm:text-base">{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <section className="bg-[#F3F6F9] px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-16" aria-labelledby="hiring-process-heading">
          <div className="mx-auto max-w-6xl">
            <header className="max-w-[45rem] text-left">
              <h2 id="hiring-process-heading" className="text-[1.75rem] font-bold leading-[1.12] tracking-[-0.04em] text-[#0B1F3A] sm:text-[2.125rem] lg:text-[2.625rem]">Our Hiring Process</h2>
              <p className="mt-3 text-base leading-[1.6] text-[#475569] sm:text-[1.0625rem]">
                Our hiring process is designed to be clear, practical, and respectful of candidates’ time.
              </p>
            </header>

            <div className="mt-7 divide-y divide-[#DCE3EA] lg:mt-9 lg:grid lg:grid-cols-4 lg:divide-x lg:divide-y-0">
              {hiringSteps.map(({ number, title, description }) => (
                <article className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-4 py-5 lg:block lg:px-6 lg:py-0 first:lg:pl-0 last:lg:pr-0" key={title}>
                  <span className="text-2xl font-bold leading-none tracking-[-0.05em] text-[#0B7F60] sm:text-[1.75rem]">{number}</span>
                  <div className="min-w-0 lg:mt-5">
                    <h3 className="text-lg font-bold leading-[1.3] tracking-[-0.025em] text-[#0B1F3A] sm:text-xl">{title}</h3>
                    <p className="mt-1.5 text-[0.9375rem] leading-[1.6] text-[#475569] sm:text-base">{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <section className="bg-[#0B1F3A] px-4 py-10 text-white sm:px-6 sm:py-12 lg:px-8 lg:py-16" aria-labelledby="careers-final-cta-heading">
          <div className="mx-auto grid max-w-6xl gap-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)] lg:items-center lg:gap-12">
            <div className="max-w-[44rem]">
              <h2 id="careers-final-cta-heading" className="max-w-[40rem] text-[1.75rem] font-bold leading-[1.12] tracking-[-0.04em] sm:text-[2.125rem] lg:text-[2.625rem]">
                Ready to Build Meaningful Technology With Us?
              </h2>
              <p className="mt-3 max-w-[42rem] text-base leading-[1.6] text-slate-100 sm:mt-4 sm:text-[1.0625rem]">
                Apply for an open role, submit a general application, or track the progress of an existing application.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:items-stretch lg:border-l lg:border-white/15 lg:pl-8">
              <Link className="btn hero-cta-primary w-full" href="/apply">Apply Now</Link>
              <Link className="btn hero-cta-secondary w-full" href="/track">Track Application</Link>
            </div>
          </div>
        </section>
      </ScrollReveal>
    </PageShell>
  );
}
