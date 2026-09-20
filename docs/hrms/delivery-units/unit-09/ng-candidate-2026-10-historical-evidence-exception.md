# NG-CANDIDATE-2026.10 — historical evidence exception

## Status

Engineering inventory only. **NOT CERTIFIED.** This record does not approve payroll calculations, official outputs, finalization, payment, remittance, filing, deployment, or production use.

## Validation result

The candidate's Unit Nine code and the recoverable 2026.4 through 2026.8 immutable artifacts were restored from authenticated repository history or the corresponding immutable packages. Their targeted preservation checks pass.

Two older evidence bindings remain unresolved. They are historical-evidence discrepancies, not corrections to payroll rules:

| Historical artifact | Recorded SHA-256 | Retained source status |
| --- | --- | --- |
| 2026.2 PostgreSQL evidence | `bd1906347d019c23d1ccf1f01d4072bff457badca80efb5c7beeacedc59aca68` | The retained Git version has a different digest; the existing 2026.2 integrity-correction record states that the original matching bytes were not recovered. |
| 2026.3 remediation matrix | `517b048c6689d1a872fdbd2d6b87401c033c83101cfe598a2fd569d1352cd7a9` | The recorded digest is preserved, but the available Git history and locally available immutable packages do not contain matching source bytes. |

## Controls

- The recorded original digests remain unchanged.
- No expected checksum was regenerated or weakened.
- No substitute evidence is represented as the original evidence.
- Validation and staging advancement remain blocked pending independent evidence-review disposition.
- The owner-accepted 2026.10 engineering rules remain separately tested and continue to fail closed for unresolved payroll controls.

## Reviewer decision required

A qualified evidence reviewer must either recover and validate the original artifacts, or explicitly accept the retained evidence under a documented exception. Any exception must state its scope, reviewer, basis, and effect on certification. It cannot be inferred from this engineering record.
