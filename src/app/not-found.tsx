import Link from 'next/link';
import { PageShell } from '@/components/PageShell';

export default function NotFound() {
  return (
    <PageShell>
      <section className="za-container za-section-compact" aria-labelledby="not-found-heading">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">404</p>
          <h1 id="not-found-heading" className="za-page-heading mt-3 text-ink">Page not found</h1>
          <p className="mt-4 leading-7 text-slate-700">
            The page you requested may have moved or may no longer be available.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link className="btn btn-primary" href="/">Return Home</Link>
            <Link className="btn btn-secondary" href="/contact">Contact Us</Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
