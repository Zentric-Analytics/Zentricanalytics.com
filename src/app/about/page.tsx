import { HoverMotion, Stagger } from '@/components/Motion';
import { PageShell } from '@/components/PageShell';

const aboutCards = [
  {
    title: 'Who we are',
    body: 'Zentric Analytics develops software, web systems, AI-enabled solutions, data workflows, and research-led technology capabilities for organizations that need dependable digital infrastructure.',
  },
  {
    title: 'Mission',
    body: 'To design and deliver maintainable technology systems that help teams operate, analyze, automate, and innovate responsibly.',
  },
  {
    title: 'Vision',
    body: 'To become a trusted engineering partner for practical software, data, AI, and emerging technology adoption.',
  },
  {
    title: 'Values',
    body: 'Technical clarity, privacy-aware design, evidence-based decisions, accessibility, security, and long-term maintainability.',
  },
];

export default function About() {
  return (
    <PageShell>
      <section className="mx-auto w-full max-w-6xl min-w-0 px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
        <Stagger className="max-w-3xl" staggerDelay={90}>
          <p className="mb-3 min-w-0 break-words text-base font-bold uppercase tracking-[0.18em] text-accent">About</p>
          <h1 className="mb-5 max-w-3xl break-words text-3xl font-bold tracking-tight text-ink sm:text-4xl md:text-5xl">
            A technology company committed to careful engineering.
          </h1>
        </Stagger>
        <div className="min-w-0 break-words text-slate-700">
          <Stagger className="grid gap-6 md:grid-cols-2" staggerDelay={100}>
            {aboutCards.map((card) => (
              <div key={card.title}>
                <HoverMotion className="card za-hover-glow p-6">
                  <h2 className="font-bold">{card.title}</h2>
                  <p className="mt-3">{card.body}</p>
                </HoverMotion>
              </div>
            ))}
          </Stagger>
        </div>
      </section>
    </PageShell>
  );
}
