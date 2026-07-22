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
    <div className="why-choose-accordion mx-auto mt-5 w-full max-w-[1000px]" role="presentation">
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
              className="group flex min-h-[58px] w-full items-center gap-2.5 px-4 py-3 text-left outline-none transition-colors duration-[275ms] ease-out focus-visible:bg-[#FAFAFA] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#10B981] sm:min-h-[62px] sm:gap-3 sm:px-5 sm:py-3.5 lg:px-6"
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
              <span className="flex-1 text-lg font-bold leading-[1.18] tracking-[-0.025em] text-[#0B1F3A] transition-colors duration-[275ms] ease-out group-hover:text-[#102A4A] sm:text-[1.1875rem] lg:text-[1.25rem]">
                {item.title}
              </span>
              <span className="relative flex size-6 shrink-0 items-center justify-center text-[#0B1F3A] transition-colors duration-[275ms] ease-out group-hover:text-[#10B981] sm:size-7" aria-hidden="true">
                <span className="absolute h-0.5 w-4 rounded-full bg-current" />
                <span className={`absolute h-0.5 w-4 rounded-full bg-current transition-transform duration-[275ms] ease-out ${isOpen ? 'rotate-0' : 'rotate-90'}`} />
              </span>
            </button>
            <div
              aria-labelledby={buttonId}
              className={`grid overflow-hidden px-4 transition-[grid-template-rows,opacity] duration-[275ms] ease-out sm:px-5 lg:px-6 ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
              id={panelId}
              role="region"
            >
              <div className="min-h-0 overflow-hidden">
                <p className="ml-[31px] max-w-[48rem] pb-4 pt-1 text-sm leading-[1.6] text-[#475569] sm:ml-[34px] sm:text-[0.9375rem]">
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
