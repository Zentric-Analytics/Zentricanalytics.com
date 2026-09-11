import StagePage from '@/app/admin/applications/[id]/RecruitmentDetail';
import { requireRecruitmentRead } from '@/lib/hr/recruitment/stage-access';
import { StageAuthorityError } from '@/lib/hr/recruitment/stage-authority-error';
import Link from 'next/link';

export default async function LinkedRecruitmentPage(props: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await props.params;
  try {
    await requireRecruitmentRead(id);
  } catch (error) {
    if (!(error instanceof StageAuthorityError)) throw error;
    return <main className="space-y-4 p-6"><h1>Recruitment access unavailable</h1><p role="alert">You no longer have access to this application through your hiring team. Your membership or assignment may have changed.</p><Link href="/hr/recruitment">Return to your recruitment workspace</Link></main>;
  }
  return <><nav className="flex gap-4 p-4"><a href={`/hr/recruitment/${id}/tools`}>Interviews, assessments and governed offers</a><a href={`/hr/recruitment/${id}/access`}>Completed applicant: mailbox and HRMS access</a></nav><StagePage {...props} /></>;
}
