import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const PASSWORD_ROUNDS = 12;

export function normalizeHrEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashOpaqueToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function hashHrPassword(password: string) {
  return bcrypt.hash(password, PASSWORD_ROUNDS);
}

export function verifyHrPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function passwordMeetsPolicy(password: string) {
  return password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

export function sealHrCredential(value: string, secret = process.env.AUTH_SECRET ?? "") {
  if (secret.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters.");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", crypto.createHash("sha256").update(secret).digest(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function unsealHrCredential(envelope: string, secret = process.env.AUTH_SECRET ?? "") {
  if (secret.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters.");
  const [iv, tag, ciphertext] = envelope.split(".");
  if (!iv || !tag || !ciphertext) throw new Error("Invalid credential envelope.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", crypto.createHash("sha256").update(secret).digest(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}
