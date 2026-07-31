import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { recruitmentTransitionMaps, type RecruitmentApplicationStatus } from "@/lib/hr/recruitment/states";
import { prisma } from "@/lib/prisma";
import { scheduleInterviewAction, transitionApplicationAction } from "./actions";

export default async function ApplicationReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("application.view");
  const { id } = await params;
  const [application, users] = await Promise.all([
    prisma.jobApplication.findFirst({
      where: { id, organizationId: auth.user.organizationId },
      include: {
        applicant: true,
        documents: { select: { id: true, kind: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true } },
      },
    }),
    prisma.hrUser.findMany({ where: { organizationId: auth.user.organizationId, status: "ACTIVE" }, orderBy: { email: "asc" } }),
  ]);
  if (!application?.recruitmentStatus) notFound();
  const history = await prisma.hrApplicationStageHistory.findMany({ where: { applicationId: application.id }, orderBy: { createdAt: "desc" } });
  const interviews = await prisma.hrInterview.findMany({ where: { applicationId: application.id }, include: { participants: true, feedback: true }, orderBy: { startsAt: "desc" } });
  const current = application.recruitmentStatus as RecruitmentApplicationStatus;
  return <main>
    <p className="text-sm font-bold uppercase tracking-widest text-teal-700">{application.applicationReference}</p>
    <h1 className="mt-2 text-3xl font-bold">{application.applicant.fullName}</h1>
    <p className="mt-2 text-slate-600">{application.roleAppliedFor} · {current.replaceAll("_", " ")} · v{application.version}</p>
    <div className="mt-6 grid gap-5 xl:grid-cols-3">
      <section className="rounded-2xl border bg-white p-5 xl:col-span-2">
        <h2 className="text-xl font-bold">Candidate information</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2"><div><dt className="text-sm text-slate-500">Email</dt><dd className="break-all">{application.applicant.email}</dd></div><div><dt className="text-sm text-slate-500">Phone</dt><dd>{application.applicant.phone ?? "Not provided"}</dd></div><div><dt className="text-sm text-slate-500">Location</dt><dd>{application.applicant.location ?? "Not provided"}</dd></div><div><dt className="text-sm text-slate-500">Skills</dt><dd>{application.skills || "Not provided"}</dd></div></dl>
        <h3 className="mt-6 font-bold">Documents</h3>
        <ul className="mt-2 space-y-2">{application.documents.map((document) => <li className="rounded-xl bg-slate-50 p-3" key={document.id}>{document.kind}: {document.fileName} <span className="text-slate-500">({document.mimeType}, {document.sizeBytes} bytes)</span></li>)}</ul>
      </section>
      <aside className="rounded-2xl border bg-white p-5"><h2 className="text-xl font-bold">Allowed actions</h2><div className="mt-4 space-y-3">
        {recruitmentTransitionMaps.application[current].map((to) => {
          if (!(to in transitionPermissionForView)) return null;
          const permission = transitionPermissionForView[to as keyof typeof transitionPermissionForView];
          if (!auth.permissions.has(permission)) return null;
          return <form action={transitionApplicationAction} className="space-y-2" key={to}><input type="hidden" name="applicationId" value={application.id}/><input type="hidden" name="expectedVersion" value={application.version}/><input type="hidden" name="to" value={to}/><input className="input w-full" name="reason" minLength={3} placeholder="Required reason" required/><button className="btn btn-secondary w-full">{to.replaceAll("_", " ")}</button></form>;
        })}
      </div></aside>
    </div>
    {auth.permissions.has("interview.schedule") ? <section className="mt-6 rounded-2xl border bg-white p-5"><h2 className="text-xl font-bold">Schedule interview</h2><form action={scheduleInterviewAction} className="mt-4 grid gap-3 md:grid-cols-2"><input type="hidden" name="applicationId" value={application.id}/><input className="input" name="title" placeholder="Interview title" required/><input className="input" name="timeZone" defaultValue="UTC" required/><input className="input" name="startsAt" type="datetime-local" required/><input className="input" name="endsAt" type="datetime-local" required/><input className="input" name="location" placeholder="Location"/><input className="input" name="meetingUrl" type="url" placeholder="Meeting URL"/><select className="input md:col-span-2" name="participantUserIds" multiple required>{users.map((user) => <option value={user.id} key={user.id}>{user.email}</option>)}</select><button className="btn btn-primary md:col-span-2">Schedule and notify panel</button></form></section> : null}
    <section className="mt-6 grid gap-5 xl:grid-cols-2"><div><h2 className="text-xl font-bold">Interviews</h2>{interviews.map((interview) => <article className="mt-3 rounded-2xl border bg-white p-4" key={interview.id}><strong>{interview.title}</strong><p className="text-sm text-slate-600">{interview.startsAt.toLocaleString()} {interview.timeZone} · {interview.status} · {interview.feedback.length}/{interview.participants.length} feedback submitted</p></article>)}</div><div><h2 className="text-xl font-bold">Immutable stage history</h2>{history.map((item) => <article className="mt-3 rounded-2xl border bg-white p-4" key={item.id}><strong>{item.newState.replaceAll("_", " ")}</strong><p className="text-sm text-slate-600">{item.createdAt.toLocaleString()} · {item.reason}</p></article>)}</div></section>
  </main>;
}

const transitionPermissionForView = {
  UNDER_REVIEW: "application.review",
  INFORMATION_REQUESTED: "application.request_information",
  SHORTLISTED: "application.shortlist",
  ON_HOLD: "application.hold",
  REJECTED: "application.reject",
  INTERVIEW_PENDING: "interview.schedule",
  FINAL_REVIEW: "application.review",
  WITHDRAWN: "application.review",
} as const;
