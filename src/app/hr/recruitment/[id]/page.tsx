import StagePage from '@/app/admin/applications/[id]/page';
import { requireRecruitmentRead } from '@/lib/hr/recruitment/stage-access';

export default async function LinkedRecruitmentPage(props: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await props.params;
  await requireRecruitmentRead(id);
  return <><nav className="flex gap-4 p-4"><a href={`/hr/recruitment/${id}/tools`}>Interviews, assessments and governed offers</a><a href={`/hr/recruitment/${id}/access`}>Completed applicant: mailbox and HRMS access</a></nav><StagePage {...props} /></>;
}
