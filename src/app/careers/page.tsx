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
import Image from 'next/image';
import Link from 'next/link';
import { PageShell } from '@/components/PageShell';
import { Reveal, Stagger } from '@/components/Motion';

type Role = {
  Icon: LucideIcon;
  title: string;
  description: string;
};

const roles: Role[] = [
  {
    Icon: Code2,
    title: 'Software Engineer',
    description: 'Build reliable application features, integrations, and systems with maintainable engineering practices.',
  },
  {
    Icon: PanelsTopLeft,
    title: 'Web Developer',
    description: 'Create accessible, responsive web experiences that support practical business and user needs.',
  },
  {
    Icon: BrainCircuit,
    title: 'AI Solutions Engineer',
    description: 'Design applied AI workflows that are useful, responsible, measurable, and grounded in real problems.',
  },
  {
    Icon: ChartNoAxesCombined,
    title: 'Data Analyst',
    description: 'Turn structured information into clear analysis, reporting, and decisions stakeholders can trust.',
  },
  {
    Icon: FlaskConical,
    title: 'Research Associate',
    description: 'Support discovery, market research, documentation, and careful evaluation of technology opportunities.',
  },
  {
    Icon: FileUser,
    title: 'General Application',
    description: 'Share your background for future opportunities if your experience does not match a listed role.',
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
      <div className="bg-[#F3F6F9]">
        <section className="relative isolate flex min-h-[420px] items-center overflow-hidden bg-[#0B1F3A] px-4 py-16 sm:min-h-[550px] sm:px-6 sm:py-20 lg:min-h-[610px] lg:px-8 lg:py-24" aria-labelledby="careers-hero-heading">
          <Image
            src="/images/careers/careers-team-collaboration.png"
            sizes="100vw"
            alt=""
            width={1536}
            height={1024}
            priority
            className="absolute inset-0 -z-20 size-full object-cover object-[62%_center] sm:object-[60%_center] lg:object-[58%_48%]"
            aria-hidden="true"
          />
          <div className="absolute inset-0 -z-10 bg-[rgba(10,28,56,0.52)]" aria-hidden="true" />
          <div className="relative z-10 mx-auto w-full max-w-7xl">
            <Stagger className="max-w-[53rem] lg:max-w-[64rem]" staggerDelay={90}>
              <h1 id="careers-hero-heading" className="max-w-[21rem] text-[1.82rem] font-bold leading-[1.14] tracking-[-0.045em] text-white sm:max-w-2xl sm:text-[2.15rem] lg:max-w-3xl lg:text-[2.65rem] lg:leading-[1.11] lg:tracking-[-0.04em]">
                Build Practical Technology With Care and Accountability
              </h1>
              <p className="mt-6 max-w-[41rem] text-base leading-[1.7] text-white/90 sm:mt-7 sm:text-lg lg:mt-8">
                Zentric Analytics looks for people who value clear communication, maintainable engineering, responsible data handling, thoughtful problem-solving, and continuous learning. If a specific role is not listed, candidates may submit a general application.
              </p>
            </Stagger>
          </div>
        </section>
      </div>

      <section className="relative z-20 -mt-5 rounded-t-[28px] bg-white px-4 py-12 sm:-mt-7 sm:rounded-t-[36px] sm:px-6 sm:py-14 lg:-mt-8 lg:rounded-t-[44px] lg:px-8 lg:py-16" aria-labelledby="open-roles-heading">
        <div className="mx-auto max-w-[1280px]">
            <Reveal as="header" className="max-w-3xl text-left">
              <h2 id="open-roles-heading" className="text-xl font-bold leading-tight tracking-[-0.02em] text-[#0B1F3A] sm:text-2xl lg:text-[2rem]">Open Roles</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#475569] sm:text-base sm:leading-7">
                Explore current opportunities or submit a general application if your experience does not match a listed role.
              </p>
            </Reveal>

            <Stagger className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:mt-10 lg:grid-cols-3 lg:gap-6" delay={120} staggerDelay={90}>
              {roles.map(({ Icon, title, description }) => (
                <article
                  key={title}
                  tabIndex={0}
                  className="group flex h-full min-w-0 flex-col rounded-[20px] border border-slate-200/80 bg-white p-4 text-left shadow-sm outline-none transition-all duration-300 ease-out hover:-translate-y-1 hover:bg-[#07133F] hover:shadow-md focus-visible:-translate-y-1 focus-visible:bg-[#07133F] focus-visible:shadow-md focus-visible:ring-2 focus-visible:ring-[#07133F] focus-visible:ring-offset-2 sm:p-5 lg:p-6"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E8F5F0] text-[#07133F] transition-colors duration-300 ease-out group-hover:bg-white group-focus-visible:bg-white">
                    <Icon aria-hidden="true" className="size-5" strokeWidth={1.8} />
                  </span>
                  <h3 className="mt-4 text-lg font-bold leading-tight text-[#0B1F3A] transition-colors duration-300 ease-out group-hover:text-white group-focus-visible:text-white sm:text-xl lg:text-2xl">{title}</h3>
                  <p className="mt-3 min-w-0 text-sm leading-6 text-[#475569] transition-colors duration-300 ease-out group-hover:text-white/85 group-focus-visible:text-white/85 sm:text-base">{description}</p>
                </article>
              ))}
            </Stagger>

            <Reveal className="mx-auto mt-8 flex max-w-[34rem] flex-col items-center text-center lg:mt-10" delay={160}>
              <Link className="btn hero-cta-primary za-button-motion min-h-12 w-full rounded-full px-6 sm:w-auto sm:min-w-[11rem] sm:px-7" href="/apply">Apply Now</Link>
              <p className="mt-4 text-sm leading-6 text-[#475569] sm:text-base">
                Don&apos;t see a suitable role? Submit a general application and we&apos;ll keep your profile on file for future opportunities.
              </p>
            </Reveal>
        </div>
      </section>

      <section className="border-t border-slate-200/70 bg-[#F8FAFC] px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16" aria-labelledby="careers-values-heading">
        <div className="mx-auto max-w-[1280px]">
            <Reveal as="header" className="max-w-3xl text-left">
              <h2 id="careers-values-heading" className="text-xl font-bold leading-tight tracking-[-0.02em] text-[#0B1F3A] sm:text-2xl lg:text-[2rem]">What We Value</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#475569] sm:text-base sm:leading-7">
                We value people who approach technology with discipline, curiosity, integrity, and respect for the people affected by their work.
              </p>
            </Reveal>

            <Stagger className="mt-8 grid gap-4 sm:gap-5 lg:mt-10 lg:grid-cols-4 lg:gap-6" delay={120} staggerDelay={90}>
              {values.map(({ Icon, title, description }) => (
                <article className="group rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md sm:p-5 lg:p-6" key={title}>
                  <Icon aria-hidden="true" className="size-5 text-[#0B7F60] transition-[filter] duration-200 ease-out group-hover:brightness-110" strokeWidth={1.8} />
                  <div className="min-w-0">
                    <h3 className="mt-4 text-lg font-bold leading-tight tracking-[-0.02em] text-[#0B1F3A] sm:text-xl lg:text-2xl">{title}</h3>
                    <p className="mt-3 text-sm leading-6 text-[#475569] sm:text-base">{description}</p>
                  </div>
                </article>
              ))}
            </Stagger>
        </div>
      </section>

      <section className="bg-white px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16" aria-labelledby="hiring-process-heading">
          <div className="mx-auto max-w-[1280px]">
            <Reveal as="header" className="max-w-3xl text-left">
              <h2 id="hiring-process-heading" className="text-xl font-bold leading-tight tracking-[-0.02em] text-[#0B1F3A] sm:text-2xl lg:text-[2rem]">Our Hiring Process</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#475569] sm:text-base sm:leading-7">
                Our hiring process is designed to be clear, practical, and respectful of candidates’ time.
              </p>
            </Reveal>

            <Stagger className="mt-8 grid gap-4 sm:gap-5 lg:mt-10 lg:grid-cols-4 lg:gap-6" delay={120} staggerDelay={90}>
              {hiringSteps.map(({ number, title, description }) => (
                <article className="rounded-[20px] border border-slate-200/80 p-4 sm:p-5 lg:p-6" key={title}>
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F5F0] text-base font-bold leading-none tracking-[-0.02em] text-[#0B7F60]">{number}</span>
                  <div className="mt-4 min-w-0">
                    <h3 className="text-lg font-bold leading-tight tracking-[-0.02em] text-[#0B1F3A] sm:text-xl lg:text-2xl">{title}</h3>
                    <p className="mt-3 text-sm leading-6 text-[#475569] sm:text-base">{description}</p>
                  </div>
                </article>
              ))}
            </Stagger>
        </div>
      </section>

      <section
        className="relative isolate flex items-center overflow-hidden bg-[#0B1F3A] px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20"
        aria-labelledby="careers-final-cta-heading"
      >
        <Image
          src="/images/careers/careers-cta-background.png"
          sizes="100vw"
          alt=""
          width={1717}
          height={916}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 -z-20 size-full object-cover object-center"
          aria-hidden="true"
        />
        <div className="absolute inset-0 -z-10 bg-[rgba(10,28,56,0.38)]" aria-hidden="true" />


        <Stagger className="mx-auto grid w-full max-w-[1280px] gap-6 rounded-[20px] bg-white p-4 shadow-[0_24px_64px_rgba(2,8,23,0.24)] sm:p-5 lg:grid-cols-[minmax(0,65fr)_minmax(18rem,35fr)] lg:items-center lg:gap-0 lg:p-6" staggerDelay={90}>
            <div className="min-w-0 lg:pr-12">
              <h2 id="careers-final-cta-heading" className="max-w-3xl text-2xl font-bold leading-tight tracking-[-0.02em] text-[#0B1F3A] sm:text-3xl lg:text-[2.5rem]">
                Ready to Build Meaningful Technology With Us?
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#475569] sm:mt-4 sm:text-base sm:leading-7">
                Join a team that values practical engineering, continuous learning, thoughtful collaboration, and building technology that creates lasting impact.
              </p>
            </div>

            <div className="flex min-w-0 flex-col gap-4 lg:border-l lg:border-[#DCE3EA] lg:pl-12">
              <Link className="btn hero-cta-primary za-button-motion min-h-12 w-full rounded-full px-6 sm:px-7" href="/apply">Apply Now</Link>
              <Link className="btn hero-cta-secondary za-button-motion min-h-12 w-full rounded-full px-6 sm:px-7" href="/track">Track Application</Link>
              <p className="text-sm leading-6 text-[#475569] sm:text-base">
                Whether you&apos;re applying for an open position or submitting a general application, we&apos;d love to learn more about you.
              </p>
            </div>
        </Stagger>
      </section>
    </PageShell>
  );
}
