'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { primaryNavigationLinks } from './navigation';

const contactLink = ['/contact', "Let's Talk"] as const;

export function SiteHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const pathname = usePathname();
  const mobileMenuId = 'site-header-mobile-menu';
  const isHomepage = pathname === '/';
  const visibleNavigationLinks = isHomepage
    ? primaryNavigationLinks.filter(([href]) => href !== '/')
    : primaryNavigationLinks;

  useEffect(() => {
    const handleScroll = () => setHasScrolled(window.scrollY > 8);

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    <header
      className={`sticky inset-x-0 top-0 z-50 border-b transition-all duration-300 ${
        hasScrolled
          ? 'border-[#0B1F3A]/10 bg-white shadow-[0_10px_26px_rgba(11,31,58,0.07)]'
          : 'border-transparent bg-white'
      }`}
    >
      <nav className={`mx-auto flex w-full max-w-7xl items-center justify-between gap-5 px-5 transition-[height] duration-300 sm:px-6 lg:gap-7 lg:px-8 ${hasScrolled ? 'h-[64px] sm:h-[68px]' : 'h-[76px] sm:h-20 lg:h-[82px]'}`}>
        <Link
          href="/"
          aria-label="Zentric Analytics homepage"
          className="inline-flex shrink-0 -translate-y-0.5 items-center rounded-md focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:ring-offset-4 md:-translate-y-[3px]"
        >
          <span className="whitespace-nowrap text-[23px] font-extrabold leading-none tracking-[-0.035em] text-[#0B1F3A] sm:text-[26px] md:text-[29px] lg:text-[30px]">
            Zentric Analytics
          </span>
        </Link>

        <div className="hidden min-w-0 flex-1 translate-y-px items-center justify-center gap-7 md:flex lg:gap-9">
          {visibleNavigationLinks.map(([href, label]) => {
            const isActive = isActiveLink(href);

            return (
              <Link
                aria-current={isActive ? 'page' : undefined}
                className={`relative whitespace-nowrap py-2 text-[15px] font-medium tracking-[-0.005em] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:ring-offset-4 ${
                  isActive ? 'text-[#0B1F3A]' : 'text-[#173B67]/72 hover:text-[#10B981]'
                } after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-center after:rounded-full after:bg-[#10B981] after:transition-transform after:duration-200 ${
                  isActive ? 'after:scale-x-100' : 'after:scale-x-0 hover:after:scale-x-100'
                }`}
                key={href}
                href={href}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <div className="hidden shrink-0 items-center md:flex">
          <Link
            href={contactLink[0]}
            className="btn zentric-primary-cta"
          >
            <span>{contactLink[1]}</span>
            <span className="zentric-primary-cta__arrow" aria-hidden="true">
              →
            </span>
          </Link>
        </div>

        <div className="flex shrink-0 items-center md:hidden">
          <button
            type="button"
            aria-expanded={isMobileMenuOpen}
            aria-controls={mobileMenuId}
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="btn btn-secondary btn-compact h-11 w-11 p-0 md:hidden"
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
          <div className="mx-auto flex w-full max-w-lg items-center justify-between border-b border-[#0B1F3A]/10 px-5 py-4 sm:px-8">
            <h2 id="mobile-menu-title" className="text-2xl font-semibold tracking-[-0.03em] text-[#0B1F3A]">
              Menu
            </h2>
            <button
              type="button"
              aria-label="Close navigation menu"
              className="btn btn-secondary btn-compact h-11 w-11 p-0"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span className="sr-only">Close navigation menu</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 overflow-y-auto overscroll-contain px-5 py-7 sm:px-8">
            <section aria-label="Primary navigation">
              <div className="flex flex-col gap-1">
                {[...visibleNavigationLinks, contactLink].map(([href, label]) => {
                  const isActive = isActiveLink(href);
                  const isContact = href === contactLink[0] && label === contactLink[1];

                  return (
                    <Link
                      aria-current={isActive ? 'page' : undefined}
                      className={`-mx-3 rounded-2xl border-l-2 px-3 py-3.5 text-lg font-semibold tracking-[-0.02em] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:ring-offset-2 ${
                        isContact
                          ? 'btn zentric-primary-cta mt-4 w-full border-0'
                          : isActive
                            ? 'border-[#10B981] bg-[#0B1F3A]/[0.03] text-[#0B1F3A]'
                            : 'border-transparent text-[#173B67] hover:bg-[#0B1F3A]/[0.03] hover:text-[#0B1F3A]'
                      }`}
                      key={`${href}-${label}`}
                      href={href}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {isContact ? (
                        <>
                          <span>{label}</span>
                          <span className="zentric-primary-cta__arrow" aria-hidden="true">
                            →
                          </span>
                        </>
                      ) : (
                        label
                      )}
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
