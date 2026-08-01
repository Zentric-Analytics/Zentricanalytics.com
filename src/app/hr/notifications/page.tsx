import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";
import { markAllNotificationsReadAction, markNotificationReadAction, updateNotificationPreferenceAction } from "./actions";

const standardCategories = [
  "hr-lifecycle-started", "hr-lifecycle-task-due", "hr-workflow-approval",
  "hr-leave-review-requested", "hr-leave-approved", "hr-leave-rejected",
  "hr-payroll-approved", "hr-payslip-ready", "hr-document-available",
  "hr-document-expiring", "hr-asset-assigned", "hr-asset-return-reminder",
];

export default async function NotificationsPage() {
  const auth = await requireAuthenticatedUser();
  const [notifications, preferences] = await Promise.all([
    prisma.hrNotification.findMany({ where: { userId: auth.user.id, organizationId: auth.user.organizationId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.hrNotificationPreference.findMany({ where: { userId: auth.user.id, organizationId: auth.user.organizationId } }),
  ]);
  const preferenceByCategory = new Map(preferences.map((item) => [item.category, item]));
  const categories = [...new Set([...standardCategories, ...notifications.map(({ category }) => category)])].sort();
  const unread = notifications.filter(({ readAt }) => !readAt).length;
  return <main aria-label="HR notification center">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-3xl font-bold">Notifications</h1><p className="mt-2 text-slate-600">{unread} unread secure workspace update{unread === 1 ? "" : "s"}.</p></div>
      {unread > 0 && <form action={markAllNotificationsReadAction}><button className="btn btn-secondary">Mark all read</button></form>}
    </div>
    <section className="mt-6 space-y-3" aria-label="Notification inbox">
      {notifications.map((item) => <article className={`rounded-2xl border bg-white p-5 ${item.readAt ? "border-slate-200" : "border-teal-400"}`} key={item.id}>
        <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-bold">{item.title}</h2><p className="mt-1 text-sm text-slate-700">{item.body}</p><p className="mt-2 text-xs text-slate-500">{item.createdAt.toLocaleString()} · {item.category}</p></div>
        <div className="flex items-center gap-3">{item.href && <Link className="font-semibold text-teal-700" href={item.href}>Open</Link>}{!item.readAt && <form action={markNotificationReadAction}><input type="hidden" name="id" value={item.id} /><button className="font-semibold text-teal-700">Mark read</button></form>}</div></div>
      </article>)}
      {!notifications.length && <p className="rounded-2xl bg-white p-6 text-slate-500">No notifications yet.</p>}
    </section>
    <section className="mt-8 rounded-2xl bg-white p-5"><h2 className="text-xl font-bold">Notification preferences</h2><p className="mt-1 text-sm text-slate-600">Security-critical account messages may still be delivered when required to protect your account.</p>
      <div className="mt-4 divide-y">{categories.map((category) => { const preference = preferenceByCategory.get(category); return <form action={updateNotificationPreferenceAction} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center" key={category}><input type="hidden" name="category" value={category} /><span className="font-mono text-sm">{category}</span><label className="flex items-center gap-2 text-sm"><input name="inAppEnabled" type="checkbox" defaultChecked={preference?.inAppEnabled ?? true} />In-app</label><label className="flex items-center gap-2 text-sm"><input name="emailEnabled" type="checkbox" defaultChecked={preference?.emailEnabled ?? true} />Email</label><button className="font-semibold text-teal-700">Save</button></form>; })}</div>
    </section>
  </main>;
}
