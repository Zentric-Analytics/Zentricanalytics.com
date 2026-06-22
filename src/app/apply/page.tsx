import { PageShell } from '@/components/PageShell';
import { Section } from '@/components/Section';
import { Stage1ApplicationForm } from './Stage1ApplicationForm';

export default async function Apply({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const params = await searchParams;
  return <PageShell><Section eyebrow="Stage 1" title="Initial application">
    <div className="mb-8 rounded-3xl bg-gradient-to-br from-ink via-brand to-accent p-6 text-white shadow-xl md:p-8"><p className="text-sm font-bold uppercase tracking-widest text-cyan-100">Zentric Analytics Ltd Hiring Portal</p><h1 className="mt-3 text-3xl font-bold md:text-4xl">Stage 1 Application Form</h1><p className="mt-3 max-w-3xl text-slate-100">Complete the official first-stage application below. Required fields are marked, uploaded documents remain private, and validation messages appear beside the field that needs attention.</p></div>
    {params.submitted ? <div className="card mb-6 p-6"><h2 className="text-2xl font-bold">Application received</h2><p className="mt-3">Your Application ID is <strong>{params.submitted}</strong>. Keep it safe; you will need it with your email to track your application.</p></div> : <Stage1ApplicationForm />}
  </Section></PageShell>;
}
