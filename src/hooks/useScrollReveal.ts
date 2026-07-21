'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

type UseScrollRevealOptions<T extends HTMLElement> = {
  disabled?: boolean;
  once?: boolean;
  root?: Element | Document | null;
  rootMargin?: string;
  threshold?: number | number[];
  onReveal?: (element: T) => void;
};

type UseScrollRevealResult<T extends HTMLElement> = {
  ref: RefObject<T | null>;
  isVisible: boolean;
  prefersReducedMotion: boolean;
};

export function useScrollReveal<T extends HTMLElement>({
  disabled = false,
  once = true,
  root = null,
  rootMargin = '0px 0px -12% 0px',
  threshold = 0.16,
  onReveal,
}: UseScrollRevealOptions<T> = {}): UseScrollRevealResult<T> {
  const ref = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const element = ref.current;

    if (!element) return;

    if (disabled || prefersReducedMotion || !('IntersectionObserver' in window)) {
      setIsVisible(true);
      onReveal?.(element);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          if (!once) setIsVisible(false);
          return;
        }

        setIsVisible(true);
        onReveal?.(element);

        if (once) observer.unobserve(entry.target);
      },
      { root, rootMargin, threshold },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [disabled, once, onReveal, prefersReducedMotion, root, rootMargin, threshold]);

  return { ref, isVisible, prefersReducedMotion };
}
