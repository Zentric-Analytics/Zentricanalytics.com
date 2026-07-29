import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";

export default async function EmployeePayslipsPage() {
  const auth = await requirePermission("employee.read_self");
  if (!auth.user.employee) throw new Error("An employee profile is required.");
  const items = await prisma.hrPayrollItem.findMany({
    where: { employeeId: auth.user.employee.id, run: { status: { in: ["LOCKED", "PAID"] } } },
    include: { payslip: true, run: { include: { period: true } } },
    orderBy: { createdAt: "desc" },
    take: 120,
  });
  return <>
    <h1 className="text-3xl font-bold">My payslips</h1>
    <p className="mt-2 text-slate-600">Your locked payroll history. Payroll amounts are available only to you and authorized payroll administrators.</p>
    <section className="mt-6 overflow-x-auto rounded-2xl bg-white p-5"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-3">Period</th><th>Pay date</th><th>Gross</th><th>Deductions</th><th>Net pay</th><th>Status</th><th>Payslip</th></tr></thead><tbody>{items.map((item) => <tr className="border-b last:border-0" key={item.id}><td className="py-3">{item.run.period.name}</td><td>{item.run.period.payDate.toLocaleDateString()}</td><td>{item.currency} {item.grossEarnings.toFixed(2)}</td><td>{item.totalDeductions.toFixed(2)}</td><td className="font-semibold">{item.netPay.toFixed(2)}</td><td>{item.paymentStatus}</td><td>{item.payslip ? <Link className="font-semibold text-teal-700" href={`/api/hr/payroll/payslips/${item.id}`}>Download PDF</Link> : "Being prepared"}</td></tr>)}</tbody></table>{!items.length && <p className="py-8 text-center text-slate-500">No payslips are available yet.</p>}</section>
  </>;
}
