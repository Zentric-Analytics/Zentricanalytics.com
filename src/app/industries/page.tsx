import { ArrowRight, BrainCircuit, Building2, CloudCog, CodeXml, Network, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { PageShell } from '@/components/PageShell';
import { SectionHeader } from '@/components/SectionHeader';

const industryGroups = [
  {
    title: 'Regulated & Mission-Critical Sectors',
    industries: ['Financial Services', 'Banking', 'Insurance', 'FinTech', 'Healthcare', 'Life Sciences', 'Pharmaceuticals', 'Government', 'Public Sector', 'Education'],
  },
  {
    title: 'Industrial, Infrastructure & Operations',
    industries: ['Manufacturing', 'Logistics', 'Transportation', 'Aviation', 'Energy', 'Utilities', 'Oil & Gas', 'Agriculture', 'Construction', 'Real Estate'],
  },
  {
    title: 'Digital Commerce, Experience & Services',
    industries: ['Retail', 'E-commerce', 'Hospitality', 'Tourism', 'Media', 'Entertainment', 'Legal Services', 'Professional Services', 'Nonprofit Organizations'],
  },
  {
    title: 'Technology & Growth Organizations',
    industries: ['Technology Companies', 'SaaS', 'Cybersecurity', 'Artificial Intelligence', 'Startups', 'Small & Medium Businesses', 'Large Enterprises', 'Emerging Industries'],
  },
];

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
      <section className="bg-[#0B1F3A] px-4 py-14 text-white sm:px-6 sm:py-16 lg:py-20" aria-labelledby="industries-page-heading">
        <div className="mx-auto max-w-6xl">
          <p className="mb-4 text-base font-bold uppercase tracking-[0.18em] text-[#10B981]">Industries</p>
          <h1 id="industries-page-heading" className="max-w-4xl text-[clamp(2.4rem,6vw,4.75rem)] font-bold leading-[1.02] tracking-[-0.055em]">
            Solutions Across Industries
          </h1>
          <p className="mt-6 max-w-4xl text-lg leading-[1.7] text-slate-100 sm:text-xl">
            Zentric Analytics delivers innovative technology solutions for organizations across virtually every industry. Rather than offering one-size-fits-all products, we tailor our expertise to each client&apos;s business objectives, operational requirements, regulatory environment, and growth strategy.
          </p>
          <p className="mt-4 max-w-4xl text-base leading-[1.7] text-slate-200 sm:text-lg">
            We collaborate with startups, small and medium-sized businesses, large enterprises, government agencies, and nonprofit organizations, helping them leverage technology to solve complex business challenges and accelerate digital transformation.
          </p>
        </div>
      </section>

      <section className="bg-white px-4 py-10 sm:px-6 sm:py-12 lg:py-14" aria-labelledby="industry-spectrum-heading">
        <div className="mx-auto max-w-6xl">
          <SectionHeader
            eyebrow="INDUSTRY SPECTRUM"
            heading="Built for flexibility, not a fixed list of sectors."
            headingId="industry-spectrum-heading"
            description="The categories below represent common areas where our work applies, but they are not limits. Zentric Analytics supports established sectors, cross-industry business models, and many other emerging industries."
            className="[&_h2]:text-[clamp(1.875rem,3.5vw,2.75rem)]"
          />
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {industryGroups.map((group) => (
              <article className="rounded-2xl border border-[#DCE3EA] bg-[#F8FAFC] p-6" key={group.title}>
                <h2 className="text-xl font-bold tracking-[-0.025em] text-[#0B1F3A]">{group.title}</h2>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  {group.industries.map((industry) => (
                    <span className="rounded-full border border-[#DCE3EA] bg-white px-3 py-1.5 text-sm font-semibold text-[#0B1F3A]" key={industry}>{industry}</span>
                  ))}
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
