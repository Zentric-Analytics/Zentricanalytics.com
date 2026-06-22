import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Stage 3 screening/interview/assessment source checks', () => {
  it('adds generic HiringStage metadata and migration for Stage 3 instructions', () => {
    expect(readFileSync('prisma/schema.prisma', 'utf8')).toContain('metadata      Json?');
    expect(readFileSync('prisma/migrations/20260622050000_stage3_metadata/migration.sql', 'utf8')).toContain('ADD COLUMN IF NOT EXISTS "metadata" JSONB');
  });

  it('candidate portal gates Stage 3, shows released instructions, and never renders download links for uploads', () => {
    const portal = readFileSync('src/app/track/portal/page.tsx', 'utf8');
    expect(portal).toContain('Stage 3 unlocks after Stage 2 approval.');
    expect(portal).toContain('Screening details will be shared by the admin.');
    expect(portal).toContain('Submit Stage 3');
    expect(portal).toContain('requiresUpload');
    expect(portal).not.toContain('/api/admin/applications/${application.id}/uploads');
  });

  it('candidate Stage 3 action requires a valid session, release, private upload, and safe diagnostics', () => {
    const actions = readFileSync('src/app/track/actions.ts', 'utf8');
    expect(actions).toContain('export async function submitStage3');
    expect(actions).toContain('verifiedSessionTokenHash: sha256(session)');
    expect(actions).toContain('application: { deletedAt: null }');
    expect(actions).toContain('metadata.releasedAt');
    expect(actions).toContain('validateCvFile');
    expect(actions).toContain('savePrivateUpload');
    expect(actions).toContain('stageSubmission.create');
    expect(actions).toContain('uploadedDocument.create');
    expect(actions).toContain("status: 'Under Review'");
    expect(actions).toContain('candidateStage3SubmitDiagnostics');
    const diagnostics = actions.slice(actions.indexOf('candidateStage3SubmitDiagnostics'));
    expect(diagnostics).not.toContain('session:');
    expect(diagnostics).not.toContain('file contents');
  });

  it('admin can release, review, correct, reject, and approve Stage 3 to unlock Stage 4', () => {
    const detail = readFileSync('src/app/admin/applications/[id]/page.tsx', 'utf8');
    const actions = readFileSync('src/app/admin/applications/actions.ts', 'utf8');
    const workflow = readFileSync('src/lib/workflow.ts', 'utf8');
    expect(detail).toContain('Stage 3 Screening / Interview / Assessment');
    expect(detail).toContain('Release/update Stage 3 instructions');
    expect(detail).toContain('Uploaded Stage 3 files');
    expect(detail).toContain('AdminDocumentActions');
    expect(actions).toContain('adminStage3InstructionAction');
    expect(actions).toContain('adminStage3Action');
    expect(actions).toContain('stage-3-instructions-available');
    expect(workflow).toContain('export async function approveStage3');
    expect(workflow).toContain('stageOrder: 4');
    expect(workflow).toContain("status: 'Offer Pending'");
    expect(workflow).toContain('recordAdminStage3Action');
  });
});
