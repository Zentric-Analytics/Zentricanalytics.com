import {PREFIX} from './config.mjs';
import {NEW_OUTBOX} from './evidence-rules.mjs';
export const id=name=>`${PREFIX}_${name}`;
export function literal(value){if(value===null)return'NULL';if(typeof value==='number'){if(!Number.isSafeInteger(value))throw Error('INVALID_NUMERIC_FIXTURE');return String(value);}return `'${String(value).replaceAll("'","''")}'`;}
export function insert(table,row){if(!/^[A-Za-z][A-Za-z0-9]+$/.test(table)||Object.keys(row).some(k=>!/^[A-Za-z][A-Za-z0-9]*$/.test(k)))throw Error('INVALID_FIXTURE_IDENTIFIER');
 return `INSERT INTO "${table}" (${Object.keys(row).map(k=>`"${k}"`).join(',')}) VALUES (${Object.values(row).map(literal).join(',')});`;}
const stamp='2030-01-01T00:00:00Z';
export function baseFixturesSQL(){
 const rows=[];
 for(const suffix of ['aurora','cobalt']){
  const org=id(`org_${suffix}`),user=id(`user_${suffix}`),role=id(`role_${suffix}`),permission=id(`permission_${suffix}`);
  rows.push(insert('HrOrganization',{id:org,slug:`${PREFIX}-${suffix}`,name:`Q03 Fictional ${suffix}`,updatedAt:stamp}));
  rows.push(insert('HrUser',{id:user,organizationId:org,email:`${suffix}@example.invalid`,status:'INVITED',updatedAt:stamp}));
  rows.push(insert('HrRole',{id:role,organizationId:org,key:'EMPLOYEE',name:'Q03 fictional fixture role',updatedAt:stamp}));
  rows.push(insert('HrPermission',{id:permission,organizationId:org,key:'q03.fixture.review'}));
  rows.push(insert('HrUserRole',{id:id(`user_role_${suffix}`),userId:user,roleId:role}));
  rows.push(insert('HrRolePermission',{id:id(`role_permission_${suffix}`),roleId:role,permissionId:permission}));
  rows.push(insert('HrAuditEvent',{id:id(`audit_${suffix}`),organizationId:org,actorUserId:user,actorRole:'Q03_FIXTURE',entityType:'Q03_SYNTHETIC',entityId:id(`entity_${suffix}`),action:'q03.fixture.prepared',previousValues:JSON.stringify({synthetic:'before',suffix}),newValues:JSON.stringify({synthetic:'after',suffix}),reason:`Q03 audit ${suffix}`,ipHash:id(`fictional_ip_${suffix}`),userAgent:'Q03 offline fixture',requestId:id(`request_${suffix}`),correlationId:id(`correlation_${suffix}`),createdAt:stamp}));
  for(const kind of ['valid','expired','used','revoked','superseded']){
   const status=kind==='used'?'USED':['revoked','superseded'].includes(kind)?'REVOKED':'ACTIVE';
   const expiresAt=kind==='expired'?'2000-01-01T00:00:00Z':'2099-01-01T00:00:00Z';
   rows.push(insert('HrAccountInvitation',{id:id(`invite_${suffix}_${kind}`),organizationId:org,userId:user,createdById:user,
    tokenHash:id(`synthetic_nonsecret_invite_hash_${suffix}_${kind}`),status,expiresAt,usedAt:kind==='used'?stamp:null}));
   rows.push(insert('HrPasswordResetChallenge',{id:id(`reset_${suffix}_${kind}`),userId:user,
    codeHash:id(`synthetic_nonsecret_code_hash_${suffix}_${kind}`),status,expiresAt,usedAt:kind==='used'?stamp:null}));
  }
 }
 return `BEGIN;\n${rows.join('\n')}\nCOMMIT;`;
}
export function queue(name,overrides={}){return {id:id(name),organizationId:id('org_aurora'),recipient:'recipient@example.invalid',template:'hr-new-application',subject:'Q03 synthetic message',
 payload:JSON.stringify({synthetic:true,run:PREFIX}),idempotencyKey:id(`idem_${name}`),safetyContractVersion:1,version:0,dispatchPhase:'NONE',...overrides};}
export function processing(name,phase='NONE',overrides={}){return queue(name,{status:'PROCESSING',dispatchPhase:phase,claimId:id(`claim_${name}`),claimedAt:stamp,claimExpiresAt:'2099-01-01T00:00:00Z',
 dispatchId:phase==='NONE'?null:id(`dispatch_${name}`),attemptCount:phase==='ATTEMPTED'?1:0,...overrides});}
export function held(name,overrides={}){return queue(name,{status:'HELD',holdReason:'STAGING_RECIPIENT_NOT_ALLOWLISTED',heldAt:stamp,holdPolicyRevision:'q03-policy-fixture',...overrides});}
export function journal(name,outbox,kind,overrides={}){return {id:id(name),outboxId:outbox.id,organizationId:outbox.organizationId,kind,
 dispatchId:outbox.dispatchId??null,claimId:outbox.claimId??null,transitionVersion:1,...overrides};}
export function legacyFixturesSQL(){const rows=[];for(const [index,status] of ['PENDING','PROCESSING','FAILED','DELIVERED','ABANDONED'].entries()){
 const row=queue(`legacy_${status.toLowerCase()}`,{status,attemptCount:index,recipient:`legacy-${index}@example.invalid`,template:'hr-new-application',subject:`Q03 historical subject ${index}`,payload:JSON.stringify({synthetic:true,index,status}),provider:'resend',providerMessageId:id(`legacy_provider_${index}`),nextAttemptAt:`2030-02-0${index+1}T01:02:03.004Z`,lastAttemptedAt:`2029-12-0${index+1}T04:05:06.007Z`,lastError:`Q03 historical error ${index}`,createdAt:`2029-01-0${index+1}T08:09:10.011Z`,deliveredAt:`2029-12-1${index+1}T12:13:14.015Z`});delete row.safetyContractVersion;delete row.version;delete row.dispatchPhase;
 rows.push(insert('HrEmailOutbox',row));
 for(let attempt=1;attempt<=index;attempt++)rows.push(insert('HrEmailDeliveryAttempt',{id:id(`legacy_attempt_${index}_${attempt}`),outboxId:row.id,attemptNumber:attempt,status,provider:'resend',providerMessageId:id(`legacy_attempt_provider_${index}_${attempt}`),safeError:`Q03 synthetic historical receipt ${index}/${attempt}`,attemptedAt:`2029-11-0${index+1}T00:00:0${attempt}.001Z`}));
 }return `BEGIN;\n${rows.join('\n')}\nCOMMIT;`;}
export const LEGACY_SNAPSHOT_SQL=`SELECT json_build_object('outbox',(SELECT json_agg(to_jsonb(o)-ARRAY[${NEW_OUTBOX.map(literal).join(',')}] ORDER BY o.id) FROM "HrEmailOutbox" o WHERE id LIKE '${PREFIX}_legacy_%'), 'attempts',(SELECT json_agg(row_to_json(a) ORDER BY a.id) FROM "HrEmailDeliveryAttempt" a WHERE a.id LIKE '${PREFIX}_legacy_attempt_%'), 'audit',(SELECT json_agg(row_to_json(a) ORDER BY a.id) FROM "HrAuditEvent" a WHERE a.id IN (${literal(id('audit_aurora'))},${literal(id('audit_cobalt'))})));`;
export const COVERAGE=Object.freeze(['two-organizations','fictional-users-and-roles','invitation-valid-expired-used-revoked-superseded','reset-valid-expired-used-revoked-superseded',
 'legacy-five-statuses','immutable-attempts','idempotency','new-pending-processing-failed-held','intent-reserved-attempted','ownership-conflicts','tenant-negatives','acceptance-vs-simulation','uncertainty']);
