import Link from 'next/link';
import { Stagger } from '@/components/Motion';
import { PageShell } from '@/components/PageShell';

const aboutCards = [
  { title: 'Why we exist', body: 'Organizations often inherit disconnected tools, manual processes, and technology decisions that are difficult to maintain. Zentric Analytics exists to turn those constraints into clear, workable systems that support the people responsible for operating them.' },
  { title: 'Our mission', body: 'Design and deliver maintainable technology that helps teams operate, analyze information, automate appropriate work, and improve services responsibly.' },
  { title: 'Our direction', body: 'Build long-term engineering partnerships based on useful outcomes, sound technical decisions, and systems that organizations can understand and sustain.' },
  { title: 'How decisions are made', body: 'We favor evidence over novelty, clear ownership over hidden complexity, and measured delivery over unsupported promises. Accessibility, privacy, security, and maintainability are considered throughout the work.' },
];

const approach = [
  ['Understand the operating context', 'We identify users, decision-makers, workflows, constraints, risks, and the result the organization needs.'],
  ['Make the work visible', 'We define scope, review points, responsibilities, and trade-offs so stakeholders can make informed decisions.'],
  ['Deliver in controlled stages', 'We test assumptions early, build maintainable foundations, and validate the system with the people who will use and operate it.'],
  ['Plan beyond release', 'Documentation, handover, monitoring, and ongoing improvement are part of delivery planning rather than afterthoughts.'],
] as const;

export default function About() {
  return (
    <PageShell>
      <section className="za-container za-section-compact">
        <Stagger className="max-w-3xl" staggerDelay={90}>
          <h1 className="za-page-heading mb-4 max-w-3xl break-words text-ink">Careful engineering for technology that matters to daily operations.</h1>
          <p className="mb-7 max-w-2xl text-[0.9375rem] leading-7 text-slate-700">Zentric Analytics is a technology consultancy. We work with organizations that need direct advice, dependable delivery, and a partner who considers how a system will be operated after launch.</p>
        </Stagger>
        <Stagger className="grid overflow-hidden rounded-[24px] border border-[#DCE3EA] bg-white md:grid-cols-2" staggerDelay={100}>
          {aboutCards.map((card) => <article className="border-b border-[#DCE3EA] p-5 transition-colors duration-200 hover:bg-[#F8FAFC] sm:p-6 md:[&:nth-child(n+3)]:border-b-0 md:odd:border-r" key={card.title}><h2 className="text-lg font-bold sm:text-xl lg:text-2xl">{card.title}</h2><p className="mt-3 text-sm sm:text-[0.9375rem]">{card.body}</p></article>)}
        </Stagger>
      </section>
      <section className="border-t border-[#DCE3EA] bg-[#F7F9FC]">
        <div className="za-container za-section-compact">
          <Stagger className="max-w-2xl" staggerDelay={90}>
            <h2 className="text-[28px] font-bold tracking-[-0.04em] text-[#0B1F3A] sm:text-[32px]">A collaborative, accountable approach</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700 sm:text-[0.9375rem]">Leadership stays close to project decisions and client communication. The people accountable for delivery make trade-offs visible and involve the right stakeholders at each stage.</p>
          </Stagger>
          <Stagger className="mt-7 grid overflow-hidden rounded-[24px] border border-[#DCE3EA] bg-white md:grid-cols-2" staggerDelay={90}>
            {approach.map(([title, body]) => <article className="border-b border-[#DCE3EA] p-5 sm:p-6 md:[&:nth-child(n+3)]:border-b-0 md:odd:border-r" key={title}><h3 className="text-lg font-bold text-[#0B1F3A]">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-700">{body}</p></article>)}
          </Stagger>
          <Stagger className="mt-8 flex flex-col items-start gap-3 sm:flex-row" staggerDelay={90}>
            <Link className="btn btn-primary" href="/contact">Talk to Our Team</Link>
            <Link className="btn btn-secondary" href="/services">Explore Services</Link>
          </Stagger>
        </div>
      </section>
    </PageShell>
  );
}
