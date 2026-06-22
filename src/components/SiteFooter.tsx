import Link from 'next/link';

const companyLinks = [
  ['/', 'Home'],
  ['/about', 'About'],
  ['/services', 'Services'],
  ['/careers', 'Careers'],
] as const;

const hiringLinks = [
  ['/apply', 'Apply Now'],
  ['/track', 'Track Application'],
  ['/careers', 'Careers Overview'],
] as const;

const focusAreas = [
  'Software development',
  'Web platforms',
  'AI solutions',
  'Data analytics',
  'Computer science R&D',
  'Emerging technologies',
];

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      className="w-fit text-sm font-medium text-slate-600 transition hover:text-brand"
      href={href}
    >
      {label}
    </Link>
  );
}

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-ink">
      {children}
    </h3>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-slate-200 bg-white text-ink" aria-label="Site footer">
      <div className="mx-auto w-full max-w-6xl min-w-0 px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.75fr)_minmax(0,0.95fr)_minmax(0,1fr)]">
          <section className="min-w-0" aria-labelledby="footer-brand">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">
              Zentric Analytics LTD
            </p>
            <h2 id="footer-brand" className="mt-4 max-w-xl break-words text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Reliable software, data, and AI systems for serious work.
            </h2>
            <p className="mt-4 max-w-2xl break-words text-sm leading-6 text-slate-600">
              Zentric Analytics builds disciplined web platforms, software systems, AI-enabled workflows, analytics tools, and research-led technology solutions with careful implementation and maintainable handover practices.
            </p>
            <div className="mt-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link className="btn btn-primary" href="/services">
                Explore services
              </Link>
              <Link className="btn btn-secondary" href="/apply">
                Apply Now
              </Link>
            </div>
          </section>

          <nav className="min-w-0 border-t border-slate-200 pt-6 sm:border-t-0 sm:pt-0" aria-label="Company links">
            <FooterHeading>Company</FooterHeading>
            <div className="mt-4 flex min-w-0 flex-col gap-3">
              {companyLinks.map(([href, label]) => (
                <FooterLink key={href} href={href} label={label} />
              ))}
            </div>
          </nav>

          <nav className="min-w-0 border-t border-slate-200 pt-6 sm:border-t-0 sm:pt-0" aria-label="Hiring portal links">
            <FooterHeading>Hiring portal</FooterHeading>
            <div className="mt-4 flex min-w-0 flex-col gap-3">
              {hiringLinks.map(([href, label]) => (
                <FooterLink key={href} href={href} label={label} />
              ))}
            </div>
          </nav>

          <section className="min-w-0 border-t border-slate-200 pt-6 sm:border-t-0 sm:pt-0" aria-labelledby="footer-focus">
            <FooterHeading>Focus areas</FooterHeading>
            <ul id="footer-focus" className="mt-4 grid min-w-0 gap-2">
              {focusAreas.map((area) => (
                <li className="flex min-w-0 items-start gap-2 text-sm leading-6 text-slate-600" key={area}>
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  <span className="min-w-0 break-words">{area}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 min-w-0 border-l-2 border-accent/40 pl-4 text-sm leading-6 text-slate-600">
              Hiring enrollment documents are released after review, verification, e-signature, and submission steps in the staged application workflow.
            </p>
          </section>
        </div>

        <div className="mt-10 flex min-w-0 flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 break-words">© {year} Zentric Analytics LTD. All rights reserved.</p>
          <p className="min-w-0 break-words">Software • Web • AI • Data Analytics • R&D</p>
        </div>
      </div>
    </footer>
  );
}
