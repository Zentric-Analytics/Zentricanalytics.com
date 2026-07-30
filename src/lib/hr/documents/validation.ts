import path from "node:path";
import { z } from "zod";

export const documentMetadataInput = z.object({
  employeeId: z.string().cuid(),
  category: z.enum(["EMPLOYMENT_AGREEMENT", "OFFER_LETTER", "IDENTITY_DOCUMENT", "TAX_DOCUMENT", "BANK_DOCUMENT", "QUALIFICATION_CERTIFICATE", "POLICY_ACKNOWLEDGEMENT", "LEAVE_SUPPORT", "PERFORMANCE", "DISCIPLINARY", "EXIT_DOCUMENT", "OTHER"]),
  title: z.string().trim().min(2).max(160),
  expiresAt: z.coerce.date().optional().or(z.literal("")).transform((value) => value === "" ? undefined : value),
  restricted: z.boolean(),
});

const sensitiveCategories = new Set(["IDENTITY_DOCUMENT", "TAX_DOCUMENT", "BANK_DOCUMENT", "DISCIPLINARY"]);
export function documentMustBeRestricted(category: string) {
  return sensitiveCategories.has(category);
}

export function safeDocumentFileName(original: string) {
  const base = path.basename(original).normalize("NFKC").replace(/[\u0000-\u001f\u007f"<>:|?*\\/]+/g, "-").replace(/\s+/g, " ").trim();
  const safe = base.replace(/^\.+/, "").slice(0, 180);
  return safe || "document";
}

function hasPrefix(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

export function detectDocumentContentType(bytes: Uint8Array) {
  if (bytes.length >= 5 && Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-") return "application/pdf";
  if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  return null;
}

export function validateHrDocumentFile(file: File, bytes: Uint8Array, maxBytes = Number(process.env.UPLOAD_MAX_BYTES) || 10 * 1024 * 1024) {
  if (!file.size || file.size !== bytes.byteLength) throw new Error("The uploaded document is empty or incomplete.");
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1024 || file.size > maxBytes) throw new Error("The uploaded document exceeds the configured size limit.");
  const detected = detectDocumentContentType(bytes);
  if (!detected || detected !== file.type) throw new Error("Only genuine PDF, JPEG, and PNG documents are accepted.");
  return { contentType: detected, displayFileName: safeDocumentFileName(file.name), sizeBytes: file.size };
}
