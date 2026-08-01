import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertAssetStatusTransition, assetAssignmentInput, assetInput } from "../src/lib/hr/assets/validation";
import { detectDocumentContentType, documentMustBeRestricted, safeDocumentFileName, validateHrDocumentFile } from "../src/lib/hr/documents/validation";
import { permissionsForRole } from "../src/lib/hr/permissions/catalog";

describe("HRMS documents and assets", () => {
  it("detects genuine PDF, JPEG, and PNG signatures", () => {
    expect(detectDocumentContentType(new Uint8Array(Buffer.from("%PDF-1.7")))).toBe("application/pdf");
    expect(detectDocumentContentType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectDocumentContentType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectDocumentContentType(new Uint8Array(Buffer.from("<script>")))).toBeNull();
  });

  it("rejects MIME spoofing, empty files, and oversized uploads", () => {
    const pdf = new Uint8Array(Buffer.from("%PDF-1.7 test"));
    expect(() => validateHrDocumentFile(new File([pdf], "claim.jpg", { type: "image/jpeg" }), pdf)).toThrow("genuine");
    expect(() => validateHrDocumentFile(new File([], "empty.pdf", { type: "application/pdf" }), new Uint8Array())).toThrow("empty");
    expect(() => validateHrDocumentFile(new File([pdf], "large.pdf", { type: "application/pdf" }), pdf, 5)).toThrow("size limit");
  });

  it("sanitizes unsafe filenames and always restricts sensitive categories", () => {
    expect(safeDocumentFileName("../../bad\r\nname?.pdf")).toBe("bad-name-.pdf");
    expect(documentMustBeRestricted("IDENTITY_DOCUMENT")).toBe(true);
    expect(documentMustBeRestricted("TAX_DOCUMENT")).toBe(true);
    expect(documentMustBeRestricted("BANK_DOCUMENT")).toBe(true);
    expect(documentMustBeRestricted("OTHER")).toBe(false);
  });

  it("validates asset values and assignment dates without floating-point calculations", () => {
    expect(assetInput.parse({ assetTag: "lap-1", type: "Laptop", name: "Developer laptop", purchaseValue: "1234.56", currency: "ngn", condition: "GOOD" }).assetTag).toBe("LAP-1");
    expect(() => assetInput.parse({ assetTag: "L1", type: "Laptop", name: "Laptop", purchaseValue: "-1", currency: "NGN", condition: "GOOD" })).toThrow();
    expect(() => assetAssignmentInput.parse({ assetId: "cm12345678901234567890123", employeeId: "cm12345678901234567890124", assignedAt: "2026-08-10", expectedReturnAt: "2026-08-01", issueCondition: "GOOD" })).toThrow("Expected return");
  });

  it("enforces irreversible asset lifecycle transitions", () => {
    expect(() => assertAssetStatusTransition("AVAILABLE", "UNDER_REPAIR")).not.toThrow();
    expect(() => assertAssetStatusTransition("UNDER_REPAIR", "AVAILABLE")).not.toThrow();
    expect(() => assertAssetStatusTransition("RETIRED", "DISPOSED")).not.toThrow();
    expect(() => assertAssetStatusTransition("DISPOSED", "AVAILABLE")).toThrow();
    expect(() => assertAssetStatusTransition("RETIRED", "AVAILABLE")).toThrow();
    expect(() => assertAssetStatusTransition("ASSIGNED", "AVAILABLE")).toThrow();
  });

  it("keeps supervisors and payroll administrators from mutating assets implicitly", () => {
    expect(permissionsForRole("EMPLOYEE")).toContain("asset.read_self");
    expect(permissionsForRole("EMPLOYEE")).not.toContain("asset.assign");
    expect(permissionsForRole("PAYROLL_ADMIN")).not.toContain("asset.manage");
    expect(permissionsForRole("HR_ADMIN")).toContain("asset.assign");
    expect(permissionsForRole("HR_ADMIN")).toContain("asset.return");
  });

  it("defines additive document and asset models with immutable history", () => {
    const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
    const migration = fs.readFileSync(path.join(process.cwd(), "prisma/migrations/20260730030000_hrms_documents_assets/migration.sql"), "utf8");
    for (const model of ["HrEmployeeDocument", "HrEmployeeDocumentVersion", "HrDocumentAccessLog", "HrAsset", "HrAssetAssignment"]) expect(schema).toContain(`model ${model}`);
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(migration).toContain('"HrEmployeeDocumentVersion_protected_update"');
    expect(migration).toContain('"HrDocumentAccessLog_immutable"');
    expect(migration).toContain('"HrAssetAssignment_protected_update"');
    expect(migration).toContain('"HrAssetAssignment_one_active_asset"');
  });

  it("blocks unscanned files and enforces self or permission-bound downloads", () => {
    const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/hr/documents/versions/[id]/route.ts"), "utf8");
    expect(route).toContain('scanStatus: "CLEAN"');
    expect(route).toContain("auth.user.employee?.id === version.document.employeeId");
    expect(route).toContain('auth.permissions.has("document.read_sensitive")');
    expect(route).toContain("hrDocumentAccessLog.create");
    expect(route).toContain('"Cache-Control": "private, no-store"');
    expect(route).toContain('"Content-Security-Policy": "default-src');
  });

  it("stores uploaded files outside transactions and compensates failed metadata writes", () => {
    const actions = fs.readFileSync(path.join(process.cwd(), "src/app/hr/admin/documents/actions.ts"), "utf8");
    expect(actions).toContain("validateHrDocumentFile");
    expect(actions).toContain("storage.head(storageKey)");
    expect(actions).toContain("storage.delete(storageKey)");
    expect(actions).toContain("crypto.randomUUID()");
    expect(actions).toContain('scanStatus: "PENDING"');
    expect(actions).toContain("documentMustBeRestricted");
  });

  it("uses serializable custody transitions and reference-only notifications", () => {
    const actions = fs.readFileSync(path.join(process.cwd(), "src/app/hr/admin/assets/actions.ts"), "utf8");
    expect(actions).toContain('isolationLevel: "Serializable"');
    expect(actions).toContain('status: "ASSIGNED"');
    expect(actions).toContain('status: "RETURNED"');
    expect(actions).toContain('status: "LOST"');
    expect(actions).toContain("payload: { assetAssignmentId: assignment.id }");
    expect(actions).not.toMatch(/payload:\s*\{[^}]*serial/i);
  });
});
