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
  ['99.8%', 'delivery reliability'],
  ['42ms', 'signal latency'],
  ['8.6k', 'events analyzed'],
];
const systemModules = [
  ['Software Systems', 'Validated release paths'],
  ['AI Workflows', 'Model-assisted operations'],
  ['Data Platforms', 'Governed analytics layer'],
  ['Research Layer', 'Emerging technology review'],
];
export default function Home() {
  return (
    <PageShell>
      <section className="relative isolate overflow-hidden bg-ink text-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_18%,rgba(31,122,140,0.36),transparent_31%),radial-gradient(circle_at_82%_22%,rgba(18,60,105,0.66),transparent_34%),radial-gradient(circle_at_64%_82%,rgba(34,211,238,0.13),transparent_34%),linear-gradient(135deg,#070b15_0%,#0c1222_48%,#123c69_100%)]" />
        <div className="absolute inset-0 -z-10 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.75)_1px,transparent_0)] [background-size:28px_28px]" />
        <svg className="absolute inset-x-0 top-4 -z-10 h-[34rem] w-full opacity-30" viewBox="0 0 1440 540" fill="none" aria-hidden="true">
          <path d="M-40 318C160 248 262 262 420 176C596 80 754 82 914 148C1074 214 1198 194 1488 54" stroke="url(#hero-line-a)" strokeWidth="1" />
          <path d="M104 432C294 364 420 394 548 294C678 192 826 198 964 272C1114 352 1256 330 1458 232" stroke="url(#hero-line-b)" strokeWidth="1" />
          <path d="M246 118L420 176L548 294L914 148L964 272L1198 194" stroke="rgba(165,243,252,0.16)" strokeWidth="1" strokeDasharray="6 14" />
          <defs>
            <linearGradient id="hero-line-a" x1="-40" y1="318" x2="1488" y2="54" gradientUnits="userSpaceOnUse">
              <stop stopColor="#22d3ee" stopOpacity="0" />
              <stop offset="0.45" stopColor="#67e8f9" stopOpacity="0.55" />
              <stop offset="1" stopColor="#1f7a8c" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="hero-line-b" x1="104" y1="432" x2="1458" y2="232" gradientUnits="userSpaceOnUse">
              <stop stopColor="#123c69" stopOpacity="0" />
              <stop offset="0.48" stopColor="#a5f3fc" stopOpacity="0.36" />
              <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute left-1/2 top-0 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 -z-10 h-80 w-80 translate-x-1/4 translate-y-1/4 rounded-full bg-teal-300/10 blur-3xl" />

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 sm:py-28 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14 lg:py-32">
          <div className="max-w-3xl">
            <p className="mb-6 inline-flex rounded-full border border-cyan-200/20 bg-white/[0.06] px-4 py-2 text-xs font-bold uppercase tracking-[0.28em] text-cyan-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
              ZENTRIC ANALYTICS
            </p>
            <h1 className="text-4xl font-bold tracking-[-0.045em] text-white sm:text-5xl md:text-6xl lg:text-7xl">
              Engineering reliable software, data, and AI systems for serious work.
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-slate-200 sm:text-lg sm:leading-9">
              Zentric Analytics is a technology company focused on disciplined software delivery, web platforms, artificial intelligence solutions, analytics, computer science research, and emerging technology implementation.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link className="btn bg-white px-6 py-3 text-brand shadow-xl shadow-cyan-950/20 transition hover:-translate-y-0.5 hover:bg-cyan-50" href="/services">
                Explore services
              </Link>
              <Link className="btn border border-white/25 bg-white/5 px-6 py-3 text-white backdrop-blur transition hover:-translate-y-0.5 hover:border-cyan-100/45 hover:bg-white/10" href="/careers">
                Careers
              </Link>
            </div>
            <ul className="mt-9 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-slate-300" aria-label="Zentric Analytics expertise highlights">
              {trustHighlights.map((highlight) => (
                <li className="flex items-center gap-2" key={highlight}>
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.85)]" aria-hidden="true" />
                  {highlight}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:mr-0" aria-label="Zentric Analytics software, AI, data, and research systems visual">
            <div className="absolute -inset-5 rounded-[2.5rem] bg-cyan-300/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2.1rem] border border-white/15 bg-white/[0.075] p-4 shadow-2xl shadow-black/35 backdrop-blur-xl sm:p-5">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_14%,rgba(103,232,249,0.18),transparent_30%),radial-gradient(circle_at_86%_74%,rgba(31,122,140,0.2),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.1),transparent_44%)]" />
              <div className="relative rounded-[1.55rem] border border-white/10 bg-slate-950/78 p-4 sm:p-5">
                <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200">Engineering command layer</p>
                    <p className="mt-1 text-sm text-slate-400">Software · AI · Data · Research</p>
                  </div>
                  <div className="rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-xs font-bold text-cyan-100">Stable</div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {systemMetrics.map(([value, label]) => (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 shadow-lg shadow-black/10" key={label}>
                      <p className="text-2xl font-bold text-white">{value}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="relative my-6 min-h-64 overflow-hidden rounded-2xl border border-cyan-100/10 bg-[linear-gradient(135deg,rgba(18,60,105,0.55),rgba(12,18,34,0.3))] p-4">
                  <svg className="absolute inset-0 h-full w-full" viewBox="0 0 460 260" fill="none" aria-hidden="true">
                    <path d="M104 70L236 50L356 116L274 196L118 176L104 70Z" stroke="rgba(165,243,252,0.5)" strokeWidth="1.2" />
                    <path d="M236 50L118 176M104 70L356 116M274 196L236 50" stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" />
                  </svg>
                  <div className="absolute left-[22%] top-[25%] h-3 w-3 rounded-full bg-cyan-200 shadow-[0_0_28px_rgba(103,232,249,0.95)]" />
                  <div className="absolute left-[51%] top-[18%] h-3 w-3 rounded-full bg-white shadow-[0_0_24px_rgba(255,255,255,0.72)]" />
                  <div className="absolute left-[76%] top-[44%] h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_28px_rgba(103,232,249,0.95)]" />
                  <div className="absolute left-[59%] top-[75%] h-2.5 w-2.5 rounded-full bg-blue-200 shadow-[0_0_20px_rgba(191,219,254,0.8)]" />
                  <div className="relative grid gap-3 sm:grid-cols-2">
                    {systemModules.map(([title, detail]) => (
                      <div className="rounded-2xl border border-white/10 bg-slate-950/62 p-3 shadow-xl shadow-black/15 backdrop-blur" key={title}>
                        <p className="text-sm font-bold text-slate-100">{title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                  <div className="flex items-center justify-between gap-4 text-xs font-bold uppercase tracking-[0.18em] text-cyan-100">
                    <span>Validated delivery path</span>
                    <span>04 layers</span>
                  </div>
                  <div className="mt-4 flex items-center gap-2" aria-hidden="true">
                    <span className="h-2 flex-1 rounded-full bg-cyan-200/80 shadow-[0_0_18px_rgba(103,232,249,0.45)]" />
                    <span className="h-2 flex-1 rounded-full bg-teal-300/60" />
                    <span className="h-2 flex-1 rounded-full bg-blue-300/45" />
                    <span className="h-2 flex-1 rounded-full bg-white/25" />
                  </div>
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
