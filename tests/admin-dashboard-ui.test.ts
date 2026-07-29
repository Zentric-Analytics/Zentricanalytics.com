import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const listPage = readFileSync('src/app/admin/applications/page.tsx', 'utf8');
const detailPage = readFileSync('src/app/admin/applications/[id]/page.tsx', 'utf8');
const deletedPage = readFileSync('src/app/admin/applications/deleted/page.tsx', 'utf8');
const documentActions = readFileSync('src/app/admin/applications/[id]/AdminDocumentActions.tsx', 'utf8');
const candidatePortal = readFileSync('src/app/track/portal/page.tsx', 'utf8');

describe('production admin hiring dashboard source checks', () => {
  it('keeps all HR profile content fully readable without clipped controls', () => {
    const styles = readFileSync('src/app/globals.css', 'utf8');

    expect(detailPage).toContain('admin-workspace');
    expect(listPage).toContain('admin-workspace');
    expect(detailPage).toContain('[overflow-wrap:anywhere]');
    expect(styles).toContain('.admin-workspace .btn');
    expect(styles).toContain('height:auto');
    expect(styles).toContain('white-space:normal');
  });

  it('active applications page exposes real profile navigation and wired filters', () => {
    expect(listPage).toContain('Hiring admin');
    expect(listPage).toContain('View full profile');
    expect(listPage).toContain('href={`/admin/applications/${application.id}`}');
    expect(listPage).toContain('currentStageOrder: stageFilter');
    expect(listPage).toContain('status: statusFilter');
    expect(listPage).not.toContain('<option>All stages</option>');
    expect(listPage).not.toContain('deleted=all');
  });

  it('detail page has a profile workspace, stage progress, organized stage sections, and danger zone', () => {
    expect(detailPage).toContain('← Back to applications');
    expect(detailPage).toContain('Profile summary');
    expect(detailPage).toContain('Stage timeline / progress');
    expect(detailPage).toContain('Stage 1 Application');
    expect(detailPage).toContain('Stage 2 identity verification');
    expect(detailPage).toContain('Stage 3 Screening / Interview / Assessment');
    expect(detailPage).toContain('Stage 4 Offer Stage');
    expect(detailPage).toContain('Stage 5 Agreement / onboarding');
    expect(detailPage).toContain('Danger zone');
    expect(detailPage).not.toContain('JSON.stringify(stageOneSubmission.payload');
  });

  it('document controls remain admin-only and candidate pages do not expose applicant document links', () => {
    expect(detailPage).toContain('AdminDocumentActions');
    expect(detailPage).toContain('/api/admin/applications/${application.id}/uploads/${uploadedDocument.id}');
    expect(documentActions).toContain('credentials: "same-origin"');
    expect(candidatePortal).not.toContain('/api/admin/applications/');
    expect(candidatePortal).not.toContain('storageKey');
  });

  it('deleted applications page keeps real view, restore, and destructive delete controls', () => {
    expect(deletedPage).toContain('Deleted applications');
    expect(deletedPage).toContain('View full profile');
    expect(deletedPage).toContain('restoreApplicationAction');
    expect(deletedPage).toContain('permanentlyDeleteApplicationAction');
    expect(deletedPage).toContain('Permanently delete');
    expect(deletedPage).toContain('No deleted applications');
  });

  it('does not render conflict markers or sensitive tokens in scoped admin pages', () => {
    const scoped = [listPage, detailPage, deletedPage].join('\n');
    for (const marker of ['<<<<<<<', '=======', '>>>>>>>']) expect(scoped).not.toContain(marker);
    for (const unsafe of ['OTP', 'sessionToken', 'apiKey', 'storageKey}', 'private upload path']) expect(scoped).not.toContain(unsafe);
  });
});
