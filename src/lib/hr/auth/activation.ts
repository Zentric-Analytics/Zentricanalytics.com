import { prisma } from "@/lib/prisma";

export async function hrAccessActivated() {
  try {
    return Boolean(await prisma.hrUserRole.findFirst({ where: { revokedAt: null, role: { key: "ADMIN" }, user: { status: "ACTIVE" } }, select: { id: true } }));
  } catch {
    return false;
  }
}
