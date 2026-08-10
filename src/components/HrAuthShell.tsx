import Link from "next/link";
import { Laptop, ShieldCheck, Users } from "lucide-react";

export function HrAuthShell({ children }: { children: React.ReactNode }) {
  return <main className="hr-auth-page"><section className="hr-auth-card">
    <aside className="hr-auth-brand">
      <div className="hr-auth-logo"><span>Z</span><strong>ZENTRIC<br /><small>ANALYTICS</small></strong></div>
      <div><h1>HR workspace</h1><p>Secure access for authorized staff and employees.</p></div>
      <div className="hr-auth-benefits">
        <div><span><ShieldCheck /></span><p><strong>Secure &amp; private</strong><small>Your data is protected with enterprise-grade security.</small></p></div>
        <div><span><Users /></span><p><strong>For employees &amp; staff</strong><small>Access the tools you need to do your best work.</small></p></div>
        <div><span><Laptop /></span><p><strong>Anytime, anywhere</strong><small>Log in securely from any device, anytime.</small></p></div>
      </div>
      <div className="hr-auth-office" aria-hidden="true"><div className="window" /><div className="desk" /><div className="chair" /><div className="plant">♧</div></div>
    </aside>
    <div className="hr-auth-content">{children}</div>
    <footer><ShieldCheck />By signing in, you agree to our <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>.</footer>
  </section></main>;
}
