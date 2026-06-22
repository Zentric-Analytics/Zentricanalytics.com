import { adminLoginAction } from './actions';
export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="mx-auto max-w-md px-4 py-12"><h1 className="text-3xl font-bold">Admin login</h1><p className="mt-2 text-slate-600">Use your configured Zentric admin credentials.</p>{error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-red-700">Invalid email or password.</p> : null}<form action={adminLoginAction} className="card mt-6 grid gap-4 p-5"><input className="input" name="email" type="email" placeholder="Admin email" autoComplete="username" required /><input className="input" name="password" type="password" placeholder="Password" autoComplete="current-password" required /><button className="btn btn-primary">Sign in</button></form></main>;
}
