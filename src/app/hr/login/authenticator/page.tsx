import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { HrAuthShell } from "@/components/HrAuthShell";
import { cancelHrMfaAction } from "../actions";
import { OtpForm } from "./OtpForm";

export default async function AuthenticatorPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!(await cookies()).has("za_hr_mfa_challenge")) redirect("/hr/login"); const { error } = await searchParams;
  return <HrAuthShell><form action={cancelHrMfaAction}><button className="hr-auth-back">← Back</button></form><div className="hr-auth-heading"><span><ShieldCheck /></span><h2>Enter authenticator code</h2><p>Open your authenticator app and enter the 6-digit code.</p></div>{error && <p role="alert" className="hr-auth-alert error">{error}</p>}<OtpForm /><p className="hr-auth-note"><ShieldCheck />This code changes frequently and is valid for a short time.</p></HrAuthShell>;
}
