import type { ReactNode } from 'react';

type SectionHeaderProps = {
  eyebrow: string;
  heading: ReactNode;
  description: ReactNode;
  headingId?: string;
  align?: 'left' | 'center';
  tone?: 'light' | 'dark';
  className?: string;
};

export function SectionHeader({
  eyebrow,
  heading,
  description,
  headingId,
  align = 'left',
  tone = 'light',
  className = '',
}: SectionHeaderProps) {
  const isCentered = align === 'center';
  const headingColor = tone === 'dark' ? 'text-white' : 'text-[#0B1F3A]';
  const descriptionColor = tone === 'dark' ? 'text-white/[0.82]' : 'text-[#475569]';

  return (
    <div
      className={`section-header ${isCentered ? 'mx-auto flex max-w-3xl flex-col items-center text-center' : 'max-w-4xl text-left'} ${className}`}
    >
      <p className="mb-3 text-base font-bold uppercase leading-none tracking-[0.18em] text-[#10B981]">
        {eyebrow}
      </p>
      <h2
        id={headingId}
        className={`max-w-[56rem] text-[clamp(1.5rem,4.8vw,2.625rem)] sm:text-[clamp(1.75rem,4.8vw,2.625rem)] font-bold leading-[1.1] tracking-[-0.04em] ${headingColor}`}
      >
        {heading}
      </h2>
      <p className={`mt-4 max-w-[46rem] text-base leading-[1.6] sm:text-[1.0625rem] lg:text-[1.0625rem] ${descriptionColor}`}>
        {description}
      </p>
    </div>
  );
}
