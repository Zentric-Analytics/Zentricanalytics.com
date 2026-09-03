export type Ng2026_9FixtureEvidence = {
  candidateVersion: "NG-CANDIDATE-2026.9";
  candidateStatus: "NOT_CERTIFIED";
  generatedBy: string;
  fixtures: Array<{ familyId: string; manifestHash: string; outputHash: string; expectedDownstreamAuthorization: "REJECT_NOT_CERTIFIED"; evidenceClassification: string }>;
  evidenceHash: string;
};
export function buildNg2026_9FixtureEvidence(source?: unknown): Ng2026_9FixtureEvidence;
