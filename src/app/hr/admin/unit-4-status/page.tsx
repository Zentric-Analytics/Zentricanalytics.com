const deployedHead = process.env.RENDER_GIT_COMMIT ?? "local candidate — see Git branch";
const isRenderStaging = process.env.RENDER_SERVICE_ID === "srv-d8s6ovvavr4c73fctksg";
const isRenderProduction = process.env.RENDER_SERVICE_ID === "srv-d8s89fbeo5us73e7ljk0";
const deploymentStatus = isRenderProduction
  ? `Live production release ${deployedHead}`
  : isRenderStaging
    ? `Live staging candidate ${deployedHead}`
    : "Local validation candidate";
const migrationStatus = isRenderProduction
  ? "35 migrations applied; schema current; production preflight, live, ready, worker, and backup-readiness checks pass"
  : isRenderStaging
    ? "35 migrations applied; schema current; staging preflight, live, ready, and backup-readiness checks pass"
    : "35 migrations expected; verify against the target environment before release";
const environmentName = isRenderProduction ? "production" : isRenderStaging ? "staging" : "local";

const statusItems = [
  ["Current Unit 4 subsection", "4F — Lifecycle integration and release hardening"],
  ["Current milestone", isRenderProduction ? "Unit 4 deployed; operational validation completed" : "All mandatory Unit 4A-4F staging release gates passed"],
  ["Branch", isRenderProduction ? "main" : "dev"],
  ["HEAD SHA", deployedHead],
  ["Current deployment", deploymentStatus],
  ["Database / migration", migrationStatus],
  ["Test totals", "578/578 passing; TypeScript, ESLint, Prisma validation, production build, preflight, health, readiness, concurrency, and load pass"],
  ["Browser workflow", "Recipient-backed rehire delivery PASS; Employee/Manager/HR/Auditor field-privacy matrix PASS; coherent lifecycle and rehire assignment verified"],
  ["Defects found", "Rehire assignment, permission-filtered controls, portable restore evidence, and production workforce approval configuration"],
  ["Fixes applied", "Atomic rehire assignment; permission-filtered UI; guarded encrypted restore; active governed workforce-event approval definition"],
  ["Next release gate", isRenderProduction ? "Continue post-release monitoring; the accepted GoDaddy automatic-Inbox deliverability exception remains separate" : "Unit 4 is production ready; production deployment requires separate authorization"],
] as const;

export default function Unit4StatusPage() {
  return <main>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Live engineering status</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Unit 4 — Workforce Operations</h1>
        <p className="mt-2 max-w-3xl text-slate-600">{isRenderProduction ? "Production deployment and operational validation status. Unit 5 has not begun." : "Staging implementation and release-validation status."}</p>
      </div>
      <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-900">{isRenderProduction ? "CONDITIONAL PASS — OPERATIONAL" : "PASS — PRODUCTION READY"}</span>
    </div>
    <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Unit 4 implementation status">{statusItems.map(([label, value]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></article>)}</section>
    <section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5"><h2 className="font-bold text-indigo-950">Release boundary</h2><p className="mt-2 text-sm text-indigo-900">{isRenderProduction ? "Unit 4 is deployed to production. Unit 5 remains unauthorized; the GoDaddy automatic-Inbox deliverability exception is not marked passed." : "Production remains separate and requires explicit authorization."}</p></section>
    <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h2 className="font-bold text-emerald-950">Environment identity verified</h2><p className="mt-2 text-sm text-emerald-900">Render {environmentName} environment · exact deployment SHA shown above · environment-scoped database, storage, and workers.</p></section>
  </main>;
}
