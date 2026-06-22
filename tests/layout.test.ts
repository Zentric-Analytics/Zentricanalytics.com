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
    expect(header).toContain('overflow-y-auto bg-white');
    expect(header).toContain('md:hidden');
    expect(header).toContain('onClick={() => setIsMobileMenuOpen(false)}');
    headerLinks.forEach((label) => expect(header).toContain(label));
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
