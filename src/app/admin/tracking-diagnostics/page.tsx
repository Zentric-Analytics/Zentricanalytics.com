import { redirect } from 'next/navigation';
import { recruitmentEntryUrl, type LegacySearchParams } from '@/lib/hr/recruitment/legacy-entry';
export default async function LegacyEntry({ searchParams }: { searchParams: Promise<LegacySearchParams> }) {
  redirect(recruitmentEntryUrl('/hr/recruitment/diagnostics', await searchParams));
}
