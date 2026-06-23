import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const portal = readFileSync('src/app/track/portal/page.tsx', 'utf8');
const trackActions = readFileSync('src/app/track/actions.ts', 'utf8');
const adminPage = readFileSync('src/app/admin/applications/[id]/page.tsx', 'utf8');
const adminActions = readFileSync('src/app/admin/applications/actions.ts', 'utf8');
const workflow = readFileSync('src/lib/workflow.ts', 'utf8');
const schema = readFileSync('prisma/schema.prisma', 'utf8');

describe('Stage 4 offer workflow source checks', () => {
  it('keeps Stage 4 workflow logic while hiding non-actionable portal status copy', () => {
    expect(portal).toContain('showOfferDecision');
    expect(portal).toContain('Offer stage unlocks after screening approval.');
    expect(workflow).toContain("status: 'Offer Pending'");
    expect(workflow).toContain('stageOrder: 4');
    expect(workflow).toContain("status: 'Available'");
  });

  it('adds offer model decision/release fields and admin draft/release/withdraw actions', () => {
    expect(schema).toContain('candidateDecisionAt');
    expect(schema).toContain('releasedByAdminEmail');
    expect(adminPage).toContain('Stage 4 Offer Stage');
    expect(adminActions).toContain('Admin saved draft offer');
    expect(adminActions).toContain('Admin released offer');
    expect(adminActions).toContain('Admin withdrew offer');
    expect(adminActions).toContain('Your offer is ready for review');
  });

  it('renders released offers in the candidate portal and blocks unreleased/expired/withdrawn decisions', () => {
    expect(portal).toContain('Offer details will appear here when released by admin.');
    expect(portal).toContain('Offer details');
    expect(portal).toContain('Accept Offer');
    expect(portal).toContain('Decline Offer');
    expect(trackActions).toContain("offer.status !== 'Released'");
    expect(trackActions).toContain('offerExpiryDate');
    expect(trackActions).toContain('offer_not_open');
  });

  it('defaults current/selectable Stage 4 into the visible selected workspace', () => {
    expect(portal).toContain('const defaultSelectedStage = currentStage && isSelectable(currentStage.status) ? currentStage : portalStages[0]');
    expect(portal).toContain('selectedStage?.order === 4');
    expect(portal).toContain('Current workspace');
    expect(portal).toContain('Stage {selectedStage?.order ?? currentStage?.order}: {selectedStage?.title');
    expect(portal).toContain('lg:col-start-1 lg:row-start-2');
  });

  it('keeps selectable Stage 4 cards visibly actionable', () => {
    expect(portal).toContain("aria-current={selected ? 'step' : undefined}");
    expect(portal).toContain("{selected ? 'Selected' : selectable ? 'Open stage' : 'Locked'}");
    expect(portal).toContain('ring-2 ring-brand/20');
    expect(portal).toContain('encodeURIComponent(session)');
  });

  it('keeps Application Documents after the workspace without applicant download links or conflict markers', () => {
    expect(portal).toContain('Application Documents');
    expect(portal).toContain('Submitted documents are available for admin review. You can track your application status here.');
    expect(portal).not.toContain('/api/admin/applications/');
    expect(portal).not.toContain('download');
    expect(portal).not.toContain('<<<<<<<');
    expect(portal).not.toContain('=======');
    expect(portal).not.toContain('>>>>>>>');
  });

  it('accepting unlocks Stage 5 and declining does not', () => {
    expect(workflow).toContain("status: 'Agreement Pending'");
    expect(workflow).toContain('currentStageOrder: 5');
    expect(trackActions).toContain("status: 'Declined'");
    expect(trackActions).toContain("status: 'Rejected', currentStageOrder: 4");
    expect(portal).toContain('Employment agreement stage is now available.');
  });

  it('blocks soft-deleted applications and avoids applicant document links/sensitive diagnostics', () => {
    expect(adminActions).toContain('restore_before_stage_action');
    expect(trackActions).toContain('application: { deletedAt: null }');
    expect(portal).not.toContain('/api/admin/applications/');
    expect(trackActions).not.toContain('sessionToken');
    expect(adminActions).not.toContain('console.log');
  });
});
