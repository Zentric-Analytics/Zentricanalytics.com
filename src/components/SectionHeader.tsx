import type { ReactNode } from 'react';

type SectionHeaderProps = {
  eyebrow?: string;
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
  const headingColor = tone === 'dark' ? 'text-white' : 'text-ink';
  const descriptionColor = tone === 'dark' ? 'text-white/90' : 'text-text-secondary';

  return (
    <div
      className={`section-header ${isCentered ? 'mx-auto flex max-w-3xl flex-col items-center text-center' : 'max-w-4xl text-left'} ${className}`}
    >
      {eyebrow ? <p className="za-eyebrow mb-3">{eyebrow}</p> : null}
      <h2
        id={headingId}
        className={`za-section-heading max-w-[56rem] ${headingColor}`}
      >
        {heading}
      </h2>
      <p className={`za-body mt-4 max-w-[46rem] ${descriptionColor}`}>
        {description}
      </p>
    </div>
  );
}
