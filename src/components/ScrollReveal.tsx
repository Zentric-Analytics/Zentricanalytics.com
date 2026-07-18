'use client';

import { cloneElement, isValidElement, useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';

type ScrollRevealProps = {
  children: ReactElement<{ className?: string; style?: CSSProperties; ref?: unknown }>;
  className?: string;
  delay?: number;
};

export function ScrollReveal({ children, className = '', delay = 0 }: ScrollRevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;

    if (!element) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.16 },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  if (!isValidElement(children)) return children;

  return cloneElement(children, {
    ref,
    className: [children.props.className, 'industries-scroll-reveal', isVisible ? 'is-visible' : '', className]
      .filter(Boolean)
      .join(' '),
    style: {
      ...children.props.style,
      '--industries-reveal-delay': `${delay}ms`,
    } as CSSProperties,
  });
}
