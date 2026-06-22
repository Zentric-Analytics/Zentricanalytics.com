import crypto from 'node:crypto';
import { cookies } from 'next/headers';

export const ADMIN_COOKIE_NAME = 'za_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 4;

type AdminSession = { email: string; exp: number };

function secret() { const value = process.env.ADMIN_SESSION_SECRET; if (!value || value.length < 32) throw new Error('ADMIN_SESSION_SECRET must be at least 32 characters.'); return value; }
function b64url(input: Buffer | string) { return Buffer.from(input).toString('base64url'); }
function sign(payload: string) { return crypto.createHmac('sha256', secret()).update(payload).digest('base64url'); }

export function hashAdminPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  const iterations = 310_000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex');
  return `pbkdf2_sha256$${iterations}$${salt}$${hash}`;
}

export function verifyAdminPassword(password: string, encoded = process.env.ADMIN_PASSWORD_HASH ?? '') {
  const [algorithm, iterationsText, salt, expected] = encoded.split('$');
  if (algorithm !== 'pbkdf2_sha256' || !iterationsText || !salt || !expected) return false;
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actual = crypto.pbkdf2Sync(password, salt, Number(iterationsText), expectedBuffer.length || 32, 'sha256');
  return expectedBuffer.length > 0 && expectedBuffer.length === actual.length && crypto.timingSafeEqual(expectedBuffer, actual);
}

export function createAdminSessionToken(email: string, now = Date.now()) {
  const payload = b64url(JSON.stringify({ email, exp: now + SESSION_TTL_SECONDS * 1000 } satisfies AdminSession));
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSessionToken(token?: string | null, now = Date.now()) {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expectedSignature = sign(payload);
  if (signature.length !== expectedSignature.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null;
  const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AdminSession;
  return session.exp > now ? session : null;
}

export async function getAdminSession() { return verifyAdminSessionToken((await cookies()).get(ADMIN_COOKIE_NAME)?.value); }
export async function setAdminSession(email: string) { (await cookies()).set(ADMIN_COOKIE_NAME, createAdminSessionToken(email), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: SESSION_TTL_SECONDS, path: '/' }); }
export async function clearAdminSession() { (await cookies()).set(ADMIN_COOKIE_NAME, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0, path: '/' }); }
export async function requireAdminSession() { const session = await getAdminSession(); if (!session) throw new Error('Unauthorized'); return session; }
