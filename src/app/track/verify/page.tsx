import { PageShell } from '@/components/PageShell';
import { Section } from '@/components/Section';
import { VerifyCodeForm } from './VerifyCodeForm';

type VerifySearchParams = Promise<Record<string, string | undefined>>;

export default async function TrackVerify({ searchParams }: { searchParams: VerifySearchParams }) {
  const params = await searchParams;

  return (
    <PageShell>
      <Section eyebrow="Secure tracking" title="Verify your access code.">
        <VerifyCodeForm
          applicationId={params.applicationId}
          email={params.email}
          requested={params.requested === '1'}
          verifiedFailed={params.verified === '0'}
        />
      </Section>
    </PageShell>
  );
}
