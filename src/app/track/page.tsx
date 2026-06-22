import { PageShell } from '@/components/PageShell';
import { Section } from '@/components/Section';
import { TrackForms } from './TrackForms';

type TrackSearchParams = Promise<Record<string, string | undefined>>;

export default async function Track({ searchParams }: { searchParams: TrackSearchParams }) {
  const params = await searchParams;

  return (
    <PageShell>
      <Section eyebrow="Secure tracking" title="Track your application without creating an account.">
        <TrackForms
          applicationId={params.applicationId}
          email={params.email}
          requested={params.requested === '1'}
          limited={params.limited === '1'}
          error={params.error === '1'}
          verifiedFailed={params.verified === '0'}
        />
      </Section>
    </PageShell>
  );
}
