import { LockKeyhole } from "lucide-react";
import { hrAccessActivated } from "@/lib/hr/auth/activation";
import { HrAuthShell } from "@/components/HrAuthShell";
import { LoginForm } from "./LoginForm";

export default async function HrLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams; const activated = await hrAccessActivated();
  return <HrAuthShell><div className="hr-auth-heading"><span><LockKeyhole /></span><h2>Welcome back</h2><p>Sign in to your HR workspace</p></div>
    {!activated && <p role="status" className="hr-auth-alert">HR access has not yet been activated. Contact the system administrator.</p>}
    {error && <p role="alert" className="hr-auth-alert error">{error}</p>}<LoginForm />
  </HrAuthShell>;
}
