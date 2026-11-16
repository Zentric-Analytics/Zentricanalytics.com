import assert from 'node:assert/strict';
import {describe,it} from './offline-test-api.mjs';
import {resolveDeploymentEnvironment} from '../src/lib/deployment-environment.mjs';
import {evaluateOutgoingEmailRecipientEligibility} from '../src/lib/environment-policy-rules.mjs';
const binding={serviceId:'synthetic-web',identitySource:'render' as const,workloadType:'web' as const,repository:'fixture/repo',branch:'main',environment:'production' as const,configuredOrigin:'https://example.test'};
const resolution={status:'VERIFIED_PRODUCTION',reasonCode:'BINDING_MATCH',environment:'production',workloadType:'web',verificationBasis:'CONFIGURATION_MATCH'} as const;
describe('all ASCII control characters remain rejected after lint-safe validation',()=>{
 for(const code of [...Array.from({length:32},(_,i)=>i),127]){
  it('rejects identity control '+code,()=>assert.equal(resolveDeploymentEnvironment({...binding,serviceId:'synthetic'+String.fromCharCode(code)+'web',isPreview:false},[binding],{kind:'render'}).reasonCode,'INVALID_METADATA'));
  it('rejects mailbox control '+code,()=>assert.equal(evaluateOutgoingEmailRecipientEligibility(resolution,'recipient'+String.fromCharCode(code)+'@example.test',undefined).eligible,false));
 }
});
