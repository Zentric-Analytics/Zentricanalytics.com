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

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      className="w-fit text-sm font-normal leading-6 text-[#E5E7EB] underline-offset-4 transition-colors duration-200 hover:text-[#10B981] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#4FC3F7]"
      href={href}
    >
      {label}
    </Link>
  );
}

function FooterHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-medium tracking-[0.08em] text-white">{children}</h3>;
}

function LinkedInIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M7.2 9.2V18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
      <path d="M11 18v-4.8c0-2.35 1.32-4 3.44-4 2.05 0 3.36 1.42 3.36 4V18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
      <path d="M7.2 6.1h.01" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
      <path d="M4.75 3.75h14.5a1 1 0 0 1 1 1v14.5a1 1 0 0 1-1 1H4.75a1 1 0 0 1-1-1V4.75a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M9.25 19.25v-2.7c-2.95.65-3.55-1.25-3.55-1.25-.48-1.22-1.18-1.55-1.18-1.55-.97-.66.07-.65.07-.65 1.07.08 1.64 1.1 1.64 1.1.95 1.63 2.5 1.16 3.1.89.1-.7.38-1.17.68-1.44-2.35-.27-4.82-1.18-4.82-5.24 0-1.16.41-2.1 1.1-2.84-.11-.27-.48-1.35.1-2.8 0 0 .9-.29 2.94 1.08a10.2 10.2 0 0 1 5.36 0c2.04-1.37 2.94-1.08 2.94-1.08.58 1.45.21 2.53.1 2.8.69.74 1.1 1.68 1.1 2.84 0 4.08-2.48 4.96-4.85 5.23.39.34.73 1 .73 2v3.61" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 text-white transition-colors duration-200 hover:border-[#10B981] hover:text-[#10B981] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#4FC3F7]"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {children}
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-[#0B1F3A] text-white" aria-label="Site footer">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-10">
          <section aria-labelledby="footer-company-identity" className="min-w-0">
            <h2 id="footer-company-identity" className="text-2xl font-bold tracking-tight text-white">
              Zentric Analytics
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-[#E5E7EB]">
              Engineering reliable software, artificial intelligence, data platforms, and research-driven technology solutions for organizations building the future.
            </p>
            <div className="mt-7 flex items-center gap-3" aria-label="Social links">
              <SocialLink href="https://www.linkedin.com" label="Zentric Analytics on LinkedIn">
                <LinkedInIcon />
              </SocialLink>
              <SocialLink href="https://github.com" label="Zentric Analytics on GitHub">
                <GitHubIcon />
              </SocialLink>
            </div>
          </section>

          <nav aria-label="Company" className="min-w-0">
            <FooterHeading>Company</FooterHeading>
            <div className="mt-5 flex flex-col gap-3">
              {companyLinks.map(([href, label]) => (
                <FooterLink key={href} href={href} label={label} />
              ))}
            </div>
          </nav>

          <nav aria-label="Capabilities" className="min-w-0">
            <FooterHeading>Capabilities</FooterHeading>
            <div className="mt-5 flex flex-col gap-3">
              {capabilityLinks.map((label) => (
                <FooterLink key={label} href="/services" label={label} />
              ))}
            </div>
          </nav>

          <nav aria-label="Resources" className="min-w-0">
            <FooterHeading>Resources</FooterHeading>
            <div className="mt-5 flex flex-col gap-3">
              {resourceLinks.map(([href, label]) => (
                <FooterLink key={href} href={href} label={label} />
              ))}
              {/* Placeholder email address for future company contact update. */}
              <a
                className="w-fit text-sm font-normal leading-6 text-[#E5E7EB] underline-offset-4 transition-colors duration-200 hover:text-[#10B981] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#4FC3F7]"
                href="mailto:hello@example.com"
              >
                Email Us
              </a>
            </div>
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/15 pt-6 text-sm text-[#E5E7EB] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Zentric Analytics. All rights reserved.</p>
          <p>Built with precision.</p>
        </div>
      </div>
    </footer>
  );
}
