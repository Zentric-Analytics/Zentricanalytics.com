import Link from 'next/link';

export function SiteHeader() {
  const links = [['/', 'Home'], ['/about', 'About'], ['/services', 'Services'], ['/careers', 'Careers'], ['/track', 'Track Application']];

  return (
    <header className="border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="min-w-0 flex-1 truncate font-bold text-brand md:flex-none">
          Zentric Analytics Ltd
        </Link>
        <div className="hidden min-w-0 items-center gap-5 md:flex">
          {links.map(([href, label]) => (
            <Link className="whitespace-nowrap text-sm font-medium text-slate-700 hover:text-brand" key={href} href={href}>
              {label}
            </Link>
          ))}
        </div>
        <Link className="btn btn-primary shrink-0 px-3 py-2 text-sm sm:px-4 sm:py-3" href="/apply">
          Apply Now
        </Link>
      </nav>
    </header>
  );
}
