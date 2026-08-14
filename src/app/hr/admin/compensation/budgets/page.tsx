import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";

export default async function ScopedCompensationBudgetsPage() {
  const auth = await requirePermission("compensation.budget.read");
  const canReadAll = auth.permissions.has("compensation.architecture.manage");
  const budgets = await prisma.hrCompBudget.findMany({
    where: {
      organizationId: auth.user.organizationId,
      ...(canReadAll ? {} : { scopeType: "USER", scopeId: auth.user.id }),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const entries = budgets.length ? await prisma.hrCompBudgetEntry.findMany({
    where: { organizationId: auth.user.organizationId, budgetId: { in: budgets.map(({ id }) => id) } },
    select: { budgetId: true, entryType: true, amount: true },
  }) : [];

  return <><h1 className="text-3xl font-bold">Scoped compensation budgets</h1><p className="mt-2 text-slate-600">Budget owners see only budgets explicitly scoped to their user identity. Employee rationale, calibration notes, peer pay, and unrelated budgets are excluded.</p><section className="mt-6 space-y-4">{budgets.length ? budgets.map((budget) => { const state = entries.filter((entry) => entry.budgetId === budget.id).reduce((result, entry) => { const amount = new Prisma.Decimal(entry.amount); if (entry.entryType === "RESERVE") result.reserved = result.reserved.plus(amount); if (entry.entryType === "RELEASE") result.reserved = result.reserved.minus(amount); if (entry.entryType === "CONSUME") { result.reserved = result.reserved.minus(amount); result.consumed = result.consumed.plus(amount); } return result; }, { reserved: new Prisma.Decimal(0), consumed: new Prisma.Decimal(0) }); const available = budget.allocatedAmount.minus(state.reserved).minus(state.consumed); return <article className="rounded-2xl bg-white p-5" key={budget.id}><p className="text-sm text-slate-500">{budget.scopeType} scope</p><p className="mt-2 font-bold">{budget.currency} {budget.allocatedAmount.toFixed(2)} allocated</p><p className="mt-2 text-sm">Reserved {state.reserved.toFixed(2)} · consumed {state.consumed.toFixed(2)} · available {available.toFixed(2)}</p></article>; }) : <p className="rounded-2xl bg-white p-5 text-sm text-slate-600">No compensation budget is assigned to this identity.</p>}</section></>;
}
