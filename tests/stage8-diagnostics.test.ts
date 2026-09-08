import { describe, expect, it } from 'vitest';
import { finalizationFailure } from '../src/lib/hr/recruitment/finalization-diagnostics';

describe('finalization diagnostics privacy', () => {
  it('classifies known evidence failures', () => {
    expect(finalizationFailure(new Error('Current final HR approval evidence is required.'))).toEqual({ reason: 'FINAL_APPROVAL_EVIDENCE' });
  });
  it('drops arbitrary messages, stacks and database metadata', () => {
    expect(finalizationFailure({ code: 'P2002', message: 'private applicant value', stack: 'private stack', meta: { target: 'private' } })).toEqual({ reason: 'DATABASE_ERROR', databaseCode: 'P2002' });
  });
  it('does not leak dynamic requirement names', () => {
    expect(finalizationFailure(new Error('Final HR approval requires review of: private requirement'))).toEqual({ reason: 'REQUIREMENTS_PENDING' });
  });
  it.each([null, 'private', { code: 'private', message: 'private' }, new Error('constructor')])('handles unclassified failures safely', error => {
    expect(finalizationFailure(error)).toEqual({ reason: 'UNCLASSIFIED' });
  });
});
