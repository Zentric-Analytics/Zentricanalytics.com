'use client';

import { useId, useState, type CSSProperties } from 'react';
import { ChevronDown, CodeXml, Network, RefreshCcw, Rocket, Search, type LucideIcon } from 'lucide-react';

const clientChoiceProcess: Array<{ Icon: LucideIcon; title: string; description: string }> = [
  { Icon: Search, title: 'Understand Your Business', description: 'We begin by learning your goals, challenges, and technical requirements before proposing any solution.' },
  { Icon: Network, title: 'Design the Right Solution', description: 'We create scalable architectures and practical implementation plans tailored to your organization.' },
  { Icon: CodeXml, title: 'Build with Quality', description: 'Our engineers develop secure, maintainable, and high-performance software using modern engineering practices.' },
  { Icon: Rocket, title: 'Deploy with Confidence', description: 'Solutions are thoroughly tested and released using reliable deployment practices.' },
  { Icon: RefreshCcw, title: 'Support & Improve', description: 'We continue monitoring, maintaining, and improving your systems as your business evolves.' },
];

export function ClientChoiceTimeline() {
  const [isExpanded, setIsExpanded] = useState(false);
  const detailsId = useId();

  const renderStep = (step: (typeof clientChoiceProcess)[number], index: number, isMobileDetail = false) => (
    <article
      className={`industries-child-reveal group relative min-h-[56px] w-full flex-col items-start text-left md:min-h-[52px] md:items-center md:text-center lg:flex-1 ${isMobileDetail && !isExpanded ? 'hidden md:flex' : 'flex'}`}
      key={step.title}
      style={{ '--industries-reveal-delay': `${120 + index * 100}ms` } as CSSProperties}
    >
      <div className="absolute -left-20 top-0 flex size-14 shrink-0 items-center justify-center rounded-full border border-white/70 bg-[#F8FAFC] shadow-[0_10px_24px_rgba(2,8,23,0.18)] transition-[border-color,transform,box-shadow] duration-200 ease-out group-hover:border-[#10B981]/70 group-hover:shadow-[0_12px_26px_rgba(2,8,23,0.22)] motion-safe:group-hover:-translate-y-0.5 md:relative md:left-auto md:top-auto md:size-[52px]">
        <step.Icon aria-hidden="true" className="size-[22px] shrink-0 text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981]" strokeWidth={1.75} />
      </div>
      <h3 className="mt-0 w-full text-left text-[18px] font-bold leading-[1.25] tracking-[-0.02em] text-white md:mt-3 md:text-center lg:min-h-0">{step.title}</h3>
      <p className="mt-1.5 w-full max-w-[24rem] text-left text-[14px] font-normal leading-[1.5] text-slate-300 md:max-w-[13rem] md:text-center">{step.description}</p>
    </article>
  );

  return (
    <div className="relative mt-5 px-4 md:mt-4 md:px-0 lg:mt-5">
      <div className="relative grid items-stretch gap-y-8 pl-20 md:grid-cols-3 md:gap-x-7 md:gap-y-5 md:pl-0 lg:flex lg:flex-row lg:items-stretch lg:gap-x-7">
        <div aria-hidden="true" className="absolute left-7 top-7 bottom-7 w-px bg-slate-200/30 md:left-[calc((100%-4rem)/6)] md:right-[calc((100%-4rem)/6)] md:top-[26px] md:bottom-auto md:h-0.5 md:w-auto lg:left-[calc((100%-7rem)/10)] lg:right-[calc((100%-7rem)/10)]" />
        {clientChoiceProcess.slice(0, 3).map((step, index) => renderStep(step, index))}
        <div id={detailsId} className="contents">
          {clientChoiceProcess.slice(3).map((step, index) => renderStep(step, index + 3, true))}
        </div>
      </div>
      <button
        aria-controls={detailsId}
        aria-expanded={isExpanded}
        className="ml-20 mt-5 inline-flex min-h-11 items-center gap-1.5 border-0 bg-transparent px-0 py-2 text-left text-[14px] font-bold leading-none text-[#10B981] transition-colors duration-200 ease-out hover:text-[#34D399] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#10B981] md:hidden"
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span>{isExpanded ? 'Show Less' : 'Show More'}</span>
        <ChevronDown aria-hidden="true" className={`size-4 transition-transform duration-300 ease-out motion-reduce:transition-none ${isExpanded ? 'rotate-180' : ''}`} strokeWidth={2.25} />
      </button>
    </div>
  );
}
