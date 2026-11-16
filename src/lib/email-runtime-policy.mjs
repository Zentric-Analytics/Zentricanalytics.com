import { validateDeploymentRuntimeMetadata } from './deployment-runtime-metadata.mjs';
import { resolveDeploymentEnvironment } from './deployment-environment.mjs';
import { evaluateOutgoingEmailRecipientEligibility } from './environment-policy-rules.mjs';

// Owner-reviewed service bindings. These identify configuration matches, not
// cryptographic Render attestation. Never construct bindings from a request/env.
const bindings=Object.freeze([
 Object.freeze({serviceId:'srv-d8s6ovvavr4c73fctksg',identitySource:'render',workloadType:'web',repository:'Zentric-Analytics/Zentricanalytics.com',branch:'dev',environment:'staging',configuredOrigin:'https://staging.zentricanalytics.com'}),
 Object.freeze({serviceId:'srv-d8s89fbeo5us73e7ljk0',identitySource:'render',workloadType:'web',repository:'Zentric-Analytics/Zentricanalytics.com',branch:'main',environment:'production',configuredOrigin:'https://www.zentricanalytics.com'}),
]);
const blocked=reasonCode=>Object.freeze({decision:'CONFIGURATION_BLOCKED',reasonCode});
/** Injected server process configuration only. HTTP host/headers/cookies are never inputs. */
export function evaluateRuntimeEmailPolicy(env,recipient){
 if(!env||typeof env!=='object')return blocked('INVALID_PROCESS_CONFIGURATION');
 const protectedIdentity=Boolean(env.RENDER||env.RENDER_SERVICE_ID||env.RENDER_GIT_REPO_SLUG);
 if(!protectedIdentity){
  if(['test','development'].includes(env.NODE_ENV))return Object.freeze({decision:'SIMULATED',reasonCode:'LOCAL_NO_PROVIDER_AUTHORITY'});
  return blocked('RUNTIME_IDENTITY_REQUIRED');
 }
 if(env.RENDER!=='true'||!['true','false'].includes(env.IS_PULL_REQUEST))return blocked('EXPLICIT_RENDER_PREVIEW_CLASSIFICATION_REQUIRED');
 const checked=validateDeploymentRuntimeMetadata({executionKind:'render',identitySource:'render',serviceId:env.RENDER_SERVICE_ID,workloadType:env.RENDER_SERVICE_TYPE,repository:env.RENDER_GIT_REPO_SLUG,branch:env.RENDER_GIT_BRANCH,environment:env.APP_ENV,configuredOrigin:env.APPLICATION_BASE_URL,isPreview:env.IS_PULL_REQUEST==='true'});
 if(checked.status!=='VALIDATED')return blocked(checked.reasonCode);
 const resolution=resolveDeploymentEnvironment(checked.metadata,bindings,checked.executionContext);
 if(resolution.status==='UNVERIFIED')return blocked(resolution.reasonCode);
 if(resolution.workloadType!=='web')return blocked('WORKLOAD_NOT_PERMITTED');
 let allowlist;
 if(resolution.environment==='staging'){
  try{allowlist=JSON.parse(env.STAGING_EMAIL_RECIPIENT_ALLOWLIST);}catch{return blocked('INVALID_STAGING_RECIPIENT_ALLOWLIST');}
 }
 const eligible=evaluateOutgoingEmailRecipientEligibility(resolution,recipient,allowlist);
 return Object.freeze({decision:eligible.eligible?'ALLOW':eligible.reasonCode==='STAGING_RECIPIENT_NOT_ALLOWLISTED'?'HOLD':eligible.reasonCode==='INVALID_EMAIL_ADDRESS'?'INVALID_RECIPIENT':'CONFIGURATION_BLOCKED',reasonCode:eligible.reasonCode});
}
