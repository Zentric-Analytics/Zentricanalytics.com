from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UNIT = ROOT / "docs" / "hrms" / "delivery-units" / "unit-09"
CANDIDATE = "NG-CANDIDATE-2026.9"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def payload_paths() -> list[str]:
    inventory = json.loads((UNIT / "ng-candidate-2026-9-dependency-inventory.json").read_text(encoding="utf-8"))
    paths = {entry["path"] for entry in inventory["files"]}
    paths.update(
        p.relative_to(ROOT).as_posix()
        for p in UNIT.glob("ng-candidate-2026-9-*")
        if p.name not in {
            "ng-candidate-2026-9-stage1-manifest.json",
            "ng-candidate-2026-9-stage1-package.sha256",
            "ng-candidate-2026-9-immutable-review-package.zip",
            "ng-candidate-2026-9-immutable-review-package.zip.sha256",
        }
    )
    paths.update(
        {
            "docs/hrms/delivery-units/unit-09/Zentric_NG-CANDIDATE-2026.8_Immutable_Review_Package.zip",
            "docs/hrms/delivery-units/unit-09/Zentric_NG-CANDIDATE-2026.8_Immutable_Review_Package.zip.sha256",
            "prisma/schema.prisma",
            "prisma/migrations/20260825160000_hrms_unit9_ng_2026_7_annualization/migration.sql",
            "scripts/hr-unit9-ng-2026-9-dependency-inventory.mjs",
            "scripts/hr-unit9-ng-2026-9-dependency-inventory.d.mts",
            "scripts/hr-unit9-ng-2026-9-fixtures.mjs",
            "scripts/hr-unit9-ng-2026-9-fixtures.d.mts",
            "scripts/hr-unit9-ng-2026-9-package.py",
            "tests/fixtures/ng-candidate-2026-9-certification-families.json",
            "tests/hrms-unit9-ng-2026-9.test.ts",
            "tests/hrms-unit9-ng-2026-9-dependencies.test.ts",
            "tests/hrms-unit9-ng-2026-9-fixtures.test.ts",
            "tests/hrms-unit9-ng-2026-9-package.test.ts",
            "src/app/hr/admin/unit-9-status/2026-9/page.tsx",
        }
    )
    missing = [path for path in paths if not (ROOT / path).is_file()]
    if missing:
        raise SystemExit(f"Missing package payloads: {missing}")
    return sorted(paths)


def make_archive(paths: list[str], manifest_bytes: bytes, index_bytes: bytes, target: Path) -> str:
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in paths:
            info = zipfile.ZipInfo(path, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, (ROOT / path).read_bytes())
        for path, data in [
            ("docs/hrms/delivery-units/unit-09/ng-candidate-2026-9-stage1-manifest.json", manifest_bytes),
            ("docs/hrms/delivery-units/unit-09/ng-candidate-2026-9-stage1-package.sha256", index_bytes),
        ]:
            info = zipfile.ZipInfo(path, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    return sha256(target.read_bytes())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--validation", default="docs/hrms/delivery-units/unit-09/ng-candidate-2026-9-validation-results.json")
    args = parser.parse_args()
    validation_path = ROOT / args.validation
    if not validation_path.exists():
        raise SystemExit(f"Validation evidence missing: {args.validation}")
    paths = payload_paths()
    payloads = [{"path": path, "sha256": sha256((ROOT / path).read_bytes())} for path in paths]
    manifest = {
        "candidateVersion": CANDIDATE,
        "candidateStatus": "NOT_CERTIFIED",
        "sourceSetVersion": "NG-2026.9-SOURCES-v1",
        "ruleConfigurationVersion": "NG-2026.9-RULES-v1-NOT_CERTIFIED",
        "engineVersion": "unit9-ng-2026.9",
        "testSuiteVersion": "ng-2026.9-stage1-v1",
        "evidenceVersion": "ng-2026.9-evidence-v1",
        "effectiveDateStatus": "CANDIDATE_2026_RULES_PROFESSIONAL_APPROVAL_PENDING",
        "professionalReviewStatus": "READY_FOR_QUALIFIED_PROFESSIONAL_STAGE_1_REVIEW",
        "certificationStatus": "NOT_CERTIFIED",
        "repository": "Zentric-Analytics/Zentricanalytics.com",
        "branch": git("branch", "--show-current"),
        "featureCommit": git("rev-parse", "HEAD"),
        "featureTree": git("rev-parse", "HEAD^{tree}"),
        "baselineCommit": "cd303f9b9f0b6f32631b390de32280d1917ef102",
        "baselineTree": "9e2a76a2c2828f44ac5fed833378cf3ac90880bd",
        "predecessorArchiveSha256": "1b6a00096032958adc20b6d36e3c96d79ccdf362c3b4fab8365e6c3ebf9f2f03",
        "dependencyInventory": "docs/hrms/delivery-units/unit-09/ng-candidate-2026-9-dependency-inventory.json",
        "fixtureEvidence": "docs/hrms/delivery-units/unit-09/ng-candidate-2026-9-fixture-evidence.json",
        "validationEvidence": args.validation,
        "payloadFileCount": len(payloads),
        "payloads": payloads,
        "certificationBoundary": {
            "professionalNigeriaCertification": False,
            "productionPayrollActivation": False,
            "officialFinalization": False,
            "officialPayslipPublication": False,
            "realPaymentAccountingPostingFilingOrRemittance": False,
            "stage2Started": False,
            "unit10Started": False,
        },
    }
    manifest_path = UNIT / "ng-candidate-2026-9-stage1-manifest.json"
    index_path = UNIT / "ng-candidate-2026-9-stage1-package.sha256"
    archive_path = UNIT / "ng-candidate-2026-9-immutable-review-package.zip"
    checksum_path = UNIT / "ng-candidate-2026-9-immutable-review-package.zip.sha256"
    manifest_bytes = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode()
    index_bytes = "".join(f"{item['sha256']}  {item['path']}\n" for item in payloads).encode()
    manifest_path.write_bytes(manifest_bytes)
    index_path.write_bytes(index_bytes)
    first = make_archive(paths, manifest_bytes, index_bytes, archive_path)
    verification = UNIT / ".ng-candidate-2026-9-rebuild.zip"
    second = make_archive(paths, manifest_bytes, index_bytes, verification)
    verification.unlink()
    if first != second:
        raise SystemExit("Deterministic archive rebuild failed")
    checksum_path.write_text(f"{first}  {archive_path.name}\n", encoding="utf-8", newline="\n")
    print(json.dumps({"payloads": len(payloads), "archiveSha256": first, "manifestSha256": sha256(manifest_bytes), "deterministicRebuild": first == second}, indent=2))


if __name__ == "__main__":
    main()
