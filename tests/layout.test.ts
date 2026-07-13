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

const primaryNavLinks = ['Home', 'Services', 'Industries', 'Careers'];
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

  it('renders a premium sticky site header with scroll refinement', () => {
    const header = readFileSync('src/components/SiteHeader.tsx', 'utf8');

    expect(header).toContain('sticky inset-x-0 top-0 z-50 border-b transition-all duration-300');
    expect(header).toContain('hasScrolled');
    expect(header).toContain('bg-white');
    expect(header).toContain('shadow-[0_10px_26px_rgba(11,31,58,0.07)]');
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
    ['About', 'Contact'].forEach((label) => expect(navigation).not.toContain(label));
    expect(navigation).not.toContain('Apply Now');
    expect(header).not.toContain('Track Application');
  });


  it('shows Home only on internal routes for desktop and mobile navigation', () => {
    const header = readFileSync('src/components/SiteHeader.tsx', 'utf8');
    const navigation = readFileSync('src/components/navigation.ts', 'utf8');

    expect(navigation).toContain("['/', 'Home']");
    expect(navigation).toContain("['/industries', 'Industries']");
    expect(header).toContain("const isHomepage = pathname === '/'");
    expect(header).toContain("primaryNavigationLinks.filter(([href]) => href !== '/')");
    expect(header).toContain('{visibleNavigationLinks.map(([href, label]) => {');
    expect(header).toContain('{[...visibleNavigationLinks, contactLink].map(([href, label]) => {');
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
    expect(header).toContain("const contactLink = ['/contact', \"Let's Talk\"] as const");
    expect(header).not.toContain('Apply Now');
    expect(header).not.toContain('Track Application');
    primaryNavLinks.forEach((label) => expect(navigation).toContain(label));
    ['About', 'Contact'].forEach((label) => expect(navigation).not.toContain(label));
    expect(header).toContain('className="whitespace-nowrap text-[30px] font-extrabold leading-[1] tracking-[-0.04em] text-[#0B1F3A]"');
    expect(header).toContain('focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0B1F3A]');
    expect(header).not.toContain('focus-visible:ring-[#10B981]');
    expect(header).not.toContain('focus:ring-[#10B981]');
    expect(header).not.toContain(`aria-label="Zentric Analytics homepage"
          className="inline-flex shrink-0 items-center rounded-md focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:ring-offset-4"`);
    expect(header).toContain("style={{ fontFamily: 'Manrope, sans-serif' }}");
    expect(header).not.toContain('zentric-wordmark text-[#0B1F3A]');
    const globals = readFileSync('src/app/globals.css', 'utf8');
    expect(globals).toContain('family=Manrope:wght@600;700;800');
    expect(globals).toContain('.site-header a:focus,.site-header button:focus{outline:none;box-shadow:none}');
    expect(globals).toContain('.site-header a:focus-visible,.site-header button:focus-visible{outline:2px solid #0B1F3A;outline-offset:4px;box-shadow:none}');
  });

  it('renders the premium corporate footer navigation and contact resources', () => {
    const footer = readFileSync('src/components/SiteFooter.tsx', 'utf8');
    const navigation = readFileSync('src/components/navigation.ts', 'utf8');

    expect(footer).toContain('bg-[#0B1F3A] text-white');
    expect(footer).toContain('className="zentric-wordmark text-white"');
    expect(footer).toContain('Zentric Analytics');
    expect(footer).toContain('<FooterHeading>Company</FooterHeading>');
    expect(footer).toContain('<FooterHeading>Capabilities</FooterHeading>');
    expect(footer).toContain('<FooterHeading>Resources</FooterHeading>');
    expect(footer).toContain('mailto:hello@example.com');
    expect(footer).toContain('official company email');
    expect(footer).toContain('© 2026 Zentric Analytics. All rights reserved.');
    expect(footer).toContain('Software • Web • AI • Data Analytics • Research');
    expect(footer).not.toContain('SocialLink');
    expect(footer).not.toContain('Newsletter');
    primaryNavLinks.forEach((label) => expect(navigation).toContain(label));
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
