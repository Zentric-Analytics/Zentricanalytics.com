# Owner-approved development workflow

The sole dedicated Zentric Analytics development branch is
`feature/hrms-email-queue-safety`. This remains the central development history
until the owner separately authorizes promotion to `dev`.

- Begin each task by verifying the repository remote and active branch. Safely
  fetch and compare this exact remote branch without discarding local work.
- Do not create any other feature, fix, checkpoint, integration, recovery or
  temporary development branch. Do not create a branch per unit.
- Keep each task within its authorized scope. Validate approved changes before
  committing and pushing directly to the dedicated branch when publication is
  safe. Clearly label incomplete checkpoints as WIP.
- Never discard uncommitted changes, force-push or rewrite published history.
  If the branch is unavailable or publication is unsafe, stop and report the
  blocker instead of creating an alternative branch.
- Verify the GitHub commit SHA after every successful push; report both local
  and remote SHAs. Preserve external harness/evidence through an explicit
  recovery and off-machine backup plan.
- Do not modify, push to or merge into `dev` or `main` without separate owner
  authorization. Do not automatically create a release PR or activate deployment.
- Development authorization does not authorize migrations, mail/worker
  activation, provider operations or production configuration changes.
- Before eventual promotion, complete the separately authorized final debugging,
  TypeScript compilation, regression, security, database safety,
  deployment-readiness and recovery-verification phase. Resolve every critical
  and high-risk release blocker. Explicit owner approval is required to merge.

The Q03 source archive under `tools/q03-migration-validation/` is WIP preservation
material with deliberate operational dependencies omitted. Its historical CLI
flags, identities and source are not current execution authorization.
