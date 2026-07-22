'use client';

import { useEffect, useState } from 'react';
import { BrainCircuit, ChevronDown, CloudCog, Code2, Handshake, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react';
import { Stagger } from '@/components/Motion';

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

export function OrganizationCapabilitiesReveal() {
  const [expandedCapability, setExpandedCapability] = useState<string | null>(null);
  const [supportsHover, setSupportsHover] = useState(false);

  useEffect(() => {
    const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const updateHoverSupport = () => setSupportsHover(hoverQuery.matches);

    updateHoverSupport();
    hoverQuery.addEventListener('change', updateHoverSupport);

    return () => hoverQuery.removeEventListener('change', updateHoverSupport);
  }, []);

  return (
    <Stagger className="border-y border-[#DCE3EA]" delay={120} staggerDelay={75}>
      {organizationCapabilities.map(({ Icon, title, description }, index) => {
        const descriptionId = `organization-capability-${index}-description`;
        const isExpanded = expandedCapability === title;

        return (
          <article
            className="group -mx-2 px-2 py-[1.125rem] first:pt-[1.125rem] last:pb-[1.125rem] not-last:border-b not-last:border-[#DCE3EA] transition-colors duration-200 ease-out hover:bg-[#EAF7F2]/40 focus-within:bg-[#EAF7F2]/40 sm:-mx-3 sm:px-3 sm:py-6"
            key={title}
            onPointerEnter={() => {
              if (supportsHover) {
                setExpandedCapability(title);
              }
            }}
            onPointerLeave={() => {
              if (supportsHover) {
                setExpandedCapability(null);
              }
            }}
          >
            <button
              type="button"
              className="grid w-full grid-cols-[2.75rem_minmax(0,1fr)_1.25rem] items-start gap-x-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#10B981] sm:grid-cols-[3.25rem_minmax(0,1fr)_1.5rem] sm:gap-x-4"
              aria-expanded={isExpanded}
              aria-controls={descriptionId}
              onClick={() => {
                if (!supportsHover) {
                  setExpandedCapability(isExpanded ? null : title);
                }
              }}
              onFocus={() => {
                if (supportsHover) {
                  setExpandedCapability(title);
                }
              }}
              onBlur={() => {
                if (supportsHover) {
                  setExpandedCapability(null);
                }
              }}
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-[#EAF7F2] text-[#0B7F60] transition-transform duration-200 ease-out motion-safe:group-hover:translate-x-0.5 sm:size-11">
                <Icon aria-hidden="true" className="size-5" strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block text-[18px] font-semibold leading-[1.3] tracking-[-0.025em] text-[#0B1F3A] transition-colors duration-[275ms] ease-out sm:text-[19px] group-hover:text-[#0B7F60] group-focus-within:text-[#0B7F60] lg:text-[20px]">
                  {title}
                </span>
                <span
                  id={descriptionId}
                  className="block max-h-0 overflow-hidden opacity-0 transition-[max-height,opacity] duration-[275ms] ease-out group-hover:max-h-28 group-hover:opacity-100 group-focus-within:max-h-28 group-focus-within:opacity-100 data-[expanded=true]:max-h-28 data-[expanded=true]:opacity-100"
                  data-expanded={isExpanded}
                >
                  <span className="mt-1.5 block text-[14px] leading-[1.6] text-[#475569] sm:text-[14px] lg:text-[15px]">
                    {description}
                  </span>
                </span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className="mt-2 size-4 justify-self-end text-[#0B7F60] transition-transform duration-[275ms] ease-out group-hover:rotate-180 group-focus-within:rotate-180 data-[expanded=true]:rotate-180 sm:mt-2.5 sm:size-[1.125rem]"
                data-expanded={isExpanded}
                strokeWidth={1.8}
              />
            </button>
          </article>
        );
      })}
    </Stagger>
  );
}
