'use client';

import { useId, useRef, useState, type FocusEvent, type MouseEvent } from 'react';
import { ChartNoAxesCombined, ChevronDown, HeartHandshake, RefreshCcw, ShieldCheck, TrendingUp, Workflow, type LucideIcon } from 'lucide-react';
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
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const baseId = useId();
  const pointerIsActivating = useRef(false);

  const supportsHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const closeWhenFocusLeaves = (event: FocusEvent<HTMLElement>, index: number) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setOpenIndex((current) => (current === index ? null : current));
    }
  };

  const closeWhenPointerLeaves = (event: MouseEvent<HTMLElement>, index: number) => {
    if (supportsHover() && !event.currentTarget.contains(document.activeElement)) {
      setOpenIndex((current) => (current === index ? null : current));
    }
  };

  return (
    <Stagger className="border-y border-[#DCE3EA]" delay={120} staggerDelay={75}>
      {organizationCapabilities.map(({ Icon, title, description }, index) => {
        const isOpen = openIndex === index;
        const buttonId = `${baseId}-outcome-trigger-${index}`;
        const panelId = `${baseId}-outcome-panel-${index}`;

        return (
          <article
            className="not-last:border-b not-last:border-[#DCE3EA]"
            key={title}
            onBlur={(event) => closeWhenFocusLeaves(event, index)}
            onMouseEnter={() => {
              if (supportsHover()) setOpenIndex(index);
            }}
            onMouseLeave={(event) => closeWhenPointerLeaves(event, index)}
          >
            <h3>
              <button
                aria-controls={panelId}
                aria-expanded={isOpen}
                className="group grid min-h-[72px] w-full grid-cols-[2.75rem_minmax(0,1fr)_1.5rem] items-center gap-x-3 py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0B7F60] sm:min-h-[76px] sm:py-4"
                id={buttonId}
                onClick={() => {
                  pointerIsActivating.current = false;
                  setOpenIndex((current) => (current === index ? null : index));
                }}
                onFocus={() => {
                  if (!pointerIsActivating.current) setOpenIndex(index);
                }}
                onPointerDown={() => {
                  pointerIsActivating.current = true;
                }}
                type="button"
              >
                <span className="flex size-10 items-center justify-center text-[#0B7F60]">
                  <Icon aria-hidden="true" className="size-[1.375rem]" strokeWidth={1.8} />
                </span>
                <span className="min-w-0 text-[18px] font-semibold leading-[1.3] tracking-[-0.025em] text-[#0B1F3A] sm:text-[19px] lg:text-[20px]">
                  {title}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={`size-[18px] text-[#64748B] transition-transform duration-250 ease-out motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`}
                  strokeWidth={1.8}
                />
              </button>
            </h3>
            <div
              aria-labelledby={buttonId}
              className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-250 ease-out motion-reduce:transition-none ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
              id={panelId}
              role="region"
            >
              <div className="min-h-0 overflow-hidden">
                <p className="ml-[3.5rem] max-w-[38rem] pb-4 pr-9 text-[14px] leading-[1.6] text-[#475569] lg:text-[15px]">
                  {description}
                </p>
              </div>
            </div>
          </article>
        );
      })}
    </Stagger>
  );
}
