import { redirect } from 'next/navigation';
import { recruitmentEntryUrl, type LegacySearchParams } from '@/lib/hr/recruitment/legacy-entry';
export default async function LegacyEntry({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<LegacySearchParams> }) {
  const { id } = await params;
  redirect(recruitmentEntryUrl(`/hr/recruitment/${encodeURIComponent(id)}`, await searchParams));
}
