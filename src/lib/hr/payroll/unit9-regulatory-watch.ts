import crypto from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { appendHrAudit } from "@/lib/hr/audit";
import { assertSafeRegulatoryWatchUrl, payrollDigest } from "./unit9-domain";

type Actor = { organizationId: string; userId: string; role: string };
const MAX_SOURCE_BYTES = 2_000_000;

export async function pollRegulatorySource(db: PrismaClient, actor: Actor, sourceId: string, fetcher: typeof fetch = fetch) {
  const source = await db.hrPayrollRegulatorySource.findFirst({ where: { id: sourceId, organizationId: actor.organizationId, status: "ACTIVE" } });
  if (!source) throw new Error("Regulatory source is outside the tenant or inactive.");
  const url = assertSafeRegulatoryWatchUrl(source.url, source.approvedHost);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetcher(url, { redirect: "manual", signal: controller.signal, headers: { accept: "text/html,application/pdf,text/plain" } });
    if (response.status >= 300 && response.status < 400) throw new Error("Regulatory source redirects require explicit review.");
    if (!response.ok) throw new Error(`Regulatory source returned HTTP ${response.status}.`);
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > MAX_SOURCE_BYTES) throw new Error("Regulatory source exceeds the maximum response size.");
    const body = new Uint8Array(await response.arrayBuffer());
    if (body.byteLength > MAX_SOURCE_BYTES) throw new Error("Regulatory source exceeds the maximum response size.");
    const hash = crypto.createHash("sha256").update(body).digest("hex");
    const changed = Boolean(source.lastContentHash && source.lastContentHash !== hash);
    const result = await db.$transaction(async (tx) => {
      await tx.hrPayrollRegulatorySource.update({ where: { id: source.id }, data: { lastCheckedAt: new Date(), lastContentHash: hash, monitoringHealth: "HEALTHY" } });
      const candidate = changed ? await tx.hrPayrollRegulatoryChange.upsert({ where: { organizationId_regulatorySourceId_detectedContentHash: { organizationId: actor.organizationId, regulatorySourceId: source.id, detectedContentHash: hash } }, create: { organizationId: actor.organizationId, regulatorySourceId: source.id, previousContentHash: source.lastContentHash, detectedContentHash: hash, status: "REVIEW_REQUIRED", correlationId: crypto.randomUUID() }, update: {} }) : null;
      await appendHrAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.userId, actorRole: actor.role, entityType: "HrPayrollRegulatorySource", entityId: source.id, action: changed ? "unit9.regulatory_change.detected" : "unit9.regulatory_source.unchanged", newValues: { contentHash: hash, candidateId: candidate?.id ?? null }, correlationId: candidate?.correlationId ?? payrollDigest({ sourceId: source.id, hash }) });
      return { changed, hash, candidateId: candidate?.id ?? null };
    });
    return result;
  } catch (error) {
    await db.hrPayrollRegulatorySource.updateMany({ where: { id: source.id, organizationId: actor.organizationId }, data: { lastCheckedAt: new Date(), monitoringHealth: "DEGRADED" } });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
