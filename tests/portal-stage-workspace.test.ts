import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const portal = readFileSync('src/app/track/portal/page.tsx', 'utf8');
const actions = readFileSync('src/app/track/actions.ts', 'utf8');

describe('candidate portal selectable stage workspace source checks', () => {
  it('defaults to current selectable stage and renders all stage selector links/cards', () => {
    expect(portal).toContain('const requestedStageOrder = Number(stage)');
    expect(portal).toContain('const defaultStage = currentStage && isSelectable(currentStage.status) ? currentStage : firstSelectableStage');
    expect(portal).toContain('portalStages.map((definition)');
    expect(portal).toContain('href={stageHref(session, definition.order)}');
    expect(portal).toContain("params.set('session', session)");
    expect(portal).toContain("params.set('stage', String(order))");
  });

  it('keeps locked stages disabled with locked copy instead of a form', () => {
    expect(portal).toContain('const selectedStageLocked = !isSelectable(selectedStage.status)');
    expect(portal).toContain('aria-disabled="true"');
    expect(portal).toContain('This stage is not available yet.');
    expect(portal).toContain('Offer stage unlocks after screening approval.');
  });

  it('renders one selected workspace for Stage 2, Stage 3, Stage 4, and Stage 5', () => {
    expect(portal).toContain('Selected stage workspace');
    expect(portal).toContain('selectedStage.order === 2');
    expect(portal).toContain('action={submitStage2}');
    expect(portal).toContain('selectedStage.order === 3');
    expect(portal).toContain('action={submitStage3}');
    expect(portal).toContain('selectedStage.order === 4');
    expect(portal).toContain('Offer details');
    expect(portal).toContain('selectedStage.order === 5');
  });

  it('shows released Stage 4 offer controls and unavailable/no-offer waiting message', () => {
    expect(portal).toContain('showOfferDecision');
    expect(portal).toContain('Accept Offer');
    expect(portal).toContain('Decline Offer');
    expect(portal).toContain('Offer details will appear here when released by admin.');
    expect(portal).toContain('This offer has been withdrawn.');
    expect(portal).toContain('This offer is no longer open.');
  });

  it('preserves selected stage on applicant action redirects', () => {
    expect(actions).toContain("portalUrl(session, { stage: '2', success: 'stage2_submitted' })");
    expect(actions).toContain("portalUrl(session, { stage: '3', success: 'stage3_submitted' })");
    expect(actions).toContain("portalUrl(session, { stage: '4', success: 'offer_accepted' })");
    expect(actions).toContain("portalUrl(session, { stage: '4', success: 'offer_declined' })");
  });

  it('does not render applicant document download links or expose session/storage secrets in diagnostics', () => {
    expect(portal).not.toContain('/api/candidate/documents');
    expect(portal).not.toContain('storageKey');
    expect(actions).not.toContain('sessionToken');
    expect(actions).not.toContain('console.log');
  });
});
