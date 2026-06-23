import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const portal = readFileSync('src/app/track/portal/page.tsx', 'utf8');
const actions = readFileSync('src/app/track/actions.ts', 'utf8');

describe('candidate portal stage selector source checks', () => {
  it('has no conflict markers anywhere in the repository', () => {
    expect(() => execFileSync('rg', ['-n', ['<<<' + '<<<<', '===' + '====', '>>>' + '>>>>'].join('|'), '.'], { stdio: 'pipe' })).toThrow();
  });

  it('is a complete Next.js page file', () => {
    expect(portal).toContain("import Link from 'next/link';");
    expect(portal).toContain('export default async function Portal');
    expect(portal).toContain('verifiedSessionTokenHash: sha256(session)');
    expect(portal).not.toContain('<<<' + '<<<<');
    expect(portal).not.toContain('===' + '====');
    expect(portal).not.toContain('>>>' + '>>>>');
  });

  it('renders stage cards with locked disabled cards and selectable links preserving session and stage', () => {
    expect(portal).toContain('Application stages');
    expect(portal).toContain('Select a stage workspace');
    expect(portal).toContain('portalHref(session, item.order)');
    expect(portal).toContain("new URLSearchParams({ session, stage: String(stageOrder) })");
    expect(portal).toContain('aria-disabled="true"');
    expect(portal).toContain('Open workspace');
    expect(portal).toContain('Selected');
  });

  it('renders only the selected workspace and includes Stage 4 offer controls', () => {
    expect(portal).toContain('function Workspace');
    expect(portal).toContain('selectedStage.order === 4');
    expect(portal).toContain('Stage4Workspace');
    expect(portal).toContain('Offer details will appear here when released by admin.');
    expect(portal).toContain('Accept Offer');
    expect(portal).toContain('Decline Offer');
  });

  it('keeps documents as admin-review only with no applicant download links', () => {
    expect(portal).toContain('Submitted documents are available for admin review. You can track your application status here.');
    expect(portal).not.toContain('Stage1DownloadButton');
    expect(portal).not.toContain('/api/candidate/documents/stage-1');
    expect(portal).not.toContain('Download PDF');
    expect(portal).not.toContain('storageKey');
  });

  it('preserves selected stage on candidate action redirects', () => {
    expect(actions).toContain("{ stage: '2', error: 'stage2_validation' }");
    expect(actions).toContain("{ stage: '2', success: 'stage2_submitted' }");
    expect(actions).toContain("{ stage: '3', error: 'stage3_validation' }");
    expect(actions).toContain("{ stage: '3', success: 'stage3_submitted' }");
    expect(actions).toContain("{ stage: '4', error: 'offer_validation' }");
    expect(actions).toContain("{ stage: '4', success: 'offer_accepted' }");
  });
});
