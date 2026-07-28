import { PageShell } from '@/components/PageShell';
import { Section } from '@/components/Section';
import { Stage1ApplicationForm } from './Stage1ApplicationForm';

export default async function Apply({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const params = await searchParams;

  return (
    <PageShell>
      <Section eyebrow="Stage 1" title="Candidate Application" className="za-task-section">
        <p className="mb-6 max-w-3xl break-words rounded-2xl bg-gradient-to-r from-brand/10 via-white to-accent/10 px-4 py-3 text-sm leading-6 text-slate-700 ring-1 ring-brand/10 sm:px-5">Provide your contact details, role preference, experience summary, CV, and declarations. After review, we will send updates to the email you provide.</p>
        {params.submitted ? (
          <div className="card mb-6 p-5 sm:p-6">
            <h2 className="break-words text-2xl font-bold">Application received</h2>
            <p className="mt-3 break-words">Your Application ID is <strong className="break-all">{params.submitted}</strong>. Keep it safe; you will need it with your email to track your application. Recruitment updates and any next steps will be sent to that email.</p>
          </div>
        ) : <Stage1ApplicationForm />}
      </Section>
    </PageShell>
  );
}
