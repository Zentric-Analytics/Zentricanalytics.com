import { ChartNoAxesCombined, HeartHandshake, RefreshCcw, ShieldCheck, TrendingUp, Workflow, type LucideIcon } from 'lucide-react';
import { Stagger } from '@/components/Motion';

const organizationCapabilities: Array<{ Icon: LucideIcon; title: string; description: string }> = [
  {
    Icon: RefreshCcw,
    title: 'Modernize Legacy Operations',
    description:
      'Replace fragile processes in practical stages while protecting continuity, institutional knowledge, and essential services.',
  },
  {
    Icon: HeartHandshake,
    title: 'Improve Service Delivery',
    description:
      'Reduce friction for customers, staff, citizens, or members by shaping tools around the people who rely on them.',
  },
  {
    Icon: ChartNoAxesCombined,
    title: 'Strengthen Decision-Making',
    description:
      'Make trusted information easier to access and interpret so teams can act with greater clarity and confidence.',
  },
  {
    Icon: ShieldCheck,
    title: 'Protect Sensitive Information',
    description:
      'Build security, privacy, governance, and responsible data handling into decisions from the outset.',
  },
  {
    Icon: TrendingUp,
    title: 'Support Sustainable Growth',
    description:
      'Create foundations that can adapt as demand, teams, services, and organizational priorities change.',
  },
  {
    Icon: Workflow,
    title: 'Increase Operational Resilience',
    description:
      'Reduce avoidable disruption through maintainable systems, clearer workflows, and dependable support practices.',
  },
];

export function OrganizationCapabilitiesReveal() {
  return (
    <Stagger className="border-y border-[#DCE3EA]" delay={120} staggerDelay={75}>
      {organizationCapabilities.map(({ Icon, title, description }) => (
          <article className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-3 py-4 not-last:border-b not-last:border-[#DCE3EA] sm:py-[18px]" key={title}>
              <span className="flex size-10 items-center justify-center text-[#0B7F60]">
                <Icon aria-hidden="true" className="size-[1.375rem]" strokeWidth={1.8} />
              </span>
              <div className="min-w-0 pt-1">
                <h3 className="text-[18px] font-semibold leading-[1.3] tracking-[-0.025em] text-[#0B1F3A] sm:text-[19px] lg:text-[20px]">
                  {title}
                </h3>
                <p className="mt-1.5 text-[14px] leading-[1.6] text-[#475569] lg:text-[15px]">{description}</p>
              </div>
          </article>
      ))}
    </Stagger>
  );
}
