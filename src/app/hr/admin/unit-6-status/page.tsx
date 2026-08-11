const deployedHead = process.env.RENDER_GIT_COMMIT ?? "local — see Git HEAD";
const environment = process.env.APP_ENV ?? (process.env.RENDER_SERVICE_ID ? "render" : "local");

const items = [
  ["Environment", `${environment} — staging implementation only; production unchanged`],
  ["Branch", "feature/hrms-unit-06-time-attendance-blueprint"],
  ["HEAD SHA", deployedHead],
  ["Current phase", "Unit 6A–6F implementation: corrections, approvals, authoritative handoff, and staging readiness"],
  ["Implemented", "Effective policies and schedules, immutable event capture, clock sessions, timesheets, attendance interpretation, corrections, period locks, export claims, worker leases, and scoped workspaces"],
  ["Locked scope", "Exception-based salaried, clock-based hourly, and timesheet contractors; kiosk, GPS, geofencing, facial, and biometric capture excluded"],
  ["Tests", "653/653 automated tests passing at the foundation milestone; TypeScript, ESLint, Prisma validation, and production build pass"],
  ["Defects fixed", "Open-session uniqueness, conflicting idempotency replay, invalid clock sequences, self-approval, schedule overlap, stale versions, and worker duplicate claims fail closed"],
  ["Next gate", "Complete correction/export UI and regression coverage, then deploy the exact candidate to staging for real database and browser validation"],
] as const;

export default function Unit6StatusPage() {
  return <main><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Live engineering status</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Unit 6 — Time, Attendance &amp; Workforce Scheduling</h1><p className="mt-2 max-w-3xl text-slate-600">Continuous Unit 6 implementation and staging validation. Production is frozen and untouched.</p></div><span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-900">IMPLEMENTATION IN PROGRESS</span></div><section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Unit 6 implementation status">{items.map(([label, value]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></article>)}</section><section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5"><h2 className="font-bold text-indigo-950">Current verdict</h2><p className="mt-2 text-sm font-semibold text-indigo-900">IN PROGRESS — NOT YET UNIT 6 PRODUCTION READY</p><p className="mt-2 text-sm text-indigo-900">Staging database, concurrency, browser, load, email, worker recovery, backup, and isolated restore evidence remain mandatory.</p></section></main>;
}
