'use client';

import { useEffect, useState } from 'react';
import { INDUSTRY_CONTENT } from './industryContent';

export const INDUSTRY_DISPLAY_INTERVAL = 4000;
export const getNextIndustryIndex = (currentIndex: number) => (currentIndex + 1) % INDUSTRY_CONTENT.length;

export function IndustriesHeroTyping() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches || INDUSTRY_CONTENT.length <= 1) return;

    const interval = window.setInterval(() => {
      setCurrentIndex(getNextIndustryIndex);
    }, INDUSTRY_DISPLAY_INTERVAL);

    return () => window.clearInterval(interval);
  }, []);

  const sectorName = INDUSTRY_CONTENT[currentIndex].title;

  return (
    <p className="industries-hero-typing__line" aria-live="polite" aria-atomic="true">
      <span className="industries-hero-typing__entry" key={sectorName}>
        <span className="industries-hero-typing__text">{sectorName}</span>
      </span>
    </p>
  );
}
