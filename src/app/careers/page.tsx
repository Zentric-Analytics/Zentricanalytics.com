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

export default function Careers() {
  return (
    <PageShell>
      <div className="bg-[#F3F6F9]">
        <section className="relative isolate flex h-[360px] flex-col justify-center overflow-hidden bg-[#0B1F3A] px-4 py-6 sm:h-[390px] sm:px-6 sm:py-8 lg:h-[420px] lg:px-8 lg:py-10" aria-labelledby="careers-hero-heading">
          <Image
            src="/images/careers/careers-team-collaboration.webp"
            sizes="100vw"
            alt=""
            fill
            priority
            quality={75}
            className="absolute inset-0 -z-20 size-full object-cover object-[62%_center] sm:object-[60%_center] lg:object-[58%_48%]"
            aria-hidden="true"
          />
          <div className="absolute inset-0 -z-10 bg-[rgba(10,28,56,0.52)]" aria-hidden="true" />
          <div className="relative z-10 mx-auto w-full max-w-7xl">
            <Stagger className="max-w-[53rem] lg:max-w-[64rem]" staggerDelay={90}>
              <h1 id="careers-hero-heading" className="max-w-[21rem] text-[36px] font-bold leading-[1.12] tracking-[-0.04em] text-white sm:max-w-2xl sm:text-[40px] lg:max-w-3xl lg:text-[42px]">
                Build Useful Technology With a Team That Takes Responsibility
              </h1>
              <p className="mt-6 max-w-[41rem] text-[15px] leading-[1.7] text-white/90 sm:mt-7 lg:mt-8 lg:text-[16px]">
                Grow your craft while working with teammates who communicate directly, learn continuously, respect different perspectives, and take ownership of engineering quality.
              </p>
            </Stagger>
          </div>
        </section>
      </div>

      <section className="bg-[#F7F9FC] px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14" aria-labelledby="open-roles-heading">
        <div className="mx-auto max-w-6xl">
          <Reveal as="header" className="max-w-[720px] text-left">
            <h2 id="open-roles-heading" className="text-[28px] font-bold leading-[1.12] tracking-[-0.04em] text-[#0B1F3A] sm:text-[30px] lg:text-[32px]">Open Roles</h2>
            <p className="mt-3 max-w-[680px] text-[14px] leading-[1.6] text-[#475569] sm:text-[15px]">
              Explore current opportunities or submit a general application if your experience does not match a listed role.
            </p>
          </Reveal>

          <Stagger className="mt-8 grid grid-cols-1 gap-x-5 gap-y-[18px] md:grid-cols-2 lg:mt-10 lg:grid-cols-3" delay={120} staggerDelay={90}>
            {roles.map(({ Icon, title, description }) => (
              <article
                key={title}
                className="group flex min-w-0 flex-col rounded-[20px] border border-[#E3EAF1] bg-white p-5 text-left shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition-colors duration-200 ease-out hover:border-[#D4DEE8]"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-[16px] bg-[#EEF8F5] text-[#0B7F60]">
                    <Icon aria-hidden="true" className="size-[18px] sm:size-5" strokeWidth={1.8} />
                  </span>
                  <h3 className="min-w-0 text-[18px] font-bold leading-[1.25] tracking-[-0.02em] text-[#0B1F3A]">{title}</h3>
                </div>
                <p className="mt-3 text-[14px] font-normal leading-[1.5] text-[#475569]">{description}</p>
              </article>
            ))}
          </Stagger>

          <Reveal className="mt-7 flex flex-col items-start" delay={160}>
            <div className="flex w-full max-w-[280px] flex-col items-stretch gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:items-start sm:gap-[14px] [&_.btn]:h-[52px] [&_.btn]:rounded-[14px] [&_.btn]:px-6 [&_.btn]:text-[15px] [&_.btn]:font-bold [&_.btn]:leading-none [&_.btn-primary]:bg-[#0B1F3A] [&_.btn-primary]:text-white [&_.btn-primary]:shadow-[0_10px_22px_rgba(11,31,58,0.14)] hover:[&_.btn-primary]:bg-[#123052] hover:[&_.btn-primary]:shadow-[0_12px_26px_rgba(11,31,58,0.18)] [&_.btn-secondary]:border [&_.btn-secondary]:border-[#C8D7E5] [&_.btn-secondary]:bg-white [&_.btn-secondary]:text-[#0B1F3A] [&_.btn-secondary]:shadow-none hover:[&_.btn-secondary]:border-[#B7C9DA] hover:[&_.btn-secondary]:bg-[#F6FAFD]">
              <Link className="btn btn-primary za-button-motion w-full text-base sm:w-auto" href="/apply">Apply Now</Link>
              <Link className="btn btn-secondary za-button-motion w-full text-base sm:w-auto" href="/track">Track Application</Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-white px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16" aria-labelledby="careers-values-heading">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[36fr_64fr] lg:gap-12">
          <Reveal as="header" className="max-w-[430px] text-left" disabled>
            <h2 id="careers-values-heading" className="text-[34px] font-bold leading-[1.08] tracking-[-0.045em] text-[#0B1F3A] sm:text-[40px] lg:text-[44px]">What We Value</h2>
            <p className="mt-4 text-[14px] leading-[1.6] text-[#475569] sm:text-[15px]">
              We expect ownership, continuous learning, clear communication, careful quality, and respect for colleagues, clients, users, and the people affected by our work.
            </p>
          </Reveal>

          <Stagger className="grid grid-cols-1 divide-y divide-[#DCE3EA] md:grid-cols-2 md:divide-x md:divide-y-0 [&>article:nth-child(3)]:md:border-t [&>article:nth-child(3)]:md:border-[#DCE3EA] [&>article:nth-child(odd)]:md:border-l-0" disabled>
            {values.map(({ Icon, title, description }) => (
              <article className="px-4 py-5 transition-colors duration-200 hover:bg-[#F8FAFC] sm:p-5" key={title}>
                <Icon aria-hidden="true" className="size-5 text-[#0B7F60]" strokeWidth={1.8} />
                <h3 className="mt-4 text-[18px] font-bold leading-[1.3] tracking-[-0.025em] text-[#0B1F3A]">{title}</h3>
                <p className="mt-2 text-[14px] leading-[1.55] text-[#475569]">{description}</p>
              </article>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="border-t border-[#DCE3EA] bg-[#F7F9FC] px-4 py-10 sm:px-6 sm:py-12 lg:px-8" aria-labelledby="application-process-heading">
        <div className="mx-auto max-w-6xl">
          <Reveal as="header" className="max-w-2xl" disabled>
            <h2 id="application-process-heading" className="text-[28px] font-bold tracking-[-0.04em] text-[#0B1F3A] sm:text-[32px]">What to expect after you apply</h2>
            <p className="mt-3 text-[14px] leading-7 text-[#475569] sm:text-[15px]">We use the email on your application for confirmations, requests, and decisions. Keep your application ID to check progress securely.</p>
          </Reveal>
          <Stagger className="mt-7 grid divide-y divide-[#DCE3EA] md:grid-cols-3 md:divide-x md:divide-y-0" disabled>
            <article className="py-5 md:px-6 md:first:pl-0"><h3 className="text-lg font-bold text-[#0B1F3A]">1. Submit your application</h3><p className="mt-2 text-sm leading-6 text-[#475569]">Provide contact details, role preferences, a concise experience summary, your CV, and the required declarations.</p></article>
            <article className="py-5 md:px-6"><h3 className="text-lg font-bold text-[#0B1F3A]">2. Recruitment review</h3><p className="mt-2 text-sm leading-6 text-[#475569]">The hiring team reviews the information against current role needs. If more detail is required, we will contact you by email.</p></article>
            <article className="py-5 md:px-6 md:last:pr-0"><h3 className="text-lg font-bold text-[#0B1F3A]">3. Update or next stage</h3><p className="mt-2 text-sm leading-6 text-[#475569]">You receive an email when there is a next step. You can also use your application ID and email on the tracking page.</p></article>
          </Stagger>
        </div>
      </section>

      <section
        className="bg-[#F7F9FC] px-4 py-10 sm:px-6 sm:py-12 lg:px-8"
        aria-labelledby="careers-final-cta-heading"
      >
        <Stagger className="relative isolate mx-auto w-full max-w-[70rem] overflow-hidden rounded-[24px] bg-[#0B1F3A] p-6 shadow-[0_20px_50px_rgba(2,8,23,0.16)] sm:p-8 lg:px-12 lg:py-10" staggerDelay={90}>
          <div className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-full sm:w-2/3 lg:w-[58%]" aria-hidden="true">
            <Image
              src="/images/careers/careers-cta-background.webp"
              alt=""
              fill
              sizes="(min-width: 1024px) 41rem, (min-width: 640px) 67vw, 100vw"
              quality={75}
              className="object-cover object-center opacity-[0.06] [mask-image:linear-gradient(to_right,transparent_0%,black_62%)] sm:opacity-[0.09] sm:[mask-image:linear-gradient(to_right,transparent_0%,black_48%)] lg:opacity-[0.12] lg:[mask-image:linear-gradient(to_right,transparent_0%,black_38%)]"
            />
            <div className="absolute inset-0 bg-[#0B1F3A]/20" />
          </div>
          <div className="relative z-10 min-w-0">
            <h2 id="careers-final-cta-heading" className="max-w-[42rem] text-[30px] font-bold leading-[1.12] tracking-[-0.04em] text-white sm:text-[36px] lg:text-[40px]">
              Ready to apply?
            </h2>
            <p className="mt-3 max-w-[43rem] text-[14px] leading-[1.6] text-[#C8D7E5] sm:mt-4 sm:text-[15px]">
              Choose a listed role or submit a general application. You will receive an application ID and email confirmation after a successful submission.
            </p>
            <div className="mt-7 flex w-full max-w-[280px] flex-col gap-3 sm:max-w-none sm:flex-row">
              <Link className="btn hero-cta-primary w-full sm:w-auto" href="/apply">Apply Now</Link>
              <Link className="btn hero-cta-secondary w-full sm:w-auto" href="/track">Track Application</Link>
            </div>
          </div>
        </Stagger>
      </section>
    </PageShell>
  );
}
