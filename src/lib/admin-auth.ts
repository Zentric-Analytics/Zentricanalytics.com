import crypto from 'node:crypto';
import { cookies } from 'next/headers';

export const ADMIN_COOKIE_NAME = 'za_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 4;
const MIN_SESSION_SECRET_LENGTH = 32;

type AdminSession = { email: string; exp: number };

type ParsedAdminPasswordHash = {
  algorithm: 'pbkdf2_sha256';
  iterations: number;
  salt: string;
  expected: Buffer;
};

export type AdminLoginDiagnostics = {
  adminEmailConfigured: boolean;
  submittedEmailPresent: boolean;
  configuredEmailPresent: boolean;
  submittedEmailMatchesConfiguredEmail: boolean;
  passwordHashConfigured: boolean;
  passwordHashFormatValid: boolean;
  passwordVerified: boolean;
  adminSessionSecretConfigured: boolean;
  adminSessionSecretLengthValid: boolean;
};

export function normalizeServerEnvValue(value?: string | null) {
  const trimmed = String(value ?? '').trim();
  if (trimmed.length >= 2) {
    const first = trimmed.at(0);
    const last = trimmed.at(-1);
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function getConfiguredAdminEmail(value = process.env.ADMIN_EMAIL) {
  return normalizeServerEnvValue(value).toLowerCase();
}

export function getConfiguredAdminPasswordHash(value = process.env.ADMIN_PASSWORD_HASH) {
  return normalizeServerEnvValue(value);
}

export function getConfiguredAdminSessionSecret(value = process.env.ADMIN_SESSION_SECRET) {
  return normalizeServerEnvValue(value);
}

export function isAdminSessionSecretLengthValid(value = process.env.ADMIN_SESSION_SECRET) {
  return getConfiguredAdminSessionSecret(value).length >= MIN_SESSION_SECRET_LENGTH;
}

function secret() {
  const value = getConfiguredAdminSessionSecret();
  if (!value || value.length < MIN_SESSION_SECRET_LENGTH) throw new Error('ADMIN_SESSION_SECRET must be at least 32 characters.');
  return value;
}
function b64url(input: Buffer | string) { return Buffer.from(input).toString('base64url'); }
function sign(payload: string) { return crypto.createHmac('sha256', secret()).update(payload).digest('base64url'); }

export function hashAdminPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  const iterations = 310_000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex');
  return `pbkdf2_sha256$${iterations}$${salt}$${hash}`;
}

export function parseAdminPasswordHash(encoded = process.env.ADMIN_PASSWORD_HASH ?? ''): ParsedAdminPasswordHash | null {
  const normalized = getConfiguredAdminPasswordHash(encoded);
  if (!normalized || normalized.startsWith('ADMIN_PASSWORD_HASH=')) return null;
  const parts = normalized.split('$');
  if (parts.length !== 4) return null;
  const [algorithm, iterationsText, salt, expectedHex] = parts;
  if (algorithm !== 'pbkdf2_sha256') return null;
  if (!/^\d+$/.test(iterationsText)) return null;
  const iterations = Number(iterationsText);
  if (!Number.isSafeInteger(iterations) || iterations <= 0) return null;
  if (!salt) return null;
  if (!expectedHex || expectedHex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(expectedHex)) return null;
  const expected = Buffer.from(expectedHex, 'hex');
  if (expected.length === 0) return null;
  return { algorithm, iterations, salt, expected };
}

export function isAdminPasswordHashFormatValid(encoded = process.env.ADMIN_PASSWORD_HASH ?? '') {
  return parseAdminPasswordHash(encoded) !== null;
}

export function verifyAdminPassword(password: string, encoded = process.env.ADMIN_PASSWORD_HASH ?? '') {
  const parsed = parseAdminPasswordHash(encoded);
  if (!parsed) return false;
  const actual = crypto.pbkdf2Sync(password, parsed.salt, parsed.iterations, parsed.expected.length, 'sha256');
  return parsed.expected.length === actual.length && crypto.timingSafeEqual(parsed.expected, actual);
}

export function buildAdminLoginDiagnostics(submittedEmail: string, passwordVerified: boolean): AdminLoginDiagnostics {
  const normalizedSubmittedEmail = normalizeServerEnvValue(submittedEmail).toLowerCase();
  const configuredEmail = getConfiguredAdminEmail();
  const passwordHash = getConfiguredAdminPasswordHash();
  const sessionSecret = getConfiguredAdminSessionSecret();
  return {
    adminEmailConfigured: configuredEmail.length > 0,
    submittedEmailPresent: normalizedSubmittedEmail.length > 0,
    configuredEmailPresent: configuredEmail.length > 0,
    submittedEmailMatchesConfiguredEmail: normalizedSubmittedEmail.length > 0 && configuredEmail.length > 0 && normalizedSubmittedEmail === configuredEmail,
    passwordHashConfigured: passwordHash.length > 0,
    passwordHashFormatValid: isAdminPasswordHashFormatValid(passwordHash),
    passwordVerified,
    adminSessionSecretConfigured: sessionSecret.length > 0,
    adminSessionSecretLengthValid: sessionSecret.length >= MIN_SESSION_SECRET_LENGTH,
  };
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
