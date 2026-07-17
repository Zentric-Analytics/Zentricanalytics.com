import { ArrowRight, BrainCircuit, Building2, CloudCog, Code2, CodeXml, Handshake, Network, ShieldCheck, Sparkles, Target, TrendingUp, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { IndustriesWeServe } from '@/components/IndustriesWeServe';
import { PageShell } from '@/components/PageShell';
import { SectionHeader } from '@/components/SectionHeader';

const adaptationSteps: Array<{ Icon: LucideIcon; title: string; description: string }> = [
  {
    Icon: Network,
    title: 'Understand the operating model',
    description: 'We study business goals, users, processes, systems, data flows, and constraints before recommending an implementation path.',
  },
  {
    Icon: ShieldCheck,
    title: 'Respect the risk environment',
    description: 'Security, privacy, compliance, resiliency, auditability, and governance requirements are built into the architecture from the start.',
  },
  {
    Icon: Sparkles,
    title: 'Tailor the solution strategy',
    description: 'We combine engineering, AI, cloud, data, cybersecurity, and consulting capabilities based on the outcome each organization needs.',
  },
];

const organizationValues: Array<{ number: string; Icon: LucideIcon; title: string; description: string }> = [
  {
    number: '01',
    Icon: Target,
    title: 'Tailored to Your Goals',
    description: 'Every solution is shaped around your organization’s priorities, workflows, audience, and long-term objectives.',
  },
  {
    number: '02',
    Icon: TrendingUp,
    title: 'Built for Growth',
    description: 'We design scalable systems that can evolve with your business, institution, startup, or personal brand.',
  },
  {
    number: '03',
    Icon: ShieldCheck,
    title: 'Secure by Design',
    description: 'Security, reliability, and responsible technology practices are considered throughout every stage of delivery.',
  },
  {
    number: '04',
    Icon: Handshake,
    title: 'Long-Term Partnership',
    description: 'We support clients beyond launch through guidance, improvement, maintenance, and continued collaboration.',
  },
];

const organizationCapabilities: Array<{ Icon: LucideIcon; title: string; description: string }> = [
  {
    Icon: Sparkles,
    title: 'Digital Transformation',
    description:
      'Modernize business processes with scalable digital solutions that improve efficiency and prepare your organization for future growth.',
  },
  {
    Icon: Code2,
    title: 'Custom Software Development',
    description:
      'Design and build secure, scalable software tailored to your organization\'s unique workflows and objectives.',
  },
  {
    Icon: CloudCog,
    title: 'Cloud & Infrastructure',
    description:
      'Deploy reliable cloud solutions that improve performance, scalability, collaboration, and operational resilience.',
  },
  {
    Icon: BrainCircuit,
    title: 'Data & AI Solutions',
    description:
      'Transform business data into actionable insights through analytics, automation, and intelligent AI-powered solutions.',
  },
  {
    Icon: ShieldCheck,
    title: 'Cybersecurity',
    description:
      "Protect critical systems, data, and operations using modern security practices designed for today's digital landscape.",
  },
  {
    Icon: Handshake,
    title: 'IT Consulting & Support',
    description:
      'Partner with experienced technology consultants who help align technology investments with long-term business goals.',
  },
];

const capabilityApplications: Array<{ Icon: LucideIcon; title: string; description: string }> = [
  { Icon: CodeXml, title: 'Engineering', description: 'Custom platforms, portals, integrations, APIs, workflow automation, modernization, and product development.' },
  { Icon: BrainCircuit, title: 'AI & Data', description: 'Decision-support systems, analytics, intelligent automation, retrieval workflows, reporting, and data foundations.' },
  { Icon: CloudCog, title: 'Cloud & Cybersecurity', description: 'Secure infrastructure, scalable deployments, identity, monitoring, resilience, and practical security controls.' },
  { Icon: Building2, title: 'Consulting', description: 'Technical strategy, feasibility analysis, roadmap planning, process improvement, and transformation support.' },
];

const commonChallenges = [
  'Modernizing aging systems without disrupting operations',
  'Turning disconnected data into trusted insight',
  'Improving customer, employee, and stakeholder experiences',
  'Strengthening cybersecurity, compliance, and operational resilience',
  'Automating manual workflows while preserving quality and control',
  'Scaling platforms, teams, and infrastructure for long-term growth',
];

const trustReasons = [
  'Sector-aware discovery that starts with business outcomes',
  'Disciplined engineering practices for secure and maintainable systems',
  'Flexible delivery models for startups, SMBs, enterprises, agencies, and nonprofits',
  'Practical innovation that balances emerging technology with measurable value',
];

export default function Industries() {
  return (
    <PageShell>
      <section
        className="relative isolate flex min-h-[620px] items-center overflow-hidden bg-[#0B1F3A] bg-[position:60%_center] px-4 py-16 text-white sm:min-h-[640px] sm:px-6 sm:py-20 lg:min-h-[650px] lg:bg-[position:center_right] lg:px-8 lg:py-24"
        style={{
          backgroundImage: "linear-gradient(rgba(11, 31, 58, 0.8), rgba(11, 31, 58, 0.8)), url('/images/industries/industries-hero-bg.png')",
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
        }}
        aria-labelledby="industries-page-heading"
      >
        <div className="mx-auto w-full max-w-6xl">
          <div className="max-w-[44rem]">
            <h1 id="industries-page-heading" className="text-[28px] font-bold leading-[1.12] tracking-[-0.045em] sm:text-[clamp(2.35rem,4.5vw,4rem)] sm:leading-[1.06]">
              Technology Solutions for Every Industry, Organization, and Ambition
            </h1>
            <p className="mt-6 max-w-[43rem] text-base leading-[1.7] text-slate-100 sm:mt-7 sm:text-lg sm:leading-[1.7]">
              From global enterprises and growing startups to public institutions and personal brands, Zentric Analytics delivers tailored technology solutions designed around each client&apos;s unique goals, challenges, and opportunities.
            </p>
            <div className="mt-8 flex flex-col gap-3.5 sm:mt-9 sm:flex-row sm:items-center sm:gap-4">
              <Link className="btn hero-cta-primary w-full sm:w-auto" href="/contact">Discuss Your Needs</Link>
              <Link className="btn hero-cta-secondary w-full sm:w-auto" href="#industry-spectrum-heading">Explore Industries</Link>
            </div>
          </div>
        </div>
      </section>

      <IndustriesWeServe />

      <section className="bg-white px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-20" aria-labelledby="organization-capabilities-heading">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] lg:gap-16">
          <header className="max-w-[30rem] text-left">
            <h2
              id="organization-capabilities-heading"
              className="text-[1.75rem] font-bold leading-[1.12] tracking-[-0.04em] text-[#0B1F3A] sm:text-[2.125rem] lg:text-[2.625rem]"
            >
              How We Help Organizations Succeed
            </h2>
            <p className="mt-4 text-base leading-[1.6] text-[#475569] sm:text-[1.0625rem]">
              Every organization has unique goals, processes, and challenges. We combine technology, strategy, and innovation to design solutions that improve efficiency, strengthen security, accelerate growth, and create measurable business value.
            </p>
            <p className="mt-5 text-base leading-[1.6] text-[#294A43] sm:text-[1.0625rem]">
              Whether the goal is modernization, growth, stronger security, better customer experiences, or improved operations, our solutions are shaped around the organization—not a fixed industry template.
            </p>
          </header>

          <div className="border-y border-[#DCE3EA]">
            {organizationCapabilities.map(({ Icon, title, description }) => (
              <article className="group grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-3 py-5 first:pt-5 last:pb-5 not-last:border-b not-last:border-[#DCE3EA] sm:grid-cols-[3.25rem_minmax(0,1fr)] sm:gap-x-4 sm:py-6" key={title}>
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#EAF7F2] text-[#0B7F60] transition-transform duration-200 ease-out group-hover:translate-x-0.5 sm:size-11">
                  <Icon aria-hidden="true" className="size-5" strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold leading-[1.3] tracking-[-0.025em] text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#0B7F60] sm:text-xl">
                    {title}
                  </h3>
                  <p className="mt-2 text-[0.9375rem] leading-[1.6] text-[#475569] sm:text-base">
                    {description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F3F6F9] px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-20" aria-labelledby="organization-values-heading">
        <div className="mx-auto max-w-6xl">
          <header className="max-w-[47rem] text-left">
            <h2
              id="organization-values-heading"
              className="text-[1.75rem] font-bold leading-[1.12] tracking-[-0.04em] text-[#0B1F3A] sm:text-[2.125rem] lg:text-[2.625rem]"
            >
              Why Organizations Choose Zentric
            </h2>
            <p className="mt-4 max-w-[46rem] text-base leading-[1.6] text-[#475569] sm:text-[1.0625rem]">
              We do not apply the same solution to every client. Our work begins with understanding your goals, operations, audience, challenges, and opportunities before designing the right technology approach.
            </p>
          </header>

          <div className="mt-9 divide-y divide-[#DCE3EA] border-y border-[#DCE3EA] lg:mt-12 lg:grid lg:grid-cols-4 lg:divide-x lg:divide-y-0 lg:border-y-0">
            {organizationValues.map(({ number, Icon, title, description }) => (
              <article className="group grid grid-cols-[2.875rem_minmax(0,1fr)] gap-x-3 py-5 first:pt-5 last:pb-5 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-x-4 lg:block lg:px-7 lg:py-0 first:lg:pl-0 last:lg:pr-0" key={title}>
                <span className="text-2xl font-bold leading-none tracking-[-0.05em] text-[#0B7F60] sm:text-[1.75rem] lg:block">{number}</span>
                <div className="min-w-0 lg:mt-7">
                  <Icon aria-hidden="true" className="size-5 text-[#0B7F60] transition-transform duration-200 ease-out group-hover:translate-x-0.5 sm:size-[1.375rem]" strokeWidth={1.8} />
                  <h3 className="mt-3 text-lg font-bold leading-[1.3] tracking-[-0.025em] text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#0B7F60] sm:text-xl">
                    {title}
                  </h3>
                  <p className="mt-2 text-[0.9375rem] leading-[1.6] text-[#475569] sm:text-base">{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F8FAFC] px-4 py-10 sm:px-6 sm:py-12 lg:py-14" aria-labelledby="adaptation-heading">
        <div className="mx-auto max-w-6xl">
          <SectionHeader eyebrow="HOW WE ADAPT" heading="Every engagement is shaped around the organization, not the label." headingId="adaptation-heading" description="Industry context matters, but the strongest solutions come from understanding the specific operating reality behind each organization." />
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {adaptationSteps.map(({ Icon, title, description }) => (
              <article className="card p-6" key={title}>
                <Icon aria-hidden="true" className="size-7 text-[#0B1F3A]" strokeWidth={1.75} />
                <h2 className="mt-4 text-xl font-bold tracking-[-0.025em] text-[#0B1F3A]">{title}</h2>
                <p className="mt-3 leading-[1.6] text-[#475569]">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-10 sm:px-6 sm:py-12 lg:py-14" aria-labelledby="cross-industry-challenges-heading">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <SectionHeader eyebrow="COMMON CHALLENGES" heading="Different industries often face similar technology pressures." headingId="cross-industry-challenges-heading" description="Whether the organization is a healthcare provider, manufacturer, school, agency, retailer, SaaS company, nonprofit, or financial institution, many technology needs converge around reliability, insight, security, and growth." />
          <div className="grid gap-3">
            {commonChallenges.map((challenge) => (
              <div className="flex gap-3 rounded-2xl border border-[#DCE3EA] bg-white p-4 shadow-[0_8px_22px_rgba(11,31,58,0.04)]" key={challenge}>
                <ArrowRight aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#10B981]" strokeWidth={2} />
                <p className="font-semibold leading-[1.45] text-[#0B1F3A]">{challenge}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F3F6F9] px-4 py-10 sm:px-6 sm:py-12 lg:py-14" aria-labelledby="capabilities-any-sector-heading">
        <div className="mx-auto max-w-6xl">
          <SectionHeader eyebrow="CAPABILITIES ACROSS SECTORS" heading="Engineering, AI, cloud, cybersecurity, data, and consulting capabilities that apply wherever complex work happens." headingId="capabilities-any-sector-heading" description="Our work is grounded in reusable engineering discipline and adapted through industry-specific discovery, governance, and implementation details." />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {capabilityApplications.map(({ Icon, title, description }) => (
              <article className="rounded-2xl border border-[#DCE3EA] bg-white p-5" key={title}>
                <Icon aria-hidden="true" className="size-7 text-[#0B1F3A]" strokeWidth={1.75} />
                <h2 className="mt-4 text-lg font-bold text-[#0B1F3A]">{title}</h2>
                <p className="mt-2 text-sm leading-[1.6] text-[#475569]">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-10 sm:px-6 sm:py-12 lg:py-14" aria-labelledby="why-industries-choose-heading">
        <div className="mx-auto grid max-w-6xl gap-8 rounded-3xl bg-[#0B1F3A] p-6 text-white sm:p-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:p-10">
          <SectionHeader eyebrow="WHY ORGANIZATIONS CHOOSE US" heading="A partner for virtually every sector." headingId="why-industries-choose-heading" description="Clients choose Zentric Analytics because we combine enterprise-grade engineering discipline with the flexibility to meet diverse missions, markets, and maturity levels." tone="dark" />
          <div className="grid gap-3 self-center">
            {trustReasons.map((reason) => (
              <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-4 font-semibold leading-[1.5] text-slate-100" key={reason}>{reason}</div>
            ))}
            <Link className="btn mt-2 w-full bg-white text-[#0B1F3A] hover:bg-[#F8FAFC] sm:w-fit" href="/contact">Discuss Your Industry</Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
