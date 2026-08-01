import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
      <section aria-labelledby="forbidden-heading" className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-700">Access denied · 403</p>
        <h1 id="forbidden-heading" className="mt-3 text-3xl font-bold text-slate-950">You do not have permission to view this page</h1>
        <p className="mt-4 leading-7 text-slate-600">Your account is signed in, but its assigned HR role does not permit access to this workspace. No data was disclosed.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link className="rounded-full bg-slate-950 px-5 py-3 font-bold text-white" href="/hr">Return to my HR workspace</Link>
          <Link className="rounded-full border border-slate-300 px-5 py-3 font-bold text-slate-800" href="/hr/security">Review account security</Link>
        </div>
      </section>
    </main>
  );
}
