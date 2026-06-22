import { SiteHeader } from './SiteHeader';

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <SiteHeader />
      <main className="pt-[4.5rem]">{children}</main>
      <footer className="border-t bg-ink text-white">
        <div className="mx-auto grid w-full max-w-6xl min-w-0 gap-4 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
          <p className="min-w-0 break-words font-bold">Zentric Analytics Ltd</p>
          <p className="min-w-0 break-words text-sm text-slate-300">Software, web, AI, data analytics, computer science R&D, and emerging technology solutions.</p>
          <p className="min-w-0 break-words text-sm text-slate-300">Hiring enrollment documents are released only after secure verification and signed submission.</p>
        </div>
      </footer>
    </div>
  );
}
