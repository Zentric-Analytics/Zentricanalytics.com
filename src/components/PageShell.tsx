import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>{children}</main>
      <SiteFooter />
    </div>
  );
}
