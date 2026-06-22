import crypto from 'node:crypto';

export function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function randomDigits(length = 6) {
  const max = 10 ** length;
  return crypto.randomInt(0, max).toString().padStart(length, '0');
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  if (!domain) return maskGeneric(email);
  return `${name.slice(0, 2)}***@${domain}`;
}

export function maskGeneric(value: string) {
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

export function isAdminSecretValid(secret?: string | null) {
  return Boolean(process.env.ADMIN_SESSION_SECRET && secret === process.env.ADMIN_SESSION_SECRET);
}
