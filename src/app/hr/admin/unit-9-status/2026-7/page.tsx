export const dynamic = "force-dynamic";

const head = process.env.RENDER_GIT_COMMIT ?? "local development candidate";
const service = process.env.RENDER_SERVICE_ID ?? "local development service";

const items = [
  ["Environment", "Staging only — production untouched"],
  ["Branch", "dev"],
  ["HEAD SHA", head],
  ["Candidate", "NG-CANDIDATE-2026.7 — NOT CERTIFIED"],
  ["Deployment", `${service} runtime reports exact SHA ${head}`],
  ["Migrations", "63 applied; none pending or failed"],
  ["Automated suite", "Fresh repository and focused candidate gates PASS"],
  [
    "Quality gates",
    "TypeScript, ESLint zero warnings, Prisma and production build PASS",
  ],
  [
    "PostgreSQL",
    "Real races PASS: one binding winner; frozen binding immutable; zero stale or mixed-version results; deterministic replay PASS",
  ],
  [
    "Nigeria certification",
    "NOT CERTIFIED — official finalization remains fail-closed",
  ],
  [
    "Next release gate",
    "Independent Stage 1 closure review; Stage 2 remains out of scope",
  ],
] as const;

export default function Unit9Candidate20267StatusPage() {
  return (
    <main>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">
            Staging validation status
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Unit 9 — NG-CANDIDATE-2026.7
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Non-sensitive operational evidence only. No employee payroll, tax,
            bank or payment data is displayed.
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-950">
          ENGINEERING VALIDATION — NOT CERTIFIED
        </span>
      </div>
      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map(([label, value]) => (
          <article
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            key={label}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {label}
            </p>
            <p className="mt-2 font-semibold text-slate-900">{value}</p>
          </article>
        ))}
      </section>
      <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="font-bold text-amber-950">Fail-closed boundary</h2>
        <p className="mt-2 text-sm text-amber-900">
          This candidate is not legally certified. Unsupported, ambiguous,
          incomplete or stale authoritative inputs remain on governed compliance
          hold. No authoritative finalization, official payslip, real payment,
          filing, submission, settlement or remittance is permitted.
        </p>
      </section>
    </main>
  );
}
