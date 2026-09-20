# NG-CANDIDATE-2026.10 historical integrity correction register

## Scope

Exactly two historical checksum claims are covered. A third mismatch, any missing correction record, any altered original claim, or any substituted retained artifact is a validation failure.

| Candidate | Artifact | Original claimed SHA-256 | Authoritative retained SHA-256 | Retained commit | Retained blob | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 2026.2 | `ng-candidate-2026-2-postgresql-evidence.md` | `bd1906347d019c23d1ccf1f01d4072bff457badca80efb5c7beeacedc59aca68` | `0c220b75ec03045644ffa8d8dcb29610a26e209314ab53e1d4823863a4dac7e2` | `a793a25416f98ca41c47c3e71fd25ecc4423f849` | `15e6cf14c953b6bbb5ded950f33fba9898cf5034` | `SUPERSEDED` |
| 2026.3 | `ng-candidate-2026-3-remediation-matrix.md` | `517b048c6689d1a872fdbd2d6b87401c033c83101cfe598a2fd569d1352cd7a9` | `d7bf9466ed568b350d9d3e11d41f7b393a312e04f522b553123cc121852f3dec` | `f13696df41a20f07a165215c0b1a57e376b4b16b` | `7853154d2614296f4923af5945a5ebfcdc6f15ac` | `SUPERSEDED` |

Each correction package uses the raw retained Git blob bytes, not a Windows working-tree conversion. The correction packages state `originalBytesAvailable: false`, `historicalClaimStatus: SUPERSEDED`, and `correctionStatus: CLOSED_BY_VERSIONED_INTEGRITY_CORRECTION`.

The correction allows current engineering validation to continue only. It does not certify Unit 9 or authorize official payroll outputs.
