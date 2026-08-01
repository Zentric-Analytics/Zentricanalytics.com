'use client';

import { useEffect, useState } from 'react';
import { INDUSTRY_CONTENT } from './industryContent';

export const INDUSTRY_TYPING_INTERVAL = 50;
export const INDUSTRY_DELETE_INTERVAL = 35;
export const INDUSTRY_PAUSE_INTERVAL = 2200;

type TypingPhase = 'typing' | 'pause' | 'deleting';

export type TypingState = {
  currentIndex: number;
  phase: TypingPhase;
  text: string;
};

export const getNextIndustryIndex = (currentIndex: number) => (currentIndex + 1) % INDUSTRY_CONTENT.length;

export function getNextTypingState(state: TypingState): TypingState {
  const sectorName = INDUSTRY_CONTENT[state.currentIndex].title;

  if (state.phase === 'typing') {
    const text = sectorName.slice(0, state.text.length + 1);
    return { ...state, text, phase: text === sectorName ? 'pause' : 'typing' };
  }

  if (state.phase === 'pause') return { ...state, phase: 'deleting' };

  if (state.text.length > 1) return { ...state, text: state.text.slice(0, -1) };

  return {
    currentIndex: getNextIndustryIndex(state.currentIndex),
    phase: 'typing',
    text: '',
  };
}

export function IndustriesHeroTyping() {
  const firstSector = INDUSTRY_CONTENT[0].title;
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const [typing, setTyping] = useState<TypingState>({
    currentIndex: 0,
    phase: 'typing',
    text: firstSector,
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setReducedMotion(mediaQuery.matches);

    updateMotionPreference();
    mediaQuery.addEventListener('change', updateMotionPreference);
    return () => mediaQuery.removeEventListener('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    if (reducedMotion === null) return;

    if (reducedMotion || INDUSTRY_CONTENT.length <= 1) {
      setTyping({ currentIndex: 0, phase: 'typing', text: firstSector });
      return;
    }

    if (typing.text === firstSector && typing.currentIndex === 0 && typing.phase === 'typing') {
      setTyping({ currentIndex: 0, phase: 'typing', text: '' });
      return;
    }

    const delay = typing.phase === 'pause'
      ? INDUSTRY_PAUSE_INTERVAL
      : typing.phase === 'deleting'
        ? INDUSTRY_DELETE_INTERVAL
        : INDUSTRY_TYPING_INTERVAL;
    const timer = window.setTimeout(() => setTyping(getNextTypingState), delay);

    return () => window.clearTimeout(timer);
  }, [firstSector, reducedMotion, typing]);

  const showCursor = reducedMotion === false && INDUSTRY_CONTENT.length > 1;

  return (
    <p className="industries-hero-typing__line" aria-live="polite" aria-atomic="true">
      <span className="industries-hero-typing__entry">
        <span className="industries-hero-typing__text">{typing.text}</span>
        {showCursor && <span className="industries-hero-typing__cursor" aria-hidden="true">|</span>}
      </span>
    </p>
  );
}
