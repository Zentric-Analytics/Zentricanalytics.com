import { PageShell } from '@/components/PageShell';
import { Section } from '@/components/Section';
import { TrackForms } from './TrackForms';

type TrackSearchParams = Promise<Record<string, string | undefined>>;

export default async function Track({ searchParams }: { searchParams: TrackSearchParams }) {
  const params = await searchParams;

  return (
    <PageShell>
      <Section eyebrow="Secure tracking" title="Track your application without creating an account." className="za-task-section">
        <TrackForms
          applicationId={params.applicationId}
          email={params.email}
          limited={params.limited === '1'}
          error={params.error === '1'}
        />
      </Section>
    </PageShell>
  );
}
