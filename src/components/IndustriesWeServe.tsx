'use client';

import { useState } from 'react';
import {
  Banknote,
  Bolt,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  Factory,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  MonitorCog,
  ShoppingBag,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { Stagger } from '@/components/Motion';

type Industry = {
  Icon: LucideIcon;
  title: string;
  description: string;
};

const industries: Industry[] = [
  { Icon: Banknote, title: 'Financial Services', description: 'High-volume transactions, sensitive records, auditability, and regulatory review require controlled access and traceable decisions. We prioritize resilient workflows, governance, and accurate reporting.' },
  { Icon: HeartPulse, title: 'Healthcare', description: 'Clinical and administrative users need timely information without weakening privacy or continuity of care. We design around role-based access, interoperability, and dependable service delivery.' },
  { Icon: ShoppingBag, title: 'Retail & E-commerce', description: 'Customers expect simple purchasing while operators need accurate inventory, fulfilment, and performance data. We connect these workflows to reduce friction and improve visibility.' },
  { Icon: Factory, title: 'Manufacturing', description: 'Production environments depend on uptime, safety, equipment constraints, and usable shop-floor workflows. We introduce changes in stages and measure throughput, quality, and disruption.' },
  { Icon: GraduationCap, title: 'Education', description: 'Learners, educators, administrators, and guardians have different access and accessibility needs. We simplify learning and administrative tasks while respecting institutional governance.' },
  { Icon: Landmark, title: 'Government & Public Sector', description: 'Public services require accessibility, accountability, procurement discipline, and continuity across varied users. We emphasize transparent workflows, maintainable delivery, and responsible data handling.' },
  { Icon: MonitorCog, title: 'Technology & SaaS', description: 'Digital product teams balance release speed with reliability, tenant boundaries, and operating cost. We strengthen product delivery, platform observability, and maintainable growth.' },
  { Icon: House, title: 'Real Estate', description: 'Property teams coordinate listings, documents, payments, maintenance, and many stakeholders. We create clearer workflows and a dependable view of operational information.' },
  { Icon: Bolt, title: 'Energy & Utilities', description: 'Asset-heavy operations require continuity, field usability, monitoring, and careful change control. We design for dependable information flow and decisions that improve efficiency and resilience.' },
  { Icon: Truck, title: 'Logistics & Transportation', description: 'Time-sensitive movement involves dispatchers, drivers, partners, and customers working across changing conditions. We improve coordination, exception handling, and shipment visibility.' },
  { Icon: Building2, title: 'Media, Creators & Personal Brands', description: 'Publishing teams need accessible experiences, efficient content operations, ownership of audience data, and sustainable performance. We build around those workflows rather than vanity metrics.' },
  { Icon: BriefcaseBusiness, title: 'Professional Services', description: 'Client work depends on clear handoffs, permissions, deadlines, and trusted records. We streamline delivery and reporting while keeping professional judgment and accountability visible.' },
];

export function IndustriesWeServe() {
  const [expandedIndustry, setExpandedIndustry] = useState<number | null>(null);
  const [showAllIndustries, setShowAllIndustries] = useState(false);

  return (
    <section className="relative z-10 px-4 sm:px-6 lg:px-8" aria-labelledby="industry-spectrum-heading">
      <div className="relative z-20 mx-auto mt-[-32px] max-w-[68rem] rounded-[18px] border border-[#DCE3EA] bg-white p-4 shadow-[0_14px_34px_rgba(11,31,58,0.09)] sm:mt-[-56px] sm:rounded-[20px] sm:p-6 lg:mt-[-72px] lg:p-7 xl:p-8">
        <Stagger as="header" className="max-w-[46rem] text-left md:mx-auto md:text-center" staggerDelay={80}>
          <h2 id="industry-spectrum-heading" className="text-[28px] font-bold leading-[1.12] tracking-[-0.04em] text-[#0B1F3A] sm:text-[30px] lg:text-[32px]">
            Industries We Serve
          </h2>
          <p className="mt-3 text-[14px] leading-[1.65] text-[#475569] sm:text-[15px] lg:text-[15px]">
            Select a sector to see why its constraints differ, how our delivery approach adapts, and which operational results matter.
          </p>
        </Stagger>

        <Stagger id="additional-industries" className="mt-5 grid border-y border-[#DCE3EA] md:grid-cols-3" aria-label="Industries we serve" delay={120} staggerDelay={70}>
          {industries.map(({ Icon, title, description }, index) => (
            <button
              type="button"
              className={`group min-w-0 border-b border-[#DCE3EA] bg-transparent p-3.5 text-left transition-colors duration-200 hover:bg-[#F8FAFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B7F60] sm:p-4 md:not-[:nth-child(3n+1)]:border-l ${index > 5 && !showAllIndustries ? 'hidden' : ''}`}
              key={title}
              aria-expanded={expandedIndustry === index}
              aria-controls={`industry-description-${index}`}
              onClick={() => setExpandedIndustry((current) => (current === index ? null : index))}
            >
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center text-[#0B7F60]">
                  <Icon aria-hidden="true" className="size-5" strokeWidth={1.8} />
                </span>
                <h3 className="text-[18px] font-bold leading-[1.3] tracking-[-0.025em] text-[#0B1F3A] sm:text-[19px] lg:text-[20px]">{title}</h3>
                <ChevronDown
                  aria-hidden="true"
                  className={`ml-auto size-5 shrink-0 text-[#475569] transition-transform duration-200 motion-reduce:transition-none ${expandedIndustry === index ? 'rotate-180' : ''}`}
                  strokeWidth={1.8}
                />
              </div>
              <div
                id={`industry-description-${index}`}
                className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${expandedIndustry === index ? 'mt-2.5 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
              >
                <p className="overflow-hidden text-[14px] leading-[1.6] text-[#475569] sm:text-[14px] lg:text-[15px]">{description}</p>
              </div>
            </button>
          ))}
        </Stagger>

        <button
          type="button"
          className="btn btn-secondary mt-3.5 w-full text-[16px] md:mx-auto md:flex md:w-fit"
          aria-expanded={showAllIndustries}
          aria-controls="additional-industries"
          onClick={() => {
            setShowAllIndustries((expanded) => !expanded);
            setExpandedIndustry(null);
          }}
        >
          {showAllIndustries ? 'Show Fewer Industries' : 'Show More Industries'}
        </button>
        <div className="sr-only" aria-live="polite">
          {showAllIndustries ? 'Show Fewer Industries' : 'Show More Industries'}
        </div>

        <aside className="mt-3.5 rounded-2xl border border-[#D8E8E3] bg-[#F2F8F6] px-4 py-3 text-[14px] leading-[1.65] text-[#294A43] sm:mt-4 sm:px-5 sm:py-3.5 sm:text-[14px] lg:text-[15px]">
          <span className="text-[18px] font-bold leading-[1.3] tracking-[-0.025em] text-[#0B1F3A] sm:text-[19px] lg:text-[20px]">Don&apos;t see your industry?</span>{' '}
          We can still begin with your users, operating constraints, decision-makers, and required outcomes to determine whether we are a good fit.
        </aside>
      </div>
      </section>
  );
}
