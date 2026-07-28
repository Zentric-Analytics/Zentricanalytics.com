import { cloneElement, isValidElement, type CSSProperties, type ReactElement } from 'react';

type ScrollRevealProps = {
  children: ReactElement<{ className?: string; style?: CSSProperties; ref?: unknown }>;
  className?: string;
  delay?: number;
};

export function ScrollReveal({ children, className = '', delay = 0 }: ScrollRevealProps) {
  if (!isValidElement(children)) return children;

  return cloneElement(children, {
    className: [children.props.className, 'industries-scroll-reveal', 'is-visible', className]
      .filter(Boolean)
      .join(' '),
    style: {
      ...children.props.style,
      '--industries-reveal-delay': `${delay}ms`,
    } as CSSProperties,
  });
}
