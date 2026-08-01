import type { CSSProperties } from 'react';

export const motionDurations = {
  instant: 0,
  fast: 160,
  base: 240,
  slow: 420,
  reveal: 560,
} as const;

export const motionEasings = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  emphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',
  entrance: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const;

export const motionRevealVariants = {
  fade: 'za-reveal--fade',
  up: 'za-reveal--up',
  down: 'za-reveal--down',
  left: 'za-reveal--left',
  right: 'za-reveal--right',
  scale: 'za-reveal--scale',
} as const;

export type MotionRevealVariant = keyof typeof motionRevealVariants;

export const motionHoverEffects = {
  lift: 'za-hover-lift',
  glow: 'za-hover-glow',
  border: 'za-hover-border',
  tilt: 'za-hover-tilt',
} as const;

export type MotionHoverEffect = keyof typeof motionHoverEffects;

export type MotionStyleOptions = {
  delay?: number;
  duration?: number;
  staggerDelay?: number;
  staggerIndex?: number;
};

export function getMotionStyle({ delay = 0, duration, staggerDelay = 0, staggerIndex = 0 }: MotionStyleOptions = {}) {
  const totalDelay = delay + staggerDelay * staggerIndex;
  return {
    '--za-motion-delay': `${totalDelay}ms`,
    ...(duration === undefined ? {} : { '--za-motion-duration': `${duration}ms` }),
  } as CSSProperties;
}

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}
