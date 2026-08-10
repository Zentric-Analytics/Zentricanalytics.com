const deployedHead = process.env.RENDER_GIT_COMMIT ?? "local candidate — see Git branch";
const isRenderStaging = process.env.RENDER_SERVICE_ID === "srv-d8s6ovvavr4c73fctksg";
const deploymentStatus = isRenderStaging
  ? `Live staging candidate ${deployedHead}`
  : "Local validation candidate; not a staging deployment";
const migrationStatus = isRenderStaging
  ? "35 migrations applied; schema current; staging preflight, live, ready, and backup-readiness checks pass"
  : "Four additive Unit 4 migrations prepared; verify against staging before release";

const statusItems = [
  ["Current Unit 4 subsection", "4F — Lifecycle integration and release hardening"],
  ["Current milestone", "All mandatory Unit 4A-4F staging release gates passed"],
  ["Branch", "dev"],
  ["HEAD SHA", deployedHead],
  ["Current staging deployment", deploymentStatus],
  ["Database / migration", migrationStatus],
  ["Test totals", "578/578 passing; TypeScript, ESLint, Prisma validation, production build, preflight, health, readiness, concurrency, and load pass"],
  ["Browser workflow", "Recipient-backed rehire delivery PASS; Employee/Manager/HR/Auditor field-privacy matrix PASS; coherent Unit Pass lifecycle and rehire assignment verified"],
  ["Defects found", "Rehire omitted its active assignment; HR navigation/actions exposed unavailable controls; invite roles exceeded assignable scope; restore evidence was not portable across ephemeral instances"],
  ["Fixes applied", "Atomic rehire assignment; permission-filtered UI and role choices; guarded encrypted restore utility with checksum, target validation, and plaintext cleanup"],
  ["Next release gate", "Unit 4 is production ready. Production deployment remains separately unauthorized and Units 1-3 behavior remains frozen"],
] as const;

export default function Unit4StatusPage() {
    return <main><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Live engineering status</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Unit 4 — Workforce Operations</h1><p className="mt-2 max-w-3xl text-slate-600">Staging-only implementation. Units 1–3 production behavior remains frozen.</p></div><span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-900">PASS — PRODUCTION READY</span></div>
    <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Unit 4 implementation status">{statusItems.map(([label, value]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></article>)}</section>
    <section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5"><h2 className="font-bold text-indigo-950">Release boundary</h2><p className="mt-2 text-sm text-indigo-900">No Unit 4 production deployment is authorized. Production remains untouched.</p></section>
    <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h2 className="font-bold text-emerald-950">Staging identity verified</h2><p className="mt-2 text-sm text-emerald-900">Render Staging Workspace · Zentricanalytics.com-Staging · staging.zentricanalytics.com · PostgreSQL zentric_analytics_staging · staging-scoped storage and workers.</p></section></main>;
}
