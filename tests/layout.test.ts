import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const publicPages = [
  'src/app/page.tsx',
  'src/app/about/page.tsx',
  'src/app/services/page.tsx',
  'src/app/industries/page.tsx',
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

  it('uses one consistent, responsively styled home hero heading', () => {
    const home = readFileSync('src/app/page.tsx', 'utf8');
    const approvedHeading = 'A technology consultancy helping organizations improve how they operate.';
    const heroHeading = home.match(/<h1 className="home-hero-heading[^>]*>([\s\S]*?)<\/h1>/);

    expect(heroHeading).not.toBeNull();
    expect(home.match(/<h1\b/g)).toHaveLength(1);
    expect(home.match(new RegExp(approvedHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toHaveLength(1);
    expect(heroHeading?.[1].trim()).toBe(approvedHeading);
    expect(heroHeading?.[1]).not.toMatch(/(?:sm|md|lg|xl):(?:hidden|block)/);
  });

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
    expect(shell).toContain('<main id="main-content" tabIndex={-1}>{children}</main>');
    expect(shell).toContain('href="#main-content"');
    expect(shell).not.toContain('pt-[4.5rem]');
  });

  it('keeps the Home hero content group clear of the sticky navigation on mobile', () => {
    const home = readFileSync('src/app/page.tsx', 'utf8');

    expect(home).toContain('pt-10 min-[375px]:pt-12');
    expect(home).toContain('md:pt-16');
    expect(home).toContain('lg:pt-12 xl:pt-14');
    expect(home).not.toContain('pb-5 pt-0');
  });

  it('uses a client-side mobile navigation menu with accessible controls', () => {
    const header = readFileSync('src/components/SiteHeader.tsx', 'utf8');

    expect(header.startsWith("'use client';")).toBe(true);
    expect(header).toContain('useState(false)');
    expect(header).toContain('type="button"');
    expect(header).toContain('aria-expanded={isMobileMenuOpen}');
    expect(header).toContain('aria-controls={mobileMenuId}');
    expect(header).toContain("isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'");
    expect(header).toContain('lg:hidden');
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
    expect(header).toContain('lg:hidden');
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
    const css = readFileSync('src/app/globals.css', 'utf8');

    expect(header).toContain('primaryNavigationLinks');
    expect(header).toContain("const contactLink = ['/contact', \"Let's Talk\"] as const");
    expect(header).not.toContain('Apply Now');
    expect(header).not.toContain('Track Application');
    primaryNavLinks.forEach((label) => expect(navigation).toContain(label));
    ['About', 'Contact'].forEach((label) => expect(navigation).not.toContain(label));
    expect(header).toContain('className="zentric-wordmark text-brand"');
    expect(css).toContain('.site-header .zentric-wordmark{font-size:1.625rem}');
    expect(css).toContain('.site-header .zentric-wordmark{font-size:2rem}');
    expect(header).toContain('className={`za-container-wide');
    expect(header).not.toContain('focus-visible:ring-[#10B981]');
    expect(header).not.toContain('focus:ring-[#10B981]');
    expect(header).not.toContain(`aria-label="Zentric Analytics homepage"
          className="inline-flex shrink-0 items-center rounded-md focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:ring-offset-4"`);
    expect(header).not.toContain("style={{ fontFamily: 'var(--font-manrope), sans-serif' }}");
    expect(header).not.toContain('zentric-wordmark text-[#0B1F3A]');
    const layout = readFileSync('src/app/layout.tsx', 'utf8');
    expect(layout).toContain("import { Inter, Manrope } from 'next/font/google'");
    expect(layout).toContain("weight: ['600', '700', '800']");
    const globals = readFileSync('src/app/globals.css', 'utf8');
    expect(globals).not.toContain('fonts.googleapis.com');
    expect(globals).toContain('font-family:var(--font-manrope)');
    expect(globals).toContain('.site-header a:focus,.site-header button:focus{outline:none;box-shadow:none}');
    expect(globals).toContain('.site-header a:focus-visible,.site-header button:focus-visible{outline:2px solid #0B1F3A;outline-offset:4px;box-shadow:none}');
  });


  it('renders the careers open roles CTA with apply and tracking actions', () => {
    const careers = readFileSync('src/app/careers/page.tsx', 'utf8');

    expect(careers).toContain('<Link className="btn btn-primary za-button-motion w-full text-base sm:w-auto" href="/apply">Apply Now</Link>');
    expect(careers).toContain('<Link className="btn btn-secondary za-button-motion w-full text-base sm:w-auto" href="/track">Track Application</Link>');
    expect(careers).toContain('mt-8 grid grid-cols-1 gap-x-5 gap-y-[18px] md:grid-cols-2 lg:mt-10 lg:grid-cols-3');
    expect(careers).toContain('group flex min-w-0 flex-col rounded-[20px] border border-[#E3EAF1] bg-white p-5');
    expect(careers).toContain('flex min-w-0 items-center gap-4');
    expect(careers).toContain('flex size-11 shrink-0 items-center justify-center rounded-[16px] bg-[#EEF8F5]');
    expect(careers).not.toContain('Apply for this role');
    expect(careers).toContain('flex w-full max-w-[280px] flex-col items-stretch gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:items-start');
    expect(careers).toContain('<Link className="btn hero-cta-secondary w-full sm:w-auto" href="/track">Track Application</Link>');
  });

  it('renders the premium corporate footer navigation and contact resources', () => {
    const footer = readFileSync('src/components/SiteFooter.tsx', 'utf8');
    const navigation = readFileSync('src/components/navigation.ts', 'utf8');

    expect(footer).toContain('bg-brand text-white');
    expect(footer).toContain('className="za-container-wide');
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
    expect(header).toContain('lg:hidden');
    expect(header).not.toContain('fixed inset-x-0 top-0 z-50');
  });

  it.each(publicPages)('%s uses PageShell for the shared header layout', (pagePath) => {
    const page = readFileSync(pagePath, 'utf8');

    expect(page).toContain('PageShell');
    expect(page).toContain('<PageShell>');
  });
});
