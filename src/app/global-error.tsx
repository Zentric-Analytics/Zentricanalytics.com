'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body><main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center"><h1>Service temporarily unavailable</h1><p>Please try again in a moment.</p><button type="button" onClick={reset}>Try again</button></main></body>
    </html>
  );
}
