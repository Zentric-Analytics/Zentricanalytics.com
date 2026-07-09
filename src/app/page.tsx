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

function HeroImagePlaceholder() {
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-lg overflow-hidden lg:mr-0" aria-label="Future premium engineering workspace hero image placement">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(79,195,247,0.18),transparent_30%),linear-gradient(135deg,rgba(23,59,103,0.64),rgba(11,31,58,0.2)_52%,rgba(16,185,129,0.12))]" />
      <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-[#0B1F3A]/80 to-transparent" />
      <div className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-[#173B67]/45 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#0B1F3A]/70 to-transparent" />
      <div className="absolute inset-10 border-l border-t border-cyan-100/10" aria-hidden="true" />
      <div className="absolute bottom-10 left-10 right-10 h-px bg-gradient-to-r from-transparent via-cyan-100/25 to-transparent" aria-hidden="true" />
      <span className="sr-only">Reserved area for the future Zentric Analytics hero image.</span>
    </div>
  );
}

export default function Home() {
  return (
    <PageShell>
      <section className="relative isolate overflow-hidden bg-ink text-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_18%,rgba(31,122,140,0.36),transparent_31%),radial-gradient(circle_at_82%_22%,rgba(18,60,105,0.66),transparent_34%),radial-gradient(circle_at_64%_82%,rgba(34,211,238,0.13),transparent_34%),linear-gradient(135deg,#0B1F3A_0%,#173B67_58%,#0f766e_100%)]" />
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
              <stop stopColor="#173B67" stopOpacity="0" />
              <stop offset="0.48" stopColor="#a5f3fc" stopOpacity="0.36" />
              <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute left-1/2 top-0 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 -z-10 h-80 w-80 translate-x-1/4 translate-y-1/4 rounded-full bg-teal-300/10 blur-3xl" />

        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-24 sm:py-28 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-16 lg:py-36">
          <div className="max-w-3xl">
            <p className="mb-7 inline-flex text-xs font-bold uppercase tracking-[0.32em] text-cyan-100/90">
              ZENTRIC ANALYTICS
            </p>
            <h1 className="max-w-4xl text-4xl font-bold tracking-[-0.045em] text-white sm:text-5xl md:text-6xl lg:text-7xl lg:leading-[0.98]">
              Engineering reliable software, data, and AI systems for serious work.
            </h1>
            <p className="mt-8 max-w-2xl text-base leading-8 text-slate-200 sm:text-lg sm:leading-9">
              Zentric Analytics is a technology company focused on disciplined software delivery, web platforms, artificial intelligence solutions, analytics, computer science research, and emerging technology implementation.
            </p>
            <div className="mt-11 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
              <Link className="btn bg-white px-7 py-3.5 text-brand shadow-xl shadow-cyan-950/20 transition hover:-translate-y-0.5 hover:bg-cyan-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100" href="/services">
                Explore Services
              </Link>
              <Link className="btn border border-white/25 bg-transparent px-7 py-3.5 text-white transition hover:-translate-y-0.5 hover:border-cyan-100/45 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100" href="/contact">
                Let&apos;s Talk
              </Link>
            </div>
          </div>

          <HeroImagePlaceholder />
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
