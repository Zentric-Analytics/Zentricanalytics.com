const deployedHead = process.env.RENDER_GIT_COMMIT ?? "local blueprint — see Git HEAD";
const environment = process.env.APP_ENV ?? (process.env.RENDER_SERVICE_ID ? "render" : "local");

const items = [
  ["Environment", `${environment} — blueprint only; production untouched`],
  ["Branch", "dev"],
  ["HEAD SHA", deployedHead],
  ["Current phase", "5A/5B foundation implementation — additive schema and domain invariants"],
  ["Audit complete", "Identity/workforce, existing leave, authorization, workflow, workers, audit, notifications, documents, recovery and navigation"],
  ["Architecture", "Unit 5A–5F, policy precedence, schedules/calendars, authoritative ledger, workflow, long absence and recovery defined"],
  ["Migration status", "37 repository migrations expected; Unit 5 additive migration not yet applied to staging"],
  ["5A–5F status", "5A schema in progress · 5B schema/domain in progress · 5C–5F pending"],
  ["Tests run", "Local totals update after the current implementation increment completes"],
  ["Open decisions", "Reservation/consumption timing, evidence retention/privacy, workflow defaults, retroactivity and carryover grace"],
  ["Blockers", "None; staging deployment and live evidence remain pending"],
  ["Next gate", "Complete 5A administration and 5B transactional accounting, then apply migration to verified staging"],
] as const;

export default function Unit5StatusPage() {
  return <main>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Live engineering status</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Unit 5 — Leave &amp; Absence Management</h1><p className="mt-2 max-w-3xl text-slate-600">Development and staging implementation only. No Unit 5 production deployment is authorized.</p></div>
      <span className="rounded-full bg-indigo-100 px-4 py-2 text-sm font-bold text-indigo-900">IMPLEMENTATION IN PROGRESS</span>
    </div>
    <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Unit 5 blueprint status">{items.map(([label, value]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></article>)}</section>
    <section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5"><h2 className="font-bold text-indigo-950">Approved design principle</h2><p className="mt-2 text-sm text-indigo-900">Policy decides entitlement. Calendar decides chargeable time. Ledger explains balance. Workflow governs approval. Audit explains every change.</p></section>
  </main>;
}
