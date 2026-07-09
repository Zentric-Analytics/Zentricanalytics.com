import Link from 'next/link';
import { PageShell } from '@/components/PageShell';
import { Section } from '@/components/Section';

const focus = [
  'Software Development',
  'Web Development',
  'Artificial Intelligence Solutions',
  'Data Analytics',
  'Computer Science R&D',
  'Emerging Technologies',
];

const trustHighlights = ['Enterprise Software', 'AI Systems', 'Data Platforms', 'Research & Innovation'];
const systemMetrics = [
  ['99.8%', 'workflow reliability'],
  ['42ms', 'signal latency'],
  ['8.6k', 'events analyzed'],
];
const architectureLayers = ['Secure web platform', 'AI workflow engine', 'Analytics data layer'];

export default function Home() {
  return (
    <PageShell>
      <section className="relative isolate overflow-hidden bg-ink text-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_20%,rgba(31,122,140,0.36),transparent_32%),radial-gradient(circle_at_82%_16%,rgba(18,60,105,0.72),transparent_30%),linear-gradient(135deg,#070b15_0%,#0c1222_46%,#123c69_100%)]" />
        <div className="absolute inset-0 -z-10 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:72px_72px]" />
        <div className="absolute left-1/2 top-0 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-300/10 blur-3xl" />

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:py-24 lg:grid-cols-[1.02fr_0.98fr] lg:py-28">
          <div className="max-w-3xl">
            <p className="mb-5 inline-flex rounded-full border border-cyan-200/20 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.28em] text-cyan-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
              Zentric Analytics
            </p>
            <h1 className="text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl md:text-6xl lg:text-7xl">
              Engineering intelligent software for ambitious organizations.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-200 sm:text-lg">
              Zentric Analytics designs and builds secure web platforms, AI-enabled workflows, data systems, and research-led technology solutions for organizations that need reliable execution.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link className="btn bg-white px-6 py-3 text-brand shadow-xl shadow-cyan-950/20 transition hover:-translate-y-0.5 hover:bg-cyan-50" href="/services">
                Explore Services
              </Link>
              <Link className="btn border border-white/25 bg-white/5 px-6 py-3 text-white backdrop-blur transition hover:-translate-y-0.5 hover:border-white/45 hover:bg-white/10" href="/about">
                Learn About Us
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-slate-300" aria-label="Zentric Analytics expertise highlights">
              {trustHighlights.map((highlight) => (
                <li className="flex items-center gap-2" key={highlight}>
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.85)]" aria-hidden="true" />
                  {highlight}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:mr-0" aria-label="Abstract software, AI, and data systems visual">
            <div className="absolute -inset-4 rounded-[2.2rem] bg-cyan-300/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.07] p-4 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-5">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_14%,rgba(103,232,249,0.16),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_42%)]" />
              <div className="relative rounded-[1.45rem] border border-white/10 bg-slate-950/72 p-4 sm:p-5">
                <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200">Intelligence layer</p>
                    <p className="mt-1 text-sm text-slate-400">Secure systems orchestration</p>
                  </div>
                  <div className="flex gap-1.5" aria-hidden="true">
                    <span className="h-2.5 w-2.5 rounded-full bg-cyan-300/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-300/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/40" />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {systemMetrics.map(([value, label]) => (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3" key={label}>
                      <p className="text-2xl font-bold text-white">{value}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="relative my-6 h-44 overflow-hidden rounded-2xl border border-cyan-100/10 bg-[linear-gradient(135deg,rgba(18,60,105,0.52),rgba(12,18,34,0.2))]">
                  <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(103,232,249,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(103,232,249,0.5)_1px,transparent_1px)] [background-size:36px_36px]" />
                  <div className="absolute left-[18%] top-[28%] h-3 w-3 rounded-full bg-cyan-200 shadow-[0_0_28px_rgba(103,232,249,0.95)]" />
                  <div className="absolute left-[50%] top-[18%] h-3 w-3 rounded-full bg-white shadow-[0_0_24px_rgba(255,255,255,0.75)]" />
                  <div className="absolute left-[72%] top-[58%] h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_28px_rgba(103,232,249,0.95)]" />
                  <div className="absolute left-[30%] top-[68%] h-2.5 w-2.5 rounded-full bg-blue-200 shadow-[0_0_20px_rgba(191,219,254,0.8)]" />
                  <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 176" fill="none" aria-hidden="true">
                    <path d="M78 50L210 32L306 106L126 124L78 50Z" stroke="rgba(165,243,252,0.55)" strokeWidth="1.5" />
                    <path d="M210 32L126 124" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
                    <path d="M78 50L306 106" stroke="rgba(255,255,255,0.16)" strokeWidth="1.5" />
                  </svg>
                </div>

                <div className="space-y-3">
                  {architectureLayers.map((layer, index) => (
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3" key={layer}>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10 text-xs font-bold text-cyan-100 ring-1 ring-cyan-200/20">0{index + 1}</span>
                      <span className="text-sm font-semibold text-slate-100">{layer}</span>
                      <span className="ml-auto h-1.5 w-16 rounded-full bg-gradient-to-r from-cyan-200/80 to-white/10" aria-hidden="true" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Section eyebrow="Focus areas" title="Built for technical depth and responsible delivery.">
        <div className="grid gap-4 md:grid-cols-3">
          {focus.map((item) => (
            <div className="card p-6" key={item}>
              <h2 className="font-bold text-ink">{item}</h2>
              <p className="mt-2 text-sm">Structured discovery, implementation, validation, documentation, and maintainable handover practices.</p>
            </div>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}
