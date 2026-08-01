export type ConsumableToken = { status: "ACTIVE" | "USED" | "REVOKED"; expiresAt: Date; usedAt: Date | null };

export function tokenCanBeConsumed(token: ConsumableToken | null, now = new Date()) {
  return Boolean(token && token.status === "ACTIVE" && !token.usedAt && token.expiresAt > now);
}
