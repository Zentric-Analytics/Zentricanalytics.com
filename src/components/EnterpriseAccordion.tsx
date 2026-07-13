'use client';

import { KeyboardEvent, useId, useRef, useState } from 'react';
import { BadgeCheck, LockKeyhole, MessagesSquare, Microscope, ShieldCheck, Wrench, type LucideIcon } from 'lucide-react';

type EnterpriseAccordionIcon = 'wrench' | 'shield-check' | 'lock-keyhole' | 'microscope' | 'messages-square' | 'badge-check';

const accordionIcons: Record<EnterpriseAccordionIcon, LucideIcon> = {
  wrench: Wrench,
  'shield-check': ShieldCheck,
  'lock-keyhole': LockKeyhole,
  microscope: Microscope,
  'messages-square': MessagesSquare,
  'badge-check': BadgeCheck,
};

type EnterpriseAccordionItem = {
  icon: EnterpriseAccordionIcon;
  title: string;
  description: string;
};

type EnterpriseAccordionProps = {
  items: EnterpriseAccordionItem[];
};

export function EnterpriseAccordion({ items }: EnterpriseAccordionProps) {
  const [openIndex, setOpenIndex] = useState(0);
  const baseId = useId();
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const moveFocus = (index: number) => {
    buttonRefs.current[index]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const lastIndex = items.length - 1;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(index === lastIndex ? 0 : index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(index === 0 ? lastIndex : index - 1);
        break;
      case 'Home':
        event.preventDefault();
        moveFocus(0);
        break;
      case 'End':
        event.preventDefault();
        moveFocus(lastIndex);
        break;
      default:
        break;
    }
  };

  return (
    <div className="why-choose-accordion mx-auto mt-6 w-full max-w-[1040px] sm:mt-7" role="presentation">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const Icon = accordionIcons[item.icon];
        const buttonId = `${baseId}-trigger-${index}`;
        const panelId = `${baseId}-panel-${index}`;

        return (
          <div
            className={`why-choose-accordion__item border-t border-[#E2E8F0] transition-colors duration-[275ms] ease-out last:border-b ${isOpen ? 'bg-[#FAFAFA]' : 'bg-transparent hover:bg-[#FAFAFA]/70'}`}
            key={item.title}
          >
            <button
              aria-controls={panelId}
              aria-expanded={isOpen}
              className="group flex min-h-16 w-full items-center gap-3 px-4 py-4 text-left outline-none transition-colors duration-[275ms] ease-out focus-visible:bg-[#FAFAFA] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#10B981] sm:min-h-[68px] sm:gap-3.5 sm:px-6 sm:py-[18px] lg:px-7"
              id={buttonId}
              onClick={() => setOpenIndex(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              ref={(element) => {
                buttonRefs.current[index] = element;
              }}
              type="button"
            >
              <Icon
                aria-hidden="true"
                className={`size-[21px] shrink-0 text-[#0B1F3A] transition-colors duration-[275ms] ease-out sm:size-[22px] ${isOpen ? 'text-[#10B981]' : 'group-hover:text-[#10B981]'}`}
                strokeWidth={1.75}
              />
              <span className="flex-1 text-lg font-bold leading-[1.18] tracking-[-0.025em] text-[#0B1F3A] transition-colors duration-[275ms] ease-out group-hover:text-[#102A4A] sm:text-[1.1875rem] lg:text-[1.3125rem]">
                {item.title}
              </span>
              <span className="relative flex size-6 shrink-0 items-center justify-center text-[#0B1F3A] transition-colors duration-[275ms] ease-out group-hover:text-[#10B981] sm:size-7" aria-hidden="true">
                <span className="absolute h-0.5 w-4 rounded-full bg-current" />
                <span className={`absolute h-0.5 w-4 rounded-full bg-current transition-transform duration-[275ms] ease-out ${isOpen ? 'rotate-0' : 'rotate-90'}`} />
              </span>
            </button>
            <div
              aria-labelledby={buttonId}
              className={`grid overflow-hidden px-4 transition-[grid-template-rows,opacity] duration-[275ms] ease-out sm:px-6 lg:px-7 ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
              id={panelId}
              role="region"
            >
              <div className="min-h-0 overflow-hidden">
                <p className="ml-[33px] mt-1 max-w-[48rem] pb-5 text-[0.9375rem] leading-[1.58] text-[#475569] sm:ml-[36px] sm:mt-0 sm:pb-5 sm:text-base lg:pb-6">
                  {item.description}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
