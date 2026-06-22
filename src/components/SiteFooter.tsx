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
      className="w-fit text-sm font-medium text-slate-300 transition hover:text-white"
      href={href}
    >
      {label}
    </Link>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-slate-800 bg-ink text-white" aria-label="Site footer">
      <div className="mx-auto w-full max-w-6xl min-w-0 px-4 py-10 sm:px-6 lg:px-8">
        <div className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-slate-950/10 sm:p-6 md:p-8">
          <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <section className="min-w-0" aria-labelledby="footer-brand">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-100">
                Zentric Analytics LTD
              </p>
              <h2 id="footer-brand" className="mt-4 max-w-xl break-words text-2xl font-bold tracking-tight sm:text-3xl">
                Reliable software, data, and AI systems for serious work.
              </h2>
              <p className="mt-4 max-w-2xl break-words text-sm leading-6 text-slate-300">
                Zentric Analytics builds disciplined web platforms, software systems, AI-enabled workflows, analytics tools, and research-led technology solutions with careful implementation and maintainable handover practices.
              </p>
              <div className="mt-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link className="btn bg-white text-brand" href="/services">
                  Explore services
                </Link>
                <Link className="btn border border-white/20 bg-transparent text-white hover:bg-white/10" href="/apply">
                  Apply Now
                </Link>
              </div>
            </section>

            <nav className="grid min-w-0 gap-6 sm:grid-cols-2 lg:grid-cols-1" aria-label="Footer navigation">
              <div className="min-w-0">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white">Company</h3>
                <div className="mt-4 flex min-w-0 flex-col gap-3">
                  {companyLinks.map(([href, label]) => (
                    <FooterLink key={href} href={href} label={label} />
                  ))}
                </div>
              </div>

              <div className="min-w-0">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white">Hiring portal</h3>
                <div className="mt-4 flex min-w-0 flex-col gap-3">
                  {hiringLinks.map(([href, label]) => (
                    <FooterLink key={href} href={href} label={label} />
                  ))}
                </div>
              </div>
            </nav>

            <section className="min-w-0" aria-labelledby="footer-focus">
              <h3 id="footer-focus" className="text-sm font-bold uppercase tracking-widest text-white">
                Focus areas
              </h3>
              <div className="mt-4 flex min-w-0 flex-wrap gap-2">
                {focusAreas.map((area) => (
                  <span
                    className="max-w-full break-words rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300"
                    key={area}
                  >
                    {area}
                  </span>
                ))}
              </div>
              <p className="mt-5 min-w-0 break-words rounded-2xl border border-white/10 bg-slate-950/20 p-4 text-sm leading-6 text-slate-300">
                Hiring enrollment documents are released through the staged application workflow after the required review, verification, e-signature, and submission steps.
              </p>
            </section>
          </div>
        </div>

        <div className="mt-6 flex min-w-0 flex-col gap-2 border-t border-white/10 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 break-words">© {year} Zentric Analytics LTD. All rights reserved.</p>
          <p className="min-w-0 break-words">Software • Web • AI • Data Analytics • R&D</p>
        </div>
      </div>
    </footer>
  );
}
