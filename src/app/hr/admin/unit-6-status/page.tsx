const deployedHead = process.env.RENDER_GIT_COMMIT ?? "local — see Git HEAD";
const environment = process.env.APP_ENV ?? (process.env.RENDER_SERVICE_ID ? "render" : "local");

const items = [
  ["Environment", `${environment} — staging implementation only; production unchanged`],
  ["Branch", "feature/hrms-unit-06-time-attendance-blueprint"],
  ["HEAD SHA", deployedHead],
  ["Current phase", "Unit 6A–6F staging release validation complete"],
  ["Implemented", "Effective policies and schedules, immutable event capture, clock sessions, timesheets, attendance interpretation, corrections, period locks, export claims, worker leases, and scoped workspaces"],
  ["Locked scope", "Exception-based salaried, clock-based hourly, and timesheet contractors; kiosk, GPS, geofencing, facial, and biometric capture excluded"],
  ["Tests", "663/663 automated tests passing; TypeScript, ESLint, Prisma validation, and production build pass"],
  ["Defects fixed", "Closed-session interpretation, effective schedule resolution, governed correction ownership and exact-version application, concurrency-fixture cleanup, synthetic clock lineage repair, and dead-letter recovery retain correlated audit evidence"],
  ["Staging deployment", "dep-d9tr8fe417fc73f41b3g — exact SHA 2a9bdfc live; 40 migrations applied; preflight ready"],
  ["Passed staging gates", "PostgreSQL concurrency, recipient-backed delivery, schedule-backed attendance, corrections, worker recovery, role privacy, Unit 4/5 boundaries, encrypted isolated restore, reconciliation, and 250-request load smoke"],
  ["Next gate", "Release baseline freeze; production remains untouched and requires separate authorization"],
] as const;

export default function Unit6StatusPage() {
  return <main><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Live engineering status</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Unit 6 — Time, Attendance &amp; Workforce Scheduling</h1><p className="mt-2 max-w-3xl text-slate-600">Unit 6 implementation and staging validation are complete. Production is frozen and untouched.</p></div><span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-900">STAGING RELEASE GATES PASSED</span></div><section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Unit 6 implementation status">{items.map(([label, value]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></article>)}</section><section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h2 className="font-bold text-emerald-950">Current verdict</h2><p className="mt-2 text-sm font-semibold text-emerald-900">PASS — Unit 6 Production Ready</p><p className="mt-2 text-sm text-emerald-900">All mandatory Unit 6 staging release gates passed. This verdict does not deploy or modify production.</p></section></main>;
}
