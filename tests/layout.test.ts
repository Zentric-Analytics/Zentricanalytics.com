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

const primaryNavLinks = ['Home', 'About', 'Services', 'Careers'];
const applicantNavLinks = ['Apply', 'Track Application'];

const publicFacingBrandSourceFiles = [
  'src/components/SiteHeader.tsx',
  'src/components/SiteFooter.tsx',
  'src/app/layout.tsx',
  'src/app/page.tsx',
  'src/app/about/page.tsx',
  'src/app/apply/page.tsx',
  'src/app/apply/Stage1ApplicationForm.tsx',
];

describe('public layout shell', () => {

  it.each(publicFacingBrandSourceFiles)('%s uses the public brand name without the legal suffix', (sourcePath) => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).not.toContain('Zentric Analytics Ltd');
    expect(source).not.toContain('Zentric Analytics LTD');
  });

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

  it('keeps the mobile menu synchronized with the primary navigation and closes on link click', () => {
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
    const navigation = readFileSync('src/components/navigation.ts', 'utf8');

    primaryNavLinks.forEach((label) => expect(navigation).toContain(label));
    expect(navigation).not.toContain('Apply Now');
    expect(header).not.toContain('Track Application');
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

  it('uses the shared primary navigation without recruitment shortcuts in the header', () => {
    const header = readFileSync('src/components/SiteHeader.tsx', 'utf8');
    const navigation = readFileSync('src/components/navigation.ts', 'utf8');

    expect(header).toContain('primaryNavigationLinks');
    expect(header).not.toContain('Apply Now');
    expect(header).not.toContain('Track Application');
    primaryNavLinks.forEach((label) => expect(navigation).toContain(label));
    expect(header).toContain('text-lg font-semibold text-slate-900');
  });

  it('separates company and applicant links in the footer', () => {
    const footer = readFileSync('src/components/SiteFooter.tsx', 'utf8');
    const navigation = readFileSync('src/components/navigation.ts', 'utf8');

    expect(footer).toContain('<FooterHeading>Company</FooterHeading>');
    expect(footer).toContain('<FooterHeading>Applicants</FooterHeading>');
    expect(footer).toContain('primaryNavigationLinks.map');
    expect(footer).toContain('applicantNavigationLinks.map');
    primaryNavLinks.forEach((label) => expect(navigation).toContain(label));
    applicantNavLinks.forEach((label) => expect(navigation).toContain(label));
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
