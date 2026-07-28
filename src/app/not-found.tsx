import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Page not found', robots: { index: false, follow: false } };

export default function NotFound() {
  return <main id="main-content" className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 text-center"><p className="font-semibold text-blue-700">404</p><h1 className="mt-2 font-heading text-4xl font-bold">Page not found</h1><p className="mt-4 text-slate-600">The page you requested does not exist or has moved.</p><Link href="/" className="mt-6 rounded-md bg-slate-950 px-5 py-3 font-semibold text-white">Return home</Link></main>;
}
