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
  'w-fit rounded-sm py-1 text-sm font-normal leading-6 text-[#CBD5E1] transition-colors duration-200 hover:text-[#10B981] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#10B981]';

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
      <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-12">
        <div className="grid gap-7 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-9 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.72fr)_minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-x-12">
          <section aria-labelledby="footer-company-overview" className="min-w-0">
            <h2
              id="footer-company-overview"
              className="text-sm font-bold uppercase tracking-[0.18em] text-white"
            >
              ZENTRIC ANALYTICS
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[#CBD5E1]">
              Engineering reliable software, artificial intelligence, data platforms, and research-driven technology solutions for organizations building the future.
            </p>
          </section>

          <nav aria-label="Company" className="min-w-0">
            <FooterHeading>Company</FooterHeading>
            <div className="mt-3 flex flex-col gap-1.5">
              {companyLinks.map(([href, label]) => (
                <FooterLink key={href} href={href} label={label} />
              ))}
            </div>
          </nav>

          <nav aria-label="Capabilities" className="min-w-0">
            <FooterHeading>Capabilities</FooterHeading>
            <div className="mt-3 flex flex-col gap-1.5">
              {capabilityLinks.map((label) => (
                <FooterLink key={label} href="/services" label={label} />
              ))}
            </div>
          </nav>

          <nav aria-label="Resources" className="min-w-0">
            <FooterHeading>Resources</FooterHeading>
            <div className="mt-3 flex flex-col gap-1.5">
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

        <div className="mt-8 flex flex-col gap-3 border-t border-[#1E3A5F] pt-5 text-sm leading-6 text-[#94A3B8] sm:mt-9 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Zentric Analytics. All rights reserved.</p>
          <p>Software • Web • AI • Data Analytics • Research</p>
        </div>
      </div>
    </footer>
  );
}
