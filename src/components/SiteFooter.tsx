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
      className="w-fit rounded-sm text-sm font-normal leading-6 text-[#64748B] underline-offset-4 transition-colors duration-200 hover:text-[#10B981] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#10B981]"
      href={href}
    >
      {label}
    </Link>
  );
}

function FooterHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold tracking-[-0.01em] text-[#111827]">{children}</h3>;
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[#E5E7EB] bg-white text-[#111827]" aria-label="Site footer">
      <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="grid gap-10 sm:grid-cols-2 sm:gap-x-12 sm:gap-y-12 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-10">
          <section aria-labelledby="footer-company-overview" className="min-w-0">
            <h2
              id="footer-company-overview"
              className="text-sm font-bold uppercase tracking-[0.18em] text-[#111827]"
            >
              ZENTRIC ANALYTICS
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-[#64748B]">
              Engineering reliable software, artificial intelligence, data platforms, and research-driven technology solutions for organizations building the future.
            </p>
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
              {/* TODO: Update this placeholder email when the official company email is available. */}
              <a
                className="w-fit rounded-sm text-sm font-normal leading-6 text-[#64748B] underline-offset-4 transition-colors duration-200 hover:text-[#10B981] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#10B981]"
                href="mailto:hello@example.com"
              >
                Email Us
              </a>
            </div>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-[#E5E7EB] pt-6 text-sm leading-6 text-[#64748B] sm:mt-14 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Zentric Analytics. All rights reserved.</p>
          <p className="text-[#111827]">Software • Web • AI • Data Analytics • Research</p>
        </div>
      </div>
    </footer>
  );
}
