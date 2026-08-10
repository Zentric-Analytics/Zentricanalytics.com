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
  const normalized = path.basename(original).normalize("NFKC");
  const base = [...normalized].map((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 || '"<>:|?*\\/'.includes(character) ? "-" : character;
  }).join("").replace(/-+/g, "-").replace(/\s+/g, " ").trim();
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
  const extension = path.extname(file.name).toLowerCase();
  const expectedExtension = new Map([["application/pdf", ".pdf"], ["image/jpeg", ".jpg"], ["image/png", ".png"]]).get(detected);
  if (extension !== expectedExtension && !(detected === "image/jpeg" && extension === ".jpeg")) throw new Error("The filename extension does not match the verified document type.");
  if (detected === "application/pdf") {
    const text = Buffer.from(bytes).toString("latin1");
    if (!/startxref\s+\d+\s+%%EOF\s*$/.test(text)) throw new Error("The PDF structure is incomplete or contains trailing content.");
  }
  if (detected === "image/jpeg" && (bytes.length < 4 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9)) throw new Error("The JPEG structure is incomplete.");
  if (detected === "image/png") {
    const tail = bytes.subarray(Math.max(0, bytes.length - 12));
    if (tail.length !== 12 || Buffer.from(tail.subarray(4, 8)).toString("ascii") !== "IEND") throw new Error("The PNG structure is incomplete or contains trailing content.");
  }
  return { contentType: detected, displayFileName: safeDocumentFileName(file.name), sizeBytes: file.size };
}
