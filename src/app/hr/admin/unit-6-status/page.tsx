const deployedHead = process.env.RENDER_GIT_COMMIT ?? "local — see Git HEAD";
const environment = process.env.APP_ENV ?? (process.env.RENDER_SERVICE_ID ? "render" : "local");

const items = [
  ["Environment", `${environment} — blueprint only; production unchanged`],
  ["Branch", "feature/hrms-unit-06-time-attendance-blueprint"],
  ["HEAD SHA", deployedHead],
  ["Current phase", "Repository audit and architecture blueprint complete"],
  ["Repository findings", "Shared Unit 5 schedule/holiday foundation reusable; time evidence, shifts, attendance, corrections, locking, and authoritative time are missing"],
  ["Open decisions", "Jurisdictions, mode populations, location/retention policy, periods/locks, overtime rules, offline/kiosk policy, schedule normalization"],
  ["Tests", "Blueprint artifact regression checks only; implementation gates are designed but not claimed"],
  ["Blockers", "Owner implementation approval and eight recorded product/privacy decisions"],
  ["Next gate", "Owner reviews and approves the blueprint before schema or feature implementation"],
] as const;

export default function Unit6StatusPage() {
  return <main>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Live engineering status</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Unit 6 — Time, Attendance &amp; Workforce Scheduling</h1><p className="mt-2 max-w-3xl text-slate-600">Repository audit and production-architecture blueprint only. No Unit 6 migration, staging deployment, or production change is authorized.</p></div>
      <span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-900">BLUEPRINT — APPROVAL REQUIRED</span>
    </div>
    <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Unit 6 blueprint status">{items.map(([label, value]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></article>)}</section>
    <section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5"><h2 className="font-bold text-indigo-950">Blueprint verdict</h2><p className="mt-2 text-sm font-semibold text-indigo-900">UNIT 6 BLUEPRINT COMPLETE — READY FOR IMPLEMENTATION APPROVAL</p><p className="mt-2 text-sm text-indigo-900">This is not Unit 6 Production Ready and does not authorize implementation or deployment.</p></section>
  </main>;
}
