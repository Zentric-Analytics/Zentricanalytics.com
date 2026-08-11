import Link from "next/link";
import { Check, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
type Variant = "request" | "sent" | "new" | "complete";
const copy = {
  request: { title: "Secure password reset", body: "We’ll send a one-time verification code to your work email." },
  sent: { title: "Check your work email", body: "Enter the 6-digit verification code to continue." },
  new: { title: "Create a new password", body: "Choose a strong password to keep your account secure." },
  complete: { title: "Password reset successful", body: "Your password has been updated and your account is secure." },
} satisfies Record<Variant, { title: string; body: string }>;
export function HrPasswordResetShell({ variant, children }: { variant: Variant; children: React.ReactNode }) {
  const Icon = variant === "complete" ? Check : variant === "sent" ? Mail : LockKeyhole;
  return <main className="hr-reset-page"><div className="hr-reset-brand"><span className="hr-reset-logo-mark">Z</span><span><strong>ZENTRIC</strong><small>ANALYTICS HRMS</small></span></div><section className="hr-reset-layout"><aside className={`hr-reset-story ${variant}`} aria-hidden="true"><div className="hr-reset-illustration"><span className="hr-reset-window"/><span className="hr-reset-shield"><ShieldCheck /></span><span className="hr-reset-symbol"><Icon /></span></div><h1>{copy[variant].title}</h1><p>{copy[variant].body}</p><div className="hr-reset-assurance"><ShieldCheck />{variant === "complete" ? "You can now sign in with your new password." : "This helps keep your account safe."}</div></aside><section className="hr-reset-card">{children}</section></section><footer className="hr-reset-footer"><span>© {new Date().getFullYear()} Zentric Analytics. All rights reserved.</span><nav><Link href="/privacy">Privacy policy</Link><Link href="/contact">Need help?</Link></nav></footer></main>;
}
export function ResetHeading({ icon: Icon, title, children }: { icon: typeof LockKeyhole; title: string; children: React.ReactNode }) { return <div className="hr-reset-heading"><span><Icon /></span><h2>{title}</h2><p>{children}</p></div>; }
