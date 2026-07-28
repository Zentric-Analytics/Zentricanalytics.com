import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, CheckCircle2, Clock3, Handshake, Lightbulb, Mail, MessagesSquare, Route, ShieldCheck } from 'lucide-react';
import { Reveal, Stagger } from '@/components/Motion';
import { PageShell } from '@/components/PageShell';
import { ContactForm } from './ContactForm';

const directEmail = 'careers@zentricanalytics.com';

const trustItems = [
  ['No obligation', CheckCircle2],
  ['Clear next steps', Route],
  ['Practical recommendations', Lightbulb],
  ['Confidential discussion', ShieldCheck],
] as const;

const nextSteps = [
  ['01', MessagesSquare, 'We Review Your Enquiry', 'We assess your goals, requirements, and the information you provide.'],
  ['02', Clock3, 'We Arrange a Conversation', 'A member of our team contacts you to clarify priorities and understand the opportunity.'],
  ['03', Lightbulb, 'We Recommend the Next Step', 'You receive practical guidance on the most suitable approach, timeline, or engagement.'],
] as const;

export default function ContactPage() {
  return (
    <PageShell>
      <section className="relative isolate overflow-hidden bg-[#0B1F3A] px-4 py-12 text-white sm:px-6 sm:py-14 lg:px-8 lg:py-16" aria-labelledby="contact-heading">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.16),transparent_34%),radial-gradient(circle_at_85%_20%,rgba(94,224,191,0.10),transparent_30%)]" aria-hidden="true" />
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.42fr)] lg:items-center lg:gap-14">
          <Stagger className="max-w-3xl" staggerDelay={90}>
            <h1 id="contact-heading" className="max-w-4xl text-[1.82rem] font-bold leading-[1.1] tracking-[-0.045em] sm:text-[2.15rem] lg:text-[2.65rem]">
              Let&apos;s Build the Right Technology Solution Together
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-[1.7] text-slate-200 sm:text-[0.9375rem]">
              Tell us about your goals, challenges, or upcoming project. Our team will review your needs and help identify the right next step.
            </p>
            <Link href="#contact-form" className="btn hero-cta-primary group mt-7 w-full sm:w-auto">
              <span>Start Your Enquiry</span><ArrowRight aria-hidden="true" className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
            </Link>
          </Stagger>

          <Reveal as="aside" delay={360} className="rounded-[22px] border border-white/15 bg-white/[0.06] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur sm:p-6" aria-label="Contact conversation assurances">
            <h2 className="text-lg font-bold tracking-[-0.025em] sm:text-[1.1875rem] lg:text-[1.25rem]">A Thoughtful First Conversation</h2>
            <div className="mt-5 divide-y divide-white/10">
              {trustItems.map(([label, Icon]) => (
                <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0" key={label}>
                  <Icon aria-hidden="true" className="size-5 shrink-0 text-[#5EE0BF]" strokeWidth={1.8} />
                  <span className="text-sm font-semibold text-slate-100">{label}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section id="contact-form" className="scroll-mt-24 bg-[#F7F9FC] px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14" aria-labelledby="contact-form-heading">
        <Stagger className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,0.62fr)_minmax(18rem,0.38fr)] lg:gap-10" staggerDelay={100}>
          <div>
            <h2 id="contact-form-heading" className="sr-only">Contact form</h2>
            <ContactForm />
          </div>
          <aside className="rounded-[22px] border border-[#DCE3EA] bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)] sm:p-8">
            <h2 className="text-xl font-bold leading-tight tracking-[-0.035em] sm:text-2xl lg:text-[2rem] text-[#0B1F3A]">Prefer to Contact Us Directly?</h2>
            <Stagger className="mt-6 space-y-5 text-sm text-[#475569] sm:text-[0.9375rem]" staggerDelay={80}>
              <div className="group flex gap-3"><Mail aria-hidden="true" className="mt-1 size-5 text-[#10B981]" /><div><p className="text-sm font-bold text-[#0B1F3A]">Email</p><a className="mt-1 block break-all text-sm font-semibold text-[#173B67] sm:text-[0.9375rem] transition-colors duration-200 ease-out hover:text-[#10B981]" href={`mailto:${directEmail}`}>{directEmail}</a></div></div>
              <div className="flex gap-3"><Clock3 aria-hidden="true" className="mt-1 size-5 text-[#10B981]" /><div><p className="text-sm font-bold text-[#0B1F3A]">Response Time</p><p className="mt-1 leading-6">We typically respond within one business day.</p></div></div>
              <div className="flex gap-3"><BriefcaseBusiness aria-hidden="true" className="mt-1 size-5 text-[#10B981]" /><div><p className="text-sm font-bold text-[#0B1F3A]">Project Discussions</p><p className="mt-1 leading-6">Share as much detail as possible so we can prepare for the conversation.</p></div></div>
              <div className="flex gap-3"><Handshake aria-hidden="true" className="mt-1 size-5 text-[#10B981]" /><div><p className="text-sm font-bold text-[#0B1F3A]">Partnerships</p><p className="mt-1 leading-6">We welcome discussions with organizations, founders, institutions, and strategic partners.</p></div></div>
            </Stagger>
            <Reveal delay={120} className="mt-7 rounded-2xl border border-[#DCE3EA] bg-[#F8FAFC] p-4 text-sm leading-6 text-[#294A43]">Your information is treated confidentially and used only to respond to your enquiry.</Reveal>
          </aside>
        </Stagger>
      </section>

      <section className="bg-white px-4 py-10 sm:px-6 sm:py-12 lg:px-8" aria-labelledby="next-heading">
        <div className="mx-auto max-w-6xl">
          <Stagger className="max-w-3xl" staggerDelay={90}>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#10B981]">PROCESS</p>
            <h2 id="next-heading" className="mt-3 text-xl font-bold leading-tight tracking-[-0.04em] text-[#0B1F3A] sm:text-2xl lg:text-[2rem]">What Happens Next</h2>
            <p className="mt-3 text-sm leading-7 text-[#475569] sm:text-[0.9375rem]">A simple and transparent process from enquiry to the right next step.</p>
          </Stagger>
          <Stagger className="mt-6 grid gap-0 divide-y divide-[#DCE3EA] lg:grid-cols-3 lg:divide-x lg:divide-y-0" staggerDelay={90}>
            {nextSteps.map(([number, Icon, title, description]) => (
              <article className="py-5 lg:px-8 lg:first:pl-0 lg:last:pr-0" key={title}>
                <div className="flex items-center justify-between gap-4"><span className="text-sm font-bold tracking-[0.18em] text-[#10B981]">{number}</span><Icon aria-hidden="true" className="size-5 text-[#0B1F3A]" /></div>
                <h3 className="mt-5 text-lg font-bold tracking-[-0.025em] sm:text-[1.1875rem] lg:text-[1.25rem] text-[#0B1F3A]">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-[#475569] sm:text-[0.9375rem]">{description}</p>
              </article>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="bg-[#F7F9FC] px-4 py-8 text-white sm:px-6 sm:py-10 lg:px-8" aria-labelledby="assurance-heading">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 rounded-[24px] bg-[#0B1F3A] p-6 shadow-[0_20px_50px_rgba(2,8,23,0.16)] sm:flex-row sm:items-center sm:justify-between sm:p-8 lg:px-10">
          <Stagger className="max-w-2xl" staggerDelay={90}>
            <h2 id="assurance-heading" className="text-2xl font-bold tracking-[-0.035em] sm:text-[2rem] lg:text-[2.5rem]">Not Ready With Every Detail Yet?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-200 sm:text-[0.9375rem]">That is completely fine. Start with what you know, and we will help you shape the rest.</p>
          </Stagger>
          <Reveal delay={180}>
            <Link href="#contact-form" className="btn hero-cta-primary w-full shrink-0 sm:w-auto">Start a Conversation</Link>
          </Reveal>
        </div>
      </section>
    </PageShell>
  );
}
