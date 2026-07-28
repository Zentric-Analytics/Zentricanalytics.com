'use client';

import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Preserve the digest for an attached monitoring service without exposing details to visitors.
    console.error('routeRenderFailure', { digest: error.digest, name: error.name });
  }, [error]);

  return (
    <main id="main-content" className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 text-center">
      <h1 className="font-heading text-3xl font-bold">Something went wrong</h1>
      <p className="mt-4 text-slate-600">We could not load this page. Please try again.</p>
      <button type="button" onClick={reset} className="mt-6 rounded-md bg-slate-950 px-5 py-3 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Try again</button>
    </main>
  );
}
