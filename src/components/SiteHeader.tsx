'use client';

import { useState } from 'react';
import Link from 'next/link';

const links = [
  ['/', 'Home'],
  ['/about', 'About'],
  ['/services', 'Services'],
  ['/careers', 'Careers'],
  ['/track', 'Track Application'],
];

export function SiteHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuId = 'site-header-mobile-menu';

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
        <div id={mobileMenuId} className="w-full overflow-x-hidden px-4 pb-4 md:hidden sm:px-6">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur">
            {links.map(([href, label]) => (
              <Link
                className="rounded-xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-brand"
                key={href}
                href={href}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
