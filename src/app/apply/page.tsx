import { PageShell } from '@/components/PageShell';
import { Section } from '@/components/Section';
import { Stage1ApplicationForm } from './Stage1ApplicationForm';

export default async function Apply({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const params = await searchParams;

  return (
    <PageShell>
      <Section eyebrow="Stage 1" title="Initial application">
        <div className="mb-8 w-full min-w-0 overflow-hidden rounded-3xl bg-gradient-to-br from-ink via-brand to-accent p-5 text-white shadow-xl sm:p-6 md:p-8">
          <p className="min-w-0 break-words text-sm font-bold uppercase tracking-widest text-cyan-100">Zentric Analytics Hiring Portal</p>
          <h1 className="mt-3 min-w-0 break-words text-2xl font-bold sm:text-3xl md:text-4xl">Stage 1 Application Form</h1>
          <p className="mt-3 max-w-3xl break-words text-sm leading-6 text-slate-100 sm:text-base">Complete the official first-stage application below. Required fields are marked, uploaded documents remain private, and validation messages appear beside the field that needs attention.</p>
        </div>
        {params.submitted ? (
          <div className="card mb-6 p-5 sm:p-6">
            <h2 className="break-words text-2xl font-bold">Application received</h2>
            <p className="mt-3 break-words">Your Application ID is <strong className="break-all">{params.submitted}</strong>. Keep it safe; you will need it with your email to track your application.</p>
          </div>
        ) : <Stage1ApplicationForm />}
      </Section>
    </PageShell>
  );
}
