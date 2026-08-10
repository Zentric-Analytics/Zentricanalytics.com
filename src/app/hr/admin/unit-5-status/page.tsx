const deployedHead = process.env.RENDER_GIT_COMMIT ?? "local — see Git HEAD";
const environment = process.env.APP_ENV ?? (process.env.RENDER_SERVICE_ID ? "render" : "local");

const items = [
  ["Environment", `${environment} — development/staging only; production untouched`],
  ["Branch", "feature/hrms-unit-05-leave-absence"],
  ["HEAD SHA", deployedHead],
  ["Current phase", "5F — automation, reporting, reconciliation, and staging release validation"],
  ["Migration status", "39 repository migrations expected; three additive Unit 5 migrations await verified staging deployment"],
  ["5A–5F status", "5A policy/calendar built · 5B authoritative ledger built · 5C immutable request revisions built · 5D configured workflow governance built · 5E Unit 4 integration built · 5F operational workers/reporting built"],
  ["Tests run", "612 automated tests passing locally; TypeScript and ESLint zero-warning gates passing"],
  ["Browser workflow", "Pending exact staging deployment and role-backed lifecycle"],
  ["Defects fixed", "Submission reservation removed; exact carryover-out projection added; reserved carryover protected from expiry; final-stage approval made atomic; returned edits create immutable versions"],
  ["Blockers", "None in local implementation; staging deployment and live evidence remain pending after verified migration"],
  ["Next gate", "Commit the 5F increment, deploy the exact candidate to verified staging, then run browser, PostgreSQL concurrency, privacy, load, and recovery gates"],
] as const;

export default function Unit5StatusPage() {
  return <main>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Live engineering status</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Unit 5 — Leave &amp; Absence Management</h1><p className="mt-2 max-w-3xl text-slate-600">Development and staging implementation only. No Unit 5 production deployment is authorized.</p></div>
      <span className="rounded-full bg-indigo-100 px-4 py-2 text-sm font-bold text-indigo-900">IMPLEMENTATION IN PROGRESS</span>
    </div>
    <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Unit 5 implementation status">{items.map(([label, value]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></article>)}</section>
    <section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5"><h2 className="font-bold text-indigo-950">Approved design principle</h2><p className="mt-2 text-sm text-indigo-900">Policy decides entitlement. Calendar decides chargeable time. Ledger explains balance. Workflow governs approval. Audit explains every change.</p></section>
  </main>;
}
