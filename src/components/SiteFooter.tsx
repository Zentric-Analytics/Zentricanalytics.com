import Link from 'next/link';

const companyLinks = [
  ['/about', 'About'],
  ['/services', 'Services'],
  ['/careers', 'Careers'],
  ['/contact', 'Contact'],
] as const;

const capabilityLinks = [
  'Software Engineering',
  'Artificial Intelligence',
  'Data & Analytics',
  'Cloud & Infrastructure',
  'Research & Innovation',
  'Emerging Technologies',
] as const;

const resourceLinks = [
  ['/privacy', 'Privacy Policy'],
  ['/terms', 'Terms & Conditions'],
  ['/contact', 'Contact Us'],
] as const;

const footerLinkClasses =
  'w-fit rounded-sm py-0.5 text-sm font-normal leading-5 text-[#CBD5E1] transition-colors duration-200 hover:text-[#10B981] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#10B981]';

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className={footerLinkClasses} href={href}>
      {label}
    </Link>
  );
}

function FooterHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold tracking-[-0.01em] text-white">{children}</h3>;
}

export function SiteFooter() {
  return (
    <footer className="bg-[#0B1F3A] text-white" aria-label="Site footer">
      <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 sm:py-9 lg:px-8 lg:py-10">
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-x-9 sm:gap-y-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.7fr)_minmax(0,0.95fr)_minmax(0,0.8fr)] lg:gap-x-10">
          <section aria-labelledby="footer-company-overview" className="min-w-0">
            <h2
              id="footer-company-overview"
              className="zentric-wordmark text-white"
            >
              Zentric Analytics
            </h2>
            <p className="mt-3 max-w-xs text-sm leading-[1.55] text-[#CBD5E1]">
              Engineering reliable software, artificial intelligence, data platforms, and research-driven technology solutions for organizations building the future.
            </p>
          </section>

          <nav aria-label="Company" className="min-w-0">
            <FooterHeading>Company</FooterHeading>
            <div className="mt-3 flex flex-col gap-1">
              {companyLinks.map(([href, label]) => (
                <FooterLink key={href} href={href} label={label} />
              ))}
            </div>
          </nav>

          <nav aria-label="Capabilities" className="min-w-0">
            <FooterHeading>Capabilities</FooterHeading>
            <div className="mt-3 flex flex-col gap-1">
              {capabilityLinks.map((label) => (
                <FooterLink key={label} href="/services" label={label} />
              ))}
            </div>
          </nav>

          <nav aria-label="Resources" className="min-w-0">
            <FooterHeading>Resources</FooterHeading>
            <div className="mt-3 flex flex-col gap-1">
              {resourceLinks.map(([href, label]) => (
                <FooterLink key={href} href={href} label={label} />
              ))}
              {/* TODO: Update this placeholder email when the official company email is available. */}
              <a className={footerLinkClasses} href="mailto:hello@example.com">
                Email Us
              </a>
            </div>
          </nav>
        </div>

        <div className="mt-7 flex flex-col gap-2 border-t border-[#1E3A5F] pt-5 text-[13px] leading-5 text-[#94A3B8] sm:mt-8 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Zentric Analytics. All rights reserved.</p>
          <p>Software • Web • AI • Data Analytics • Research</p>
        </div>
      </div>
    </footer>
  );
}
