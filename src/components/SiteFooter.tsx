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
  'w-fit rounded-sm py-0.5 text-sm font-normal leading-5 text-white/75 transition-colors duration-200 hover:text-accent';

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
    <footer className="bg-brand text-white" aria-label="Site footer">
      <div className="za-container-wide py-7 sm:py-8">
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.7fr)_minmax(0,0.95fr)_minmax(0,0.8fr)] lg:gap-x-10">
          <section aria-labelledby="footer-company-overview" className="min-w-0">
            <h2
              id="footer-company-overview"
              className="zentric-wordmark text-white"
            >
              Zentric Analytics
            </h2>
            <p className="mt-3 max-w-xs text-sm leading-[1.55] text-white/75">
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

        <div className="mt-6 flex flex-col gap-2 border-t border-white/15 pt-4 text-[13px] leading-5 text-white/70 sm:mt-6 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Zentric Analytics. All rights reserved.</p>
          <p>Software • Web • AI • Data Analytics • Research</p>
        </div>
      </div>
    </footer>
  );
}
