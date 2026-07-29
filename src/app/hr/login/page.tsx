import Link from "next/link";
import { hrLoginAction } from "./actions";

export default async function HrLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="min-h-screen bg-slate-100 px-4 py-16"><section className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"><p className="text-sm font-bold uppercase tracking-widest text-teal-700">Zentric Analytics</p><h1 className="mt-2 text-3xl font-bold text-slate-950">HR workspace</h1><p className="mt-2 text-slate-600">Authorized staff and employees only.</p>{error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}<form action={hrLoginAction} className="mt-6 space-y-4"><label className="block text-sm font-semibold">Work email<input className="input mt-1" name="email" type="email" autoComplete="username" required /></label><label className="block text-sm font-semibold">Password<input className="input mt-1" name="password" type="password" autoComplete="current-password" required /></label><button className="btn btn-primary w-full">Sign in securely</button></form><Link className="mt-4 inline-block text-sm font-semibold text-teal-700" href="/hr/password-reset">Forgot password?</Link></section></main>;
}
