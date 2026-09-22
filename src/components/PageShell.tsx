import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

export function PageShell({ children, header, footer }: { children: React.ReactNode; header?: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      {header ?? <SiteHeader />}
      <main id="main-content" tabIndex={-1}>{children}</main>
      {footer ?? <SiteFooter />}
    </div>
  );
}
