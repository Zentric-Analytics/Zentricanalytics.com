const statusItems = [
  ["Current Unit", "4A — Employee Master Profile"],
  ["Current milestone", "4A/4C foundation: authoritative identity anchors and governed event commands"],
  ["Current branch", "feature/hrms-unit-04-workforce-operations"],
  ["Latest commit", "4754f65 — Unit 4 blueprint baseline"],
  ["Current staging deployment", "Not deployed — pre-staging implementation checkpoint"],
  ["Migration status", "Additive Unit 4 foundation migration created; staging preflight pending"],
  ["Tests", "530/530 baseline + 7/7 focused; TypeScript passed"],
  ["Browser journey", "Status view established; lifecycle not started"],
  ["Known defects", "No functional defect; staging identity preflight not yet executed"],
  ["Fix in progress", "Employee 360 and self-service server boundaries"],
  ["Next gate", "4A profile aggregation and scoped authorization UI"],
] as const;

export default function Unit4StatusPage() {
  return (
    <main>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Live engineering status</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Unit 4 — Workforce Operations</h1>
          <p className="mt-2 max-w-3xl text-slate-600">Staging-only implementation. Units 1–3 production behavior remains frozen.</p>
        </div>
        <span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-900">IN PROGRESS</span>
      </div>
      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Unit 4 implementation status">
        {statusItems.map(([label, value]) => (
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 font-semibold text-slate-900">{value}</p>
          </article>
        ))}
      </section>
      <section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
        <h2 className="font-bold text-indigo-950">Release boundary</h2>
        <p className="mt-2 text-sm text-indigo-900">No Unit 4 production deployment is authorized. The GoDaddy deliverability exception remains tracked separately from Unit 4.</p>
      </section>
    </main>
  );
}
