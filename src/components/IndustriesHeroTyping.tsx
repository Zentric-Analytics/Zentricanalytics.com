'use client';

import { useEffect, useMemo, useState } from 'react';

const industries = [
  'Healthcare',
  'Financial Services',
  'Banking',
  'Insurance',
  'Education',
  'Government',
  'Public Institutions',
  'Retail',
  'E-Commerce',
  'Manufacturing',
  'Logistics',
  'Supply Chain',
  'Transportation',
  'Automotive',
  'Construction',
  'Real Estate',
  'Property Management',
  'Hospitality',
  'Travel & Tourism',
  'Food & Beverage',
  'Agriculture',
  'Energy',
  'Utilities',
  'Oil & Gas',
  'Telecommunications',
  'Media',
  'Entertainment',
  'Professional Services',
  'Legal Services',
  'Accounting & Finance',
  'Human Resources',
  'Marketing Agencies',
  'Creative Studios',
  'Technology Companies',
  'Software Companies',
  'Artificial Intelligence',
  'Data & Analytics',
  'Cloud Infrastructure',
  'Cybersecurity',
  'Research Organizations',
  'Universities',
  'Nonprofits',
  'NGOs',
  'Enterprise Organizations',
  'Startups',
  'Small Businesses',
  'Entrepreneurs',
  'Creators',
  'Personal Brands',
  'Sports & Recreation',
  'Fitness & Wellness',
  'Beauty & Cosmetics',
  'Fashion & Apparel',
];

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

export function IndustriesHeroTyping() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [industryIndex, setIndustryIndex] = useState(0);
  const [characterCount, setCharacterCount] = useState(industries[0].length);
  const [isDeleting, setIsDeleting] = useState(false);

  const currentIndustry = industries[industryIndex];
  const longestIndustry = useMemo(
    () => industries.reduce((longest, industry) => (industry.length > longest.length ? industry : longest), ''),
    [],
  );

  useEffect(() => {
    if (prefersReducedMotion) {
      setIndustryIndex(0);
      setCharacterCount(industries[0].length);
      setIsDeleting(false);
      return;
    }

    if (!isDeleting && characterCount === currentIndustry.length) {
      const pauseTimeout = window.setTimeout(() => setIsDeleting(true), 1900);
      return () => window.clearTimeout(pauseTimeout);
    }

    if (isDeleting && characterCount === 0) {
      const nextTimeout = window.setTimeout(() => {
        setIndustryIndex((index) => (index + 1) % industries.length);
        setIsDeleting(false);
      }, 180);
      return () => window.clearTimeout(nextTimeout);
    }

    const baseDelay = isDeleting ? 34 : 68;
    const naturalVariance = isDeleting ? (characterCount % 3) * 8 : (characterCount % 4) * 13;
    const timeout = window.setTimeout(() => {
      setCharacterCount((count) => count + (isDeleting ? -1 : 1));
    }, baseDelay + naturalVariance);

    return () => window.clearTimeout(timeout);
  }, [characterCount, currentIndustry.length, isDeleting, prefersReducedMotion]);

  const typedIndustry = prefersReducedMotion ? industries[0] : currentIndustry.slice(0, characterCount);

  return (
    <div className="industries-hero-typing" aria-live="polite" aria-label={`Serving ${typedIndustry}`}>
      <p className="industries-hero-typing__label">Serving</p>
      <p className="industries-hero-typing__line">
        <span className="industries-hero-typing__text">{typedIndustry}</span>
        <span className="industries-hero-typing__ghost" aria-hidden="true">{longestIndustry}</span>
        <span className="industries-hero-typing__cursor" aria-hidden="true" />
      </p>
    </div>
  );
}
