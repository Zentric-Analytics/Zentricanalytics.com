import { ArrowRight, BrainCircuit, Building2, CloudCog, CodeXml, Network, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react';
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
