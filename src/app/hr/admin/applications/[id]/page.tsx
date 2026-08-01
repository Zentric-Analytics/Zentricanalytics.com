import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { recruitmentTransitionMaps, type RecruitmentApplicationStatus } from "@/lib/hr/recruitment/states";
import { prisma } from "@/lib/prisma";
import { WorkflowActionForm } from "./WorkflowActionForm";

const label = (value: string) => value.replaceAll("_", " ");

export default async function ApplicationReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("application.view");
  const { id } = await params;
  const organizationId = auth.user.organizationId;
  const [application, users, positions, departments, legalEntities, grades] = await Promise.all([
    prisma.jobApplication.findFirst({
      where: { id, organizationId },
      include: {
        applicant: true,
        documents: { select: { id: true, kind: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true } },
      },
    }),
    prisma.hrUser.findMany({ where: { organizationId, status: "ACTIVE" }, orderBy: { email: "asc" } }),
    prisma.hrPosition.findMany({
      where: { organizationId, status: "ACTIVE", lifecycleStatus: { in: ["OPEN", "PARTIALLY_FILLED"] } },
      include: { department: true },
      orderBy: { title: "asc" },
    }),
    prisma.hrDepartment.findMany({ where: { organizationId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.hrLegalEntity.findMany({ where: { organizationId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.hrGrade.findMany({ where: { organizationId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);
  if (!application?.recruitmentStatus) notFound();
  const [vacancy, history, interviews, assessments, answers, offer, audits] = await Promise.all([
    application.vacancyId ? prisma.hrVacancy.findFirst({
      where: { id: application.vacancyId, organizationId },
      include: { department: true, hiringTeam: true, responsibleHrTeam: true },
    }) : null,
    prisma.hrApplicationStageHistory.findMany({ where: { applicationId: application.id }, orderBy: { createdAt: "desc" } }),
    prisma.hrInterview.findMany({ where: { applicationId: application.id }, include: { participants: true, feedback: true }, orderBy: { startsAt: "desc" } }),
    prisma.hrAssessment.findMany({ where: { applicationId: application.id, organizationId }, orderBy: { createdAt: "desc" } }),
    prisma.hrApplicationAnswer.findMany({ where: { applicationId: application.id }, orderBy: { questionKey: "asc" } }),
    prisma.hrRecruitmentOffer.findUnique({
      where: { applicationId: application.id },
      include: { versions: { orderBy: { version: "desc" } }, approvals: true, activeVersion: true, acceptedVersion: true },
    }),
    prisma.hrAuditEvent.findMany({
      where: { organizationId, entityId: { in: [application.id] } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const current = application.recruitmentStatus as RecruitmentApplicationStatus;
  return <main className="space-y-7">
    <header>
      <p className="text-sm font-bold uppercase tracking-widest text-teal-700">{application.applicationReference}</p>
      <h1 className="mt-2 text-3xl font-bold">{application.applicant.fullName}</h1>
      <p className="mt-2 text-slate-600">{application.applicant.applicantNumber} · {application.roleAppliedFor} · {label(current)} · v{application.version}</p>
    </header>

    <div className="grid gap-5 xl:grid-cols-3">
      <section className="rounded-2xl border bg-white p-5 xl:col-span-2">
        <h2 className="text-xl font-bold">Complete applicant record</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <Info name="Email" value={application.applicant.email} />
          <Info name="Phone" value={application.applicant.phone ?? "Not provided"} />
          <Info name="Location" value={application.applicant.location ?? "Not provided"} />
          <Info name="Submitted" value={application.createdAt.toLocaleString()} />
          <Info name="Vacancy" value={vacancy ? `${vacancy.vacancyNumber} · ${vacancy.title}` : application.roleAppliedFor} />
          <Info name="Hiring Team" value={vacancy?.hiringTeam.name ?? "Not assigned"} />
          <Info name="Responsible HR" value={vacancy?.responsibleHrTeam.name ?? "Not assigned"} />
          <Info name="Skills" value={application.skills || "Not provided"} />
        </dl>
        <h3 className="mt-6 font-bold">Application statement</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{application.message || "Not provided"}</p>
        <h3 className="mt-6 font-bold">Screening answers</h3>
        <div className="mt-2 space-y-2">{answers.map((answer) => <article className="rounded-xl bg-slate-50 p-3" key={answer.id}><strong>{answer.questionKey}</strong><pre className="mt-1 whitespace-pre-wrap text-sm">{JSON.stringify(answer.answer, null, 2)}</pre></article>)}</div>
        {!answers.length ? <p className="mt-2 text-sm text-slate-500">No additional screening answers.</p> : null}
        <h3 className="mt-6 font-bold">Documents and exact versions</h3>
        <ul className="mt-2 space-y-2">{application.documents.map((document) => <li className="rounded-xl bg-slate-50 p-3" key={document.id}>{document.kind}: {document.fileName} <span className="text-slate-500">({document.mimeType}, {document.sizeBytes} bytes · uploaded {document.createdAt.toLocaleString()})</span></li>)}</ul>
      </section>

      <aside className="rounded-2xl border bg-white p-5">
        <h2 className="text-xl font-bold">Review actions</h2>
        <div className="mt-4 space-y-4">
          {recruitmentTransitionMaps.application[current].map((to) => {
            const permission = transitionPermissionForView[to as keyof typeof transitionPermissionForView];
            if (!permission || !auth.permissions.has(permission)) return null;
            return <WorkflowActionForm actionName="transition" submitLabel={label(to)} key={to}>
              <input type="hidden" name="applicationId" value={application.id} />
              <input type="hidden" name="expectedVersion" value={application.version} />
              <input type="hidden" name="to" value={to} />
              <input className="input w-full" name="reason" minLength={3} placeholder={`Reason for ${label(to).toLowerCase()}`} required />
            </WorkflowActionForm>;
          })}
        </div>
      </aside>
    </div>

    {auth.permissions.has("interview.schedule") && application.recruitmentStatus === "INTERVIEW_PENDING" ? <section className="rounded-2xl border bg-white p-5">
      <h2 className="text-xl font-bold">Schedule interview</h2>
      <WorkflowActionForm actionName="scheduleInterview" submitLabel="Schedule and notify panel" className="mt-4 grid gap-3 md:grid-cols-2">
        <input type="hidden" name="applicationId" value={application.id} />
        <input className="input" name="title" placeholder="Interview title" required />
        <input className="input" name="timeZone" defaultValue="UTC" required />
        <input className="input" name="startsAt" type="datetime-local" required />
        <input className="input" name="endsAt" type="datetime-local" required />
        <input className="input" name="location" placeholder="Location" />
        <input className="input" name="meetingUrl" type="url" placeholder="Meeting URL" />
        <select className="input md:col-span-2" name="participantUserIds" multiple required>{users.map((user) => <option value={user.id} key={user.id}>{user.email}</option>)}</select>
      </WorkflowActionForm>
    </section> : null}

    <section>
      <h2 className="text-xl font-bold">Interviews and private feedback</h2>
      <div className="mt-3 grid gap-4 xl:grid-cols-2">{interviews.map((interview) => {
        const ownFeedback = interview.feedback.find((item) => item.interviewerId === auth.user.id);
        const assigned = interview.participants.some((item) => item.userId === auth.user.id);
        return <article className="rounded-2xl border bg-white p-4" key={interview.id}>
          <strong>{interview.title}</strong>
          <p className="text-sm text-slate-600">{interview.startsAt.toLocaleString()} {interview.timeZone} · {interview.status} · v{interview.version}</p>
          <p className="text-sm text-slate-600">{interview.feedback.filter((item) => item.status === "SUBMITTED").length}/{interview.participants.length} final feedback submissions</p>
          {interview.status === "SCHEDULED" ? <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {auth.permissions.has("interview.reschedule") ? <WorkflowActionForm actionName="manageInterview" submitLabel="Reschedule">
              <HiddenInterview applicationId={application.id} interviewId={interview.id} version={interview.version} action="RESCHEDULE" />
              <input className="input w-full" name="startsAt" type="datetime-local" required />
              <input className="input w-full" name="endsAt" type="datetime-local" required />
              <input className="input w-full" name="timeZone" defaultValue={interview.timeZone} required />
              <input className="input w-full" name="reason" placeholder="Reschedule reason" required />
            </WorkflowActionForm> : null}
            {auth.permissions.has("interview.cancel") ? <WorkflowActionForm actionName="manageInterview" submitLabel="Cancel interview">
              <HiddenInterview applicationId={application.id} interviewId={interview.id} version={interview.version} action="CANCEL" />
              <input className="input w-full" name="reason" placeholder="Cancellation reason" required />
            </WorkflowActionForm> : null}
            <WorkflowActionForm actionName="manageInterview" submitLabel="Mark completed">
              <HiddenInterview applicationId={application.id} interviewId={interview.id} version={interview.version} action="COMPLETE" />
              <input className="input w-full" name="reason" placeholder="Completion reason" required />
            </WorkflowActionForm>
          </div> : null}
          {assigned && auth.permissions.has("interview.feedback.submit") ? <WorkflowActionForm actionName="feedback" submitLabel={ownFeedback?.status === "SUBMITTED" ? "Feedback locked" : "Save feedback"}>
            <input type="hidden" name="applicationId" value={application.id} />
            <input type="hidden" name="interviewId" value={interview.id} />
            <select className="input w-full" name="mode" disabled={ownFeedback?.status === "SUBMITTED"}><option value="DRAFT">Save draft</option><option value="SUBMIT">Submit and lock</option></select>
            <input className="input w-full" name="score" type="number" min={0} max={100} defaultValue={(ownFeedback?.scores as { overall?: number } | null)?.overall} required />
            <input className="input w-full" name="recommendation" placeholder="Recommendation" defaultValue={ownFeedback?.recommendation ?? ""} required />
            <textarea className="input w-full" name="comments" placeholder="Private comments" defaultValue={ownFeedback?.comments ?? ""} />
          </WorkflowActionForm> : null}
        </article>;
      })}</div>
    </section>

    <section className="grid gap-5 xl:grid-cols-2">
      <div>
        <h2 className="text-xl font-bold">Assessments</h2>
        {auth.permissions.has("assessment.create") ? <WorkflowActionForm actionName="createAssessment" submitLabel="Create assessment" className="mt-3 rounded-2xl border bg-white p-4 space-y-2">
          <input type="hidden" name="applicationId" value={application.id} />
          <input className="input w-full" name="assessmentType" placeholder="Assessment type" required />
          <textarea className="input w-full" name="instructions" placeholder="Instructions" required />
          <select className="input w-full" name="evaluatorId" required><option value="">Evaluator</option>{users.map((user) => <option value={user.id} key={user.id}>{user.email}</option>)}</select>
          <input className="input w-full" name="dueAt" type="datetime-local" />
        </WorkflowActionForm> : null}
        {assessments.map((assessment) => <article className="mt-3 rounded-2xl border bg-white p-4" key={assessment.id}>
          <strong>{assessment.assessmentType}</strong><p className="text-sm text-slate-600">{assessment.status} · v{assessment.version} · due {assessment.dueAt?.toLocaleString() ?? "not set"}</p>
          {auth.permissions.has("assessment.evaluate") && !["COMPLETED", "CANCELLED"].includes(assessment.status) ? <WorkflowActionForm actionName="evaluateAssessment" submitLabel="Update assessment">
            <input type="hidden" name="assessmentId" value={assessment.id} /><input type="hidden" name="applicationId" value={application.id} /><input type="hidden" name="expectedVersion" value={assessment.version} />
            <select className="input w-full" name="to"><option>IN_PROGRESS</option><option>COMPLETED</option><option>CANCELLED</option></select>
            <input className="input w-full" name="score" type="number" min={0} max={100} placeholder="Score 0–100 for completion" />
            <input className="input w-full" name="outcome" placeholder="Outcome" />
            <textarea className="input w-full" name="comments" placeholder="Evaluator comments" />
          </WorkflowActionForm> : null}
        </article>)}
      </div>

      <div>
        <h2 className="text-xl font-bold">Versioned offer</h2>
        {auth.permissions.has("offer.create") && ["FINAL_REVIEW", "OFFER_DRAFT"].includes(current) ? <WorkflowActionForm actionName="createOffer" submitLabel={offer ? "Create new immutable version" : "Create draft offer"} className="mt-3 rounded-2xl border bg-white p-4 grid gap-2 sm:grid-cols-2">
          <input type="hidden" name="applicationId" value={application.id} />
          <select className="input" name="positionId"><option value="">Approved open position (optional)</option>{positions.map((position) => <option value={position.id} key={position.id}>{position.title} · {position.department.name}</option>)}</select>
          <input className="input" name="positionTitle" defaultValue={application.roleAppliedFor} required />
          <select className="input" name="departmentId" required><option value="">Department</option>{departments.map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}</select>
          <select className="input" name="managerId"><option value="">Manager</option>{users.map((user) => <option value={user.id} key={user.id}>{user.email}</option>)}</select>
          <select className="input" name="legalEntityId" required><option value="">Legal entity</option>{legalEntities.map((entity) => <option value={entity.id} key={entity.id}>{entity.name}</option>)}</select>
          <select className="input" name="gradeId"><option value="">Grade</option>{grades.map((grade) => <option value={grade.id} key={grade.id}>{grade.name}</option>)}</select>
          <select className="input" name="employmentType"><option value="FULL_TIME">Full time</option><option value="PART_TIME">Part time</option><option value="CONTRACT">Contract</option></select>
          <input className="input" name="salary" type="number" min={1} placeholder="Salary" required />
          <input className="input" name="currency" defaultValue="NGN" required />
          <input className="input" name="payFrequency" defaultValue="MONTHLY" required />
          <input className="input" name="location" placeholder="Location" />
          <select className="input" name="workMode"><option>REMOTE</option><option>HYBRID</option><option>ONSITE</option></select>
          <input className="input" name="startDate" type="date" required />
          <input className="input" name="probationPeriod" placeholder="Probation period" />
          <input className="input" name="contractType" defaultValue="PERMANENT" required />
          <input className="input" name="expiresAt" type="datetime-local" required />
          <textarea className="input sm:col-span-2" name="terms" placeholder="Applicant-visible terms and conditions" required />
        </WorkflowActionForm> : null}
        {offer ? <article className="mt-3 rounded-2xl border bg-white p-4">
          <strong>Status: {offer.status} · record v{offer.version}</strong>
          <p className="text-sm text-slate-600">Active version: {offer.activeVersion?.version ?? "none"} · accepted version: {offer.acceptedVersion?.version ?? "none"}</p>
          <ul className="mt-2 text-sm">{offer.versions.map((version) => <li key={version.id}>v{version.version} · {version.positionTitle} · {version.currency} {version.salary.toString()} · expires {version.expiresAt.toLocaleString()}</li>)}</ul>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {offer.status === "DRAFT" && auth.permissions.has("offer.submit") ? <OfferAction applicationId={application.id} offerId={offer.id} version={offer.version} operation="SUBMIT" labelText="Submit for approval" /> : null}
            {offer.status === "PENDING_APPROVAL" && auth.permissions.has("offer.approve") ? <OfferAction applicationId={application.id} offerId={offer.id} version={offer.version} operation="APPROVE" labelText="Approve exact version" /> : null}
            {offer.status === "APPROVED" && auth.permissions.has("offer.issue") ? <OfferAction applicationId={application.id} offerId={offer.id} version={offer.version} operation="ISSUE" labelText="Issue offer" /> : null}
          </div>
        </article> : null}
      </div>
    </section>

    <section className="grid gap-5 xl:grid-cols-2">
      <div><h2 className="text-xl font-bold">Immutable stage history</h2>{history.map((item) => <article className="mt-3 rounded-2xl border bg-white p-4" key={item.id}><strong>{label(item.newState)}</strong><p className="text-sm text-slate-600">{item.createdAt.toLocaleString()} · {item.reason}</p></article>)}</div>
      <div><h2 className="text-xl font-bold">Permitted audit summary</h2>{audits.map((item) => <article className="mt-3 rounded-2xl border bg-white p-4" key={item.id}><strong>{item.action}</strong><p className="text-sm text-slate-600">{item.createdAt.toLocaleString()} · correlation {item.correlationId ?? "not recorded"}</p></article>)}</div>
    </section>
  </main>;
}

function Info({ name, value }: { name: string; value: string }) {
  return <div><dt className="text-sm text-slate-500">{name}</dt><dd className="break-words">{value}</dd></div>;
}

function HiddenInterview({ applicationId, interviewId, version, action }: { applicationId: string; interviewId: string; version: number; action: string }) {
  return <><input type="hidden" name="applicationId" value={applicationId} /><input type="hidden" name="interviewId" value={interviewId} /><input type="hidden" name="expectedVersion" value={version} /><input type="hidden" name="action" value={action} /></>;
}

function OfferAction({ applicationId, offerId, version, operation, labelText }: { applicationId: string; offerId: string; version: number; operation: string; labelText: string }) {
  return <WorkflowActionForm actionName="manageOffer" submitLabel={labelText}>
    <input type="hidden" name="applicationId" value={applicationId} /><input type="hidden" name="offerId" value={offerId} /><input type="hidden" name="expectedVersion" value={version} /><input type="hidden" name="operation" value={operation} />
    <input className="input w-full" name="reason" placeholder="Required reason or comments" required />
  </WorkflowActionForm>;
}

const transitionPermissionForView = {
  UNDER_REVIEW: "application.review",
  INFORMATION_REQUESTED: "application.request_information",
  SHORTLISTED: "application.shortlist",
  ON_HOLD: "application.hold",
  REJECTED: "application.reject",
  INTERVIEW_PENDING: "interview.schedule",
  ASSESSMENT_PENDING: "assessment.create",
  FINAL_REVIEW: "application.review",
  OFFER_DRAFT: "offer.create",
  WITHDRAWN: "application.review",
} as const;
