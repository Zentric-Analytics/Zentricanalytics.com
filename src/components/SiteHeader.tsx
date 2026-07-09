'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { primaryNavigationLinks } from './navigation';

export function SiteHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const mobileMenuId = 'site-header-mobile-menu';

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const previousScrollY = window.scrollY;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${previousScrollY}px`;
    document.body.style.width = '100%';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.width = previousBodyWidth;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.scrollTo(0, previousScrollY);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  const isActiveLink = (href: string) => (href === '/' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <header className="border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-4.5 lg:px-8">
        <Link
          href="/"
          className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight text-brand focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 md:flex-none md:text-xl"
        >
          Zentric Analytics
        </Link>
        <div className="hidden min-w-0 items-center gap-7 md:flex lg:gap-8">
          {primaryNavigationLinks.map(([href, label]) => {
            const isActive = isActiveLink(href);

            return (
              <Link
                aria-current={isActive ? 'page' : undefined}
                className={`relative whitespace-nowrap py-2 text-[15px] font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-4 lg:text-base ${
                  isActive ? 'text-brand after:scale-x-100' : 'text-slate-700 hover:text-brand after:scale-x-0'
                } after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-center after:rounded-full after:bg-brand after:transition-transform after:duration-200 hover:after:scale-x-100`}
                key={href}
                href={href}
              >
                {label}
              </Link>
            );
          })}
        </div>
        <div className="flex shrink-0 items-center md:hidden">
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
          className="fixed inset-0 z-50 flex h-screen min-h-dvh w-full flex-col overflow-hidden bg-white md:hidden"
        >
          <div className="mx-auto flex w-full max-w-lg items-center justify-between border-b border-slate-200 px-5 py-5 sm:px-8">
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

          <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-7 overflow-y-auto overscroll-contain px-5 py-7 sm:px-8">
            <section aria-label="Primary navigation">
              <div className="flex flex-col gap-1">
                {primaryNavigationLinks.map(([href, label]) => {
                  const isActive = isActiveLink(href);

                  return (
                    <Link
                      aria-current={isActive ? 'page' : undefined}
                      className={`-mx-3 rounded-2xl border-l-2 px-3 py-3.5 text-lg font-semibold text-slate-900 transition duration-200 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ${
                        isActive
                          ? 'border-brand bg-slate-50 text-brand'
                          : 'border-transparent hover:bg-slate-50 hover:text-brand'
                      }`}
                      key={href}
                      href={href}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </header>
  );
}
