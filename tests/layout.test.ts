import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const publicPages = [
  'src/app/page.tsx',
  'src/app/about/page.tsx',
  'src/app/services/page.tsx',
  'src/app/careers/page.tsx',
  'src/app/apply/page.tsx',
  'src/app/track/page.tsx',
  'src/app/track/portal/page.tsx',
];

const headerLinks = ['Home', 'About', 'Services', 'Careers', 'Apply Now', 'Track Application'];

describe('public layout shell', () => {
  it('renders the site header in normal document flow', () => {
    const header = readFileSync('src/components/SiteHeader.tsx', 'utf8');

    expect(header).toContain('border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur');
    expect(header).not.toContain('fixed inset-x-0 top-0 z-50');
  });

  it('renders page content without a fixed-header top offset', () => {
    const shell = readFileSync('src/components/PageShell.tsx', 'utf8');

    expect(shell).toContain('<SiteHeader />');
    expect(shell).toContain('<main>{children}</main>');
    expect(shell).not.toContain('pt-[4.5rem]');
  });

  it('uses a client-side mobile navigation menu with accessible controls', () => {
    const header = readFileSync('src/components/SiteHeader.tsx', 'utf8');

    expect(header.startsWith("'use client';")).toBe(true);
    expect(header).toContain('useState(false)');
    expect(header).toContain('type="button"');
    expect(header).toContain('aria-expanded={isMobileMenuOpen}');
    expect(header).toContain('aria-controls={mobileMenuId}');
    expect(header).toContain("isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'");
    expect(header).toContain('md:hidden');
    expect(header).toContain('setIsMobileMenuOpen((open) => !open)');
  });

  it('includes every header navigation link in the mobile menu and closes on link click', () => {
    const header = readFileSync('src/components/SiteHeader.tsx', 'utf8');

    expect(header).toContain('id={mobileMenuId}');
    expect(header).toContain('role="dialog"');
    expect(header).toContain('aria-modal="true"');
    expect(header).toContain('id="mobile-menu-title"');
    expect(header).toContain('Menu');
    expect(header).toContain('Close navigation menu');
    expect(header).toContain('fixed inset-0 z-50');
    expect(header).toContain('h-screen min-h-dvh');
    expect(header).toContain('overflow-hidden bg-white');
    expect(header).toContain('overflow-y-auto overscroll-contain');
    expect(header).toContain('md:hidden');
    expect(header).toContain('onClick={() => setIsMobileMenuOpen(false)}');
    headerLinks.forEach((label) => expect(header).toContain(label));
  });


  it('locks body and html scrolling while preserving the page scroll position', () => {
    const header = readFileSync('src/components/SiteHeader.tsx', 'utf8');

    expect(header).toContain('const previousScrollY = window.scrollY');
    expect(header).toContain('const previousBodyOverflow = document.body.style.overflow');
    expect(header).toContain('const previousBodyPosition = document.body.style.position');
    expect(header).toContain('const previousBodyTop = document.body.style.top');
    expect(header).toContain('const previousBodyWidth = document.body.style.width');
    expect(header).toContain('const previousHtmlOverflow = document.documentElement.style.overflow');
    expect(header).toContain("document.documentElement.style.overflow = 'hidden'");
    expect(header).toContain("document.body.style.overflow = 'hidden'");
    expect(header).toContain("document.body.style.position = 'fixed'");
    expect(header).toContain('document.body.style.top = `-${previousScrollY}px`');
    expect(header).toContain("document.body.style.width = '100%'");
    expect(header).toContain('document.body.style.overflow = previousBodyOverflow');
    expect(header).toContain('document.body.style.position = previousBodyPosition');
    expect(header).toContain('document.body.style.top = previousBodyTop');
    expect(header).toContain('document.body.style.width = previousBodyWidth');
    expect(header).toContain('document.documentElement.style.overflow = previousHtmlOverflow');
    expect(header).toContain('window.scrollTo(0, previousScrollY)');
  });

  it('keeps Escape closing behavior on the mobile drawer', () => {
    const header = readFileSync('src/components/SiteHeader.tsx', 'utf8');

    expect(header).toContain('const handleKeyDown = (event: KeyboardEvent)');
    expect(header).toContain("if (event.key === 'Escape')");
    expect(header).toContain('setIsMobileMenuOpen(false)');
    expect(header).toContain("window.addEventListener('keydown', handleKeyDown)");
    expect(header).toContain("window.removeEventListener('keydown', handleKeyDown)");
  });

  it('groups the full-screen mobile drawer into premium navigation sections', () => {
    const header = readFileSync('src/components/SiteHeader.tsx', 'utf8');

    expect(header).toContain('mobileMenuSections');
    expect(header).toContain("label: 'MAIN'");
    expect(header).toContain("label: 'CAREERS'");
    expect(header).toContain("label: 'COMPANY'");
    expect(header).toContain('uppercase tracking-[0.24em] text-slate-400');
    expect(header).toContain('text-lg font-semibold text-slate-900');
  });

  it('keeps the mobile drawer hidden on desktop breakpoints', () => {
    const header = readFileSync('src/components/SiteHeader.tsx', 'utf8');

    expect(header).toContain('fixed inset-0 z-50');
    expect(header).toContain('md:hidden');
    expect(header).not.toContain('fixed inset-x-0 top-0 z-50');
  });

  it.each(publicPages)('%s uses PageShell for the shared header layout', (pagePath) => {
    const page = readFileSync(pagePath, 'utf8');

    expect(page).toContain('PageShell');
    expect(page).toContain('<PageShell>');
  });
});
