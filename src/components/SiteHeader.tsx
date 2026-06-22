'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const links = [
  ['/', 'Home'],
  ['/about', 'About'],
  ['/services', 'Services'],
  ['/careers', 'Careers'],
  ['/track', 'Track Application'],
];

const mobileMenuSections = [
  {
    label: 'MAIN',
    links: [
      ['/', 'Home'],
      ['/about', 'About'],
      ['/services', 'Services'],
    ],
  },
  {
    label: 'CAREERS',
    links: [
      ['/careers', 'Careers'],
      ['/apply', 'Apply Now'],
      ['/track', 'Track Application'],
    ],
  },
  {
    label: 'COMPANY',
    links: [
      ['/about', 'About Zentric Analytics'],
      ['/services', 'Services'],
    ],
  },
];

export function SiteHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuId = 'site-header-mobile-menu';

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  return (
    <header className="border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="min-w-0 flex-1 truncate font-bold text-brand md:flex-none">
          Zentric Analytics Ltd
        </Link>
        <div className="hidden min-w-0 items-center gap-5 md:flex">
          {links.map(([href, label]) => (
            <Link className="whitespace-nowrap text-sm font-medium text-slate-700 hover:text-brand" key={href} href={href}>
              {label}
            </Link>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link className="btn btn-primary px-3 py-2 text-sm sm:px-4 sm:py-3" href="/apply">
            Apply Now
          </Link>
          <button
            type="button"
            aria-expanded={isMobileMenuOpen}
            aria-controls={mobileMenuId}
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white/80 text-slate-700 shadow-sm transition hover:border-brand hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 md:hidden"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
          >
            <span className="sr-only">{isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}</span>
            <span className="flex w-5 flex-col gap-1" aria-hidden="true">
              <span className="h-0.5 w-full rounded-full bg-current" />
              <span className="h-0.5 w-full rounded-full bg-current" />
              <span className="h-0.5 w-full rounded-full bg-current" />
            </span>
          </button>
        </div>
      </nav>
      {isMobileMenuOpen ? (
        <div
          id={mobileMenuId}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-menu-title"
          className="fixed inset-0 z-50 flex min-h-screen w-full flex-col overflow-y-auto bg-white px-5 py-5 md:hidden sm:px-8"
        >
          <div className="mx-auto flex w-full max-w-lg items-center justify-between border-b border-slate-200 pb-5">
            <h2 id="mobile-menu-title" className="text-3xl font-bold tracking-tight text-slate-950">
              Menu
            </h2>
            <button
              type="button"
              aria-label="Close navigation menu"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-brand hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span className="sr-only">Close navigation menu</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-7 py-7">
            {mobileMenuSections.map((section) => (
              <section className="border-b border-slate-200 pb-6 last:border-b-0 last:pb-0" key={section.label}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{section.label}</p>
                <div className="flex flex-col">
                  {section.links.map(([href, label]) => (
                    <Link
                      className="-mx-3 rounded-2xl px-3 py-3.5 text-lg font-semibold text-slate-900 transition hover:bg-slate-50 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
                      key={`${section.label}-${href}-${label}`}
                      href={href}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
