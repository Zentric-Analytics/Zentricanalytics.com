import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(bytes = 20) {
  const buffer = crypto.randomBytes(bytes);
  let bits = "";
  for (const value of buffer) bits += value.toString(2).padStart(8, "0");
  let output = "";
  for (let index = 0; index < bits.length; index += 5) output += ALPHABET[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  return output;
}

function decodeBase32(value: string) {
  const normalized = value.toUpperCase().replace(/=+$/g, "");
  if (!normalized || [...normalized].some((character) => !ALPHABET.includes(character))) throw new Error("Invalid TOTP secret.");
  let bits = "";
  for (const character of normalized) bits += ALPHABET.indexOf(character).toString(2).padStart(5, "0");
  return Buffer.from(Array.from({ length: Math.floor(bits.length / 8) }, (_, index) => Number.parseInt(bits.slice(index * 8, index * 8 + 8), 2)));
}

export function totpCode(secret: string, time = Date.now(), stepSeconds = 30) {
  const counter = Math.floor(time / 1000 / stepSeconds);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

export function matchingTotpStep(code: string, secret: string, time = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null;
  for (const window of [-1, 0, 1]) {
    const expected = totpCode(secret, time + window * 30_000);
    if (crypto.timingSafeEqual(Buffer.from(code), Buffer.from(expected))) return BigInt(Math.floor(time / 1000 / 30) + window);
  }
  return null;
}

export function verifyTotp(code: string, secret: string, time = Date.now()) {
  return matchingTotpStep(code, secret, time) !== null;
}

export function totpProvisioningUri(email: string, secret: string) {
  const issuer = "Zentric Analytics";
  const label = `${issuer}:${email}`;
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
