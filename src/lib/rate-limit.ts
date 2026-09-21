import { sha256 } from './security';

export type RateLimitRule = { scope: string; key: string; limit: number; windowMs: number };
export function hashRateLimitKey(key: string) { return sha256(`${process.env.RATE_LIMIT_SALT ?? process.env.ADMIN_SESSION_SECRET ?? 'staging-rate-limit-salt'}:${key}`); }
export async function checkRateLimit(rule: RateLimitRule, now = new Date()) {
  const { prisma } = await import('./prisma');
  const keyHash = hashRateLimitKey(rule.key.toLowerCase());
  const since = new Date(now.getTime() - rule.windowMs);
  return prisma.$transaction(async tx => {
    // One transaction-scoped lock per scope/key, shared by all application instances.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${rule.scope}:${keyHash}`}, 0))::text`;
    const count = await tx.rateLimitEvent.count({ where: { scope: rule.scope, keyHash, createdAt: { gte: since } } });
    if (count >= rule.limit) return { allowed: false, keyHash, remaining: 0 };
    await tx.rateLimitEvent.create({ data: { scope: rule.scope, keyHash, createdAt: now } });
    return { allowed: true, keyHash, remaining: rule.limit - count - 1 };
  });
}
