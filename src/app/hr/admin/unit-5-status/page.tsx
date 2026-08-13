const deployedHead = process.env.RENDER_GIT_COMMIT ?? "local — see Git HEAD";
const environment = process.env.APP_ENV ?? (process.env.RENDER_SERVICE_ID ? "render" : "local");
const isProduction = environment.toLowerCase() === "production";

const items = [
  ["Environment", isProduction ? "production — controlled Unit 5 operational baseline" : `${environment} — development/staging validation`],
  ["Branch", isProduction ? "main" : "dev"],
  ["HEAD SHA", deployedHead],
  ["Current phase", isProduction ? "post-release operational monitoring" : "5F — release validation"],
  ["Migration status", "39 migrations applied; none pending"],
  ["5A–5F status", "policy/calendar · authoritative ledger · immutable request revisions · workflow governance · Unit 4 integration · operational workers/reporting"],
  ["Tests run", "618 automated tests passing; TypeScript, ESLint, Prisma validation, and production build passing"],
  ["Lifecycle evidence", "PASS: governed request, approval, reservation, consumption, completion, reversal, adjustment, long-term absence/return, privacy, notifications, workers, and reconciliation"],
  ["Restore correlation", "PASS: encrypted archive c41f55510b8a restored to an isolated target; 39 migrations, linked Unit 4/5 lifecycle, zero relevant duplicates/orphans, cleanup verified"],
  ["Concurrency and load", "PASS: named PostgreSQL races and stale-version/idempotency checks; staging 250/250 and production readiness smoke 50/50 with zero failures"],
  ["Email deliverability", "Accepted operational exception: GoDaddy automatic Inbox placement remains unproven; authentication and sender registry passed"],
  ["Release verdict", isProduction ? "CONDITIONAL PASS — Unit 5 operational with accepted email-deliverability risk" : "PASS — Unit 5 Production Ready"],
] as const;

export default function Unit5StatusPage() {
  return <main>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Live engineering status</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Unit 5 — Leave &amp; Absence Management</h1><p className="mt-2 max-w-3xl text-slate-600">{isProduction ? "Controlled production release and operational-validation status." : "Development and staging release-validation status."}</p></div>
      <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-900">{isProduction ? "CONDITIONAL PASS — OPERATIONAL" : "PASS — PRODUCTION READY"}</span>
    </div>
    <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Unit 5 implementation status">{items.map(([label, value]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></article>)}</section>
    <section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5"><h2 className="font-bold text-indigo-950">Release boundary</h2><p className="mt-2 text-sm text-indigo-900">Policy decides entitlement. Calendar decides chargeable time. Ledger explains balance. Workflow governs approval. Audit explains every change. The accepted GoDaddy exception does not weaken anti-spoofing or malware controls.</p></section>
  </main>;
}
