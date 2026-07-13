'use client';

import { KeyboardEvent, useId, useRef, useState } from 'react';

type EnterpriseAccordionItem = {
  number: string;
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
    <div className="why-choose-accordion mx-auto mt-8 w-full max-w-[960px] sm:mt-10" role="presentation">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const buttonId = `${baseId}-trigger-${index}`;
        const panelId = `${baseId}-panel-${index}`;

        return (
          <div
            className={`why-choose-accordion__item border-t border-[#E5E7EB] transition-colors duration-[275ms] ease-out last:border-b ${isOpen ? 'bg-[#FAFAFA]' : 'bg-transparent hover:bg-[#FAFAFA]/70'}`}
            key={item.title}
          >
            <button
              aria-controls={panelId}
              aria-expanded={isOpen}
              className="group flex min-h-14 w-full items-center gap-4 px-4 py-5 text-left outline-none transition-colors duration-[275ms] ease-out focus-visible:bg-[#FAFAFA] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#10B981] sm:px-7 sm:py-6 lg:px-9"
              id={buttonId}
              onClick={() => setOpenIndex(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              ref={(element) => {
                buttonRefs.current[index] = element;
              }}
              type="button"
            >
              <span className="hidden min-w-9 text-sm font-semibold tracking-[0.18em] text-[#10B981] sm:inline-flex">
                {item.number}
              </span>
              <span className="flex-1 text-[1.25rem] font-bold leading-[1.15] tracking-[-0.035em] text-[#0B1F3A] transition-colors duration-[275ms] ease-out group-hover:text-[#102A4A] sm:text-[1.5rem] lg:text-[1.6875rem]">
                {item.title}
              </span>
              <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full text-[#0B1F3A] transition-colors duration-[275ms] ease-out group-hover:bg-white sm:size-9" aria-hidden="true">
                <span className="absolute h-0.5 w-4 rounded-full bg-current" />
                <span className={`absolute h-0.5 w-4 rounded-full bg-current transition-transform duration-[275ms] ease-out ${isOpen ? 'rotate-0' : 'rotate-90'}`} />
              </span>
            </button>
            <div
              aria-labelledby={buttonId}
              className={`grid overflow-hidden px-4 transition-[grid-template-rows,opacity] duration-[275ms] ease-out sm:px-7 lg:px-9 ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
              id={panelId}
              role="region"
            >
              <div className="min-h-0 overflow-hidden">
                <p className="max-w-[48rem] pb-6 pl-0 text-base leading-[1.7] text-[#475569] sm:pb-7 sm:pl-[3.25rem] sm:text-[1.0625rem] lg:pb-8">
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
