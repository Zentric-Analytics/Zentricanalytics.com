import crypto from "node:crypto";

export function bearerToken(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

export function timingSafeSecret(actual: string, expected: string | undefined) {
  if (!expected || expected.length < 64 || !actual) return false;
  const left = crypto.createHash("sha256").update(actual).digest();
  const right = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(left, right);
}

export function authorizeInternalRequest(request: Request, expected: string | undefined) {
  return timingSafeSecret(bearerToken(request), expected);
}
