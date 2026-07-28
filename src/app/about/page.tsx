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
      <section className="za-container za-section-compact">
        <Stagger className="max-w-3xl" staggerDelay={90}>
          <p className="za-eyebrow mb-3 min-w-0 break-words">About</p>
          <h1 className="za-page-heading mb-5 max-w-3xl break-words text-ink">
            A technology company committed to careful engineering.
          </h1>
        </Stagger>
        <div className="min-w-0 break-words text-slate-700">
          <Stagger className="grid gap-6 md:grid-cols-2" staggerDelay={100}>
            {aboutCards.map((card) => (
              <div key={card.title}>
                <HoverMotion className="card za-hover-glow p-6">
                  <h2 className="text-lg font-bold sm:text-xl lg:text-2xl">{card.title}</h2>
                  <p className="mt-3 text-sm sm:text-[0.9375rem]">{card.body}</p>
                </HoverMotion>
              </div>
            ))}
          </Stagger>
        </div>
      </section>
    </PageShell>
  );
}
