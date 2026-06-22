import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <SiteHeader />
      <main className="pt-[4.5rem]">{children}</main>
      <SiteFooter />
    </div>
  );
}
