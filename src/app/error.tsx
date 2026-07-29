'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report the full error through the deployment's server/client monitoring integration.
    console.error(error);
  }, [error]);

  return (
    <main id="main-content" className="za-container za-section-compact" tabIndex={-1}>
      <section className="mx-auto max-w-2xl text-center" aria-labelledby="error-heading">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Something went wrong</p>
        <h1 id="error-heading" className="za-page-heading mt-3 text-ink">We could not load this page</h1>
        <p className="mt-4 leading-7 text-slate-700">
          Please try again. If the problem continues, return home or contact our team.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button className="btn btn-primary" type="button" onClick={reset}>Try Again</button>
          <Link className="btn btn-secondary" href="/">Return Home</Link>
        </div>
      </section>
    </main>
  );
}
