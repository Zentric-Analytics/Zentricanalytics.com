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

  const sector = INDUSTRY_CONTENT[currentIndex];

  return (
    <div className="industries-hero-typing" aria-live="polite" aria-atomic="true">
      <div className="industries-hero-typing__entry" key={sector.title}>
        <p className="industries-hero-typing__line">
          <span className="industries-hero-typing__text">{sector.title}</span>
        </p>
        <p className="mt-3 max-w-[43rem] text-[15px] leading-[1.65] text-slate-100 sm:mt-4 sm:text-[15px] sm:leading-[1.65] lg:text-[16px]">
          {sector.description}
        </p>
      </div>
    </div>
  );
}
