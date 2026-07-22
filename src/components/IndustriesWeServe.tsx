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
  { Icon: Banknote, title: 'Financial Services', description: 'Secure, data-driven solutions that support digital banking, operations, compliance, and customer experiences.' },
  { Icon: HeartPulse, title: 'Healthcare', description: 'Technology that improves operations, information access, service delivery, and patient experiences.' },
  { Icon: ShoppingBag, title: 'Retail & E-commerce', description: 'Digital platforms and insights that improve sales, customer engagement, and business performance.' },
  { Icon: Factory, title: 'Manufacturing', description: 'Connected systems, automation, and analytics designed to improve productivity and operational visibility.' },
  { Icon: GraduationCap, title: 'Education', description: 'Accessible digital solutions that support learning, administration, communication, and institutional growth.' },
  { Icon: Landmark, title: 'Government & Public Sector', description: 'Secure and scalable technology that improves public services, internal operations, and citizen engagement.' },
  { Icon: MonitorCog, title: 'Technology & SaaS', description: 'Product engineering, cloud infrastructure, data solutions, and technical support for digital businesses.' },
  { Icon: House, title: 'Real Estate', description: 'Digital tools that simplify property operations, customer management, marketing, and decision-making.' },
  { Icon: Bolt, title: 'Energy & Utilities', description: 'Reliable technology and data solutions that support operations, infrastructure, monitoring, and efficiency.' },
  { Icon: Truck, title: 'Logistics & Transportation', description: 'Systems that improve coordination, tracking, delivery operations, and supply-chain visibility.' },
  { Icon: Building2, title: 'Media, Creators & Personal Brands', description: 'Digital platforms, content systems, analytics, and brand experiences built for audience growth.' },
  { Icon: BriefcaseBusiness, title: 'Professional Services', description: 'Technology that helps service-based organizations manage clients, workflows, data, and business growth.' },
];

export function IndustriesWeServe() {
  const [expandedIndustry, setExpandedIndustry] = useState<number | null>(null);
  const [showAllIndustries, setShowAllIndustries] = useState(false);

  return (
    <section className="relative z-10 -mt-8 px-4 sm:-mt-10 sm:px-6 lg:-mt-12 lg:px-8" aria-labelledby="industry-spectrum-heading">
      <div className="mx-auto max-w-[68rem] rounded-[18px] border border-[#DCE3EA] bg-white p-4 shadow-[0_14px_34px_rgba(11,31,58,0.09)] sm:rounded-[20px] sm:p-6 lg:p-7 xl:p-8">
        <Stagger as="header" className="max-w-[46rem] text-left md:mx-auto md:text-center" staggerDelay={80}>
          <h2 id="industry-spectrum-heading" className="text-[28px] font-bold leading-[1.12] tracking-[-0.04em] text-[#0B1F3A] sm:text-[30px] lg:text-[32px]">
            Industries We Serve
          </h2>
          <p className="mt-3 text-[14px] leading-[1.65] text-[#475569] sm:text-[15px] lg:text-[15px]">
            We partner with organizations across a wide range of sectors, adapting our technology, data, and digital solutions to the unique needs of each business, institution, and personal brand.
          </p>
        </Stagger>

        <Stagger id="additional-industries" className="mt-5 grid gap-3 md:grid-cols-3 lg:gap-3.5" aria-label="Industries we serve" delay={120} staggerDelay={70}>
          {industries.map(({ Icon, title, description }, index) => (
            <button
              type="button"
              className={`group min-w-0 rounded-2xl border border-[#DCE3EA] bg-[#F8FAFC] p-3.5 text-left transition duration-200 motion-safe:hover:-translate-y-0.5 hover:border-[#C5D1DD] hover:shadow-[0_10px_24px_rgba(11,31,58,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B7F60] sm:p-4 ${index > 5 && !showAllIndustries ? 'hidden' : ''}`}
              key={title}
              aria-expanded={expandedIndustry === index}
              aria-controls={`industry-description-${index}`}
              onClick={() => setExpandedIndustry((current) => (current === index ? null : index))}
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF7F2] text-[#0B7F60]">
                  <Icon aria-hidden="true" className="size-5" strokeWidth={1.8} />
                </span>
                <h3 className="text-[18px] font-bold leading-[1.3] tracking-[-0.025em] text-[#0B1F3A] sm:text-[19px] lg:text-[20px]">{title}</h3>
                <ChevronDown
                  aria-hidden="true"
                  className={`ml-auto size-5 shrink-0 text-[#475569] transition-transform duration-300 ${expandedIndustry === index ? 'rotate-180' : ''}`}
                  strokeWidth={1.8}
                />
              </div>
              <div
                id={`industry-description-${index}`}
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${expandedIndustry === index ? 'mt-2.5 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
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
          That&apos;s not a limitation. Zentric Analytics delivers tailored technology solutions for organizations, businesses, institutions, and professionals across every sector.
        </aside>
      </div>
      </section>
  );
}
