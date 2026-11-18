import crypto from 'node:crypto';
import type { HrEmailOutbox, HrEmailHoldReason, Prisma, PrismaClient } from '@prisma/client';
import type { EmailEvent, EmailSendResult } from '../../email';
import { evaluateQueueTransition, type QueueCommand, type QueueSnapshot } from './queue-transition-rules.mjs';
import type { RuntimeEmailPolicy } from '../../email-runtime-policy.mjs';

const POLICY_REVISION='hrms-email-policy-v1';
const MAX_ATTEMPTS=5;
const LEASE_MS=15*60_000;
type Dependencies={client:PrismaClient;policy:(recipient:string)=>RuntimeEmailPolicy;providerConfigured:()=>boolean;render:(template:string,payload:unknown)=>{body:string;html:string};send:(event:EmailEvent)=>Promise<EmailSendResult>;now?:()=>Date;id?:()=>string};
type Row=HrEmailOutbox;
const clearClaim={claimId:null,claimedAt:null,claimExpiresAt:null};
type Counts={claimed:number;delivered:number;failed:number;abandoned:number;held:number;blocked:number};
const counts=():Counts=>({claimed:0,delivered:0,failed:0,abandoned:0,held:0,blocked:0});
class ClaimConflict extends Error{}

/** The real adapter provides DB transactions; fake adapters do not prove SQL atomicity. */
export function createQueueDispatcher(deps:Dependencies){
 const now=deps.now??(()=>new Date()),id=deps.id??(()=>crypto.randomUUID());
 const policy=(row:Row)=>{const p=deps.policy(row.recipient);return p.decision==='ALLOW'&&!deps.providerConfigured()?{decision:'CONFIGURATION_BLOCKED' as const,reasonCode:'PROVIDER_CONFIGURATION_REQUIRED'}:p;};
 async function credential(tx:Prisma.TransactionClient,row:Row,at:Date):Promise<Pick<QueueSnapshot,'credentialState'|'credentialExpiresAt'>>{
  if(!['hr-account-invitation','hr-password-reset'].includes(row.template))return {credentialState:'NOT_APPLICABLE',credentialExpiresAt:null};
  const expiration=row.messageExpiresAt?.getTime()??0;
  if(!expiration||expiration<=at.getTime())return {credentialState:'EXPIRED',credentialExpiresAt:expiration};
  const c=row.template==='hr-account-invitation'
   ?row.invitationId?await tx.hrAccountInvitation.findFirst({where:{id:row.invitationId,organizationId:row.organizationId},include:{user:true}}):null
   :row.resetChallengeId?await tx.hrPasswordResetChallenge.findFirst({where:{id:row.resetChallengeId},include:{user:true}}):null;
  if(!c||c.user.organizationId!==row.organizationId||c.user.email.trim().toLowerCase()!==row.recipient.trim().toLowerCase()||!['ACTIVE','INVITED'].includes(c.user.status))return {credentialState:'REVOKED',credentialExpiresAt:expiration};
  if(c.usedAt||c.status==='USED')return {credentialState:'USED',credentialExpiresAt:expiration};
  if(c.status!=='ACTIVE')return {credentialState:'REVOKED',credentialExpiresAt:expiration};
  const expires=Math.min(expiration,c.expiresAt.getTime());
  return {credentialState:expires>at.getTime()?'VALID':'EXPIRED',credentialExpiresAt:expires};
 }
 async function move(previous:Row,type:QueueCommand['type'],options:{claim?:string;unsupported?:boolean;outcome?:EmailSendResult}={}):Promise<Row|null>{
  return deps.client.$transaction(async tx=>{
   const row=await tx.hrEmailOutbox.findFirst({where:{id:previous.id,organizationId:previous.organizationId,safetyContractVersion:1}});
   if(!row||row.version!==previous.version)return null;
   const at=now(),eligibility=await credential(tx,row,at),p=policy(row);
   const snapshot:QueueSnapshot={state:row.status,version:Number(row.version),claimId:row.claimId,claimExpiresAt:row.claimExpiresAt?.getTime()??null,dispatchPhase:row.dispatchPhase??'NONE',attemptCount:row.attemptCount,maxAttempts:MAX_ATTEMPTS,nextAttemptAt:row.nextAttemptAt.getTime(),holdReason:row.holdReason,...eligibility};
   let command:QueueCommand={type,expectedVersion:Number(row.version),claimId:options.claim??row.claimId??undefined,policy:options.unsupported?'UNSUPPORTED_TEMPLATE':p.decision,retryable:options.outcome?.retryable===true};
   if(type==='BEGIN_INVOCATION'&&p.decision!=='ALLOW'){
    // Only a current RESERVED row with no durable invocation boundary may cancel.
    const invocation=await tx.hrEmailDispatchEvent.findFirst({where:{outboxId:row.id,organizationId:row.organizationId,dispatchId:row.dispatchId,kind:'INVOCATION_BOUNDARY'}});
    if(invocation)return null;
    command={type:'CANCEL_RESERVED',expectedVersion:Number(row.version),claimId:row.claimId??undefined,nonInvocationEstablished:true,invocationFenced:true};
   }
   const decision=evaluateQueueTransition(snapshot,command,at.getTime());
   if(decision.disposition!=='TRANSITION'||!decision.nextState||!decision.nextDispatchPhase)return null;
   const data:Prisma.HrEmailOutboxUpdateManyMutationInput={status:decision.nextState,dispatchPhase:decision.nextDispatchPhase,version:{increment:1},attemptCount:{increment:decision.attemptDelta}};
   if(decision.nextState!=='PROCESSING')Object.assign(data,clearClaim);
   if(type==='CLAIM'&&decision.nextState==='PROCESSING')Object.assign(data,{claimId:options.claim,claimedAt:at,claimExpiresAt:new Date(at.getTime()+LEASE_MS)});
   if(decision.nextDispatchPhase==='NONE')data.dispatchId=null;
   else if(type==='DISPATCH_INTENT')data.dispatchId=id();
   if(decision.nextState==='HELD'){
    if(!['STAGING_RECIPIENT_NOT_ALLOWLISTED','INVALID_RECIPIENT','UNSUPPORTED_TEMPLATE','CREDENTIAL_EXPIRED_OR_UNUSABLE','PROVIDER_OUTCOME_UNCERTAIN','LEGACY_PROCESSING_REVIEW_REQUIRED','PRE_INVOCATION_CANCELLED'].includes(decision.reasonCode))throw new ClaimConflict();
    Object.assign(data,{holdReason:decision.reasonCode as HrEmailHoldReason,heldAt:at,holdPolicyRevision:POLICY_REVISION,lastError:'EMAIL_HELD_FOR_REVIEW'});
   }
   else Object.assign(data,{holdReason:null,heldAt:null,holdPolicyRevision:null,reviewDueAt:null});
   if(decision.attemptDelta===1)data.lastAttemptedAt=at;
   if(type==='RECOVER'&&decision.nextState==='PENDING')data.nextAttemptAt=at;
   if(type==='PROVIDER_ACCEPTED')Object.assign(data,{provider:'resend',providerMessageId:options.outcome?.providerMessageId,providerAcceptedAt:at,deliveredAt:at,lastError:null});
   if(type==='PROVIDER_FAILED')Object.assign(data,{provider:'resend',lastError:'EMAIL_PROVIDER_REJECTED',nextAttemptAt:new Date(at.getTime()+Math.min(1440,2**Math.max(0,row.attemptCount-1)*5)*60_000)});
   const won=await tx.hrEmailOutbox.updateMany({where:{id:row.id,organizationId:row.organizationId,safetyContractVersion:1,version:row.version,status:row.status,claimId:row.claimId,dispatchPhase:row.dispatchPhase},data});
   if(won.count!==1)return null;
   const updated=await tx.hrEmailOutbox.findFirst({where:{id:row.id,organizationId:row.organizationId}});if(!updated)throw new ClaimConflict();
   const version=Number(updated.version);
   const audit=await tx.hrAuditEvent.create({data:{organizationId:row.organizationId,actorRole:'EMAIL_WORKER',entityType:'HrEmailOutbox',entityId:row.id,action:'hr.email.queue.'+command.type.toLowerCase(),correlationId:updated.dispatchId??updated.claimId??row.claimId??id(),previousValues:{status:row.status,phase:row.dispatchPhase,version:Number(row.version)},newValues:{status:updated.status,phase:updated.dispatchPhase,version,reasonCode:decision.reasonCode}}});
   const kinds:Partial<Record<QueueCommand['type'],Prisma.HrEmailDispatchEventCreateInput['kind']>>={CLAIM:'CLAIMED',DISPATCH_INTENT:'INTENT_RECORDED',BEGIN_ATTEMPT:'RESERVED',BEGIN_INVOCATION:'INVOCATION_BOUNDARY',CANCEL_RESERVED:'RESERVATION_CANCELLED',PROVIDER_ACCEPTED:'PROVIDER_ACCEPTED',PROVIDER_FAILED:'PROVIDER_FAILED',PROVIDER_UNCERTAIN:'OUTCOME_UNCERTAIN'};
   const kind=updated.status==='HELD'?(command.type==='CANCEL_RESERVED'?'RESERVATION_CANCELLED':command.type==='PROVIDER_UNCERTAIN'?'OUTCOME_UNCERTAIN':'HELD'):kinds[command.type];
   // NONE recovery has no dispatch yet. Its durable audit is recorded above;
   // never fabricate a provider/claim journal event to fill that enum gap.
   if(kind)await tx.hrEmailDispatchEvent.create({data:{outboxId:row.id,organizationId:row.organizationId,kind,transitionVersion:updated.version,dispatchId:updated.dispatchId??row.dispatchId,claimId:updated.claimId??row.claimId,reason:updated.holdReason,policyRevision:POLICY_REVISION,auditEventId:audit.id,providerMessageId:options.outcome?.providerMessageId}});
   if(decision.attemptDelta===1)await tx.hrEmailDeliveryAttempt.create({data:{outboxId:row.id,attemptNumber:updated.attemptCount,status:'PROCESSING',provider:'resend',attemptedAt:at}});
   const recoveredAttempt=type==='RECOVER'&&row.dispatchPhase==='ATTEMPTED'&&updated.status==='HELD';
   if(recoveredAttempt||['PROVIDER_ACCEPTED','PROVIDER_FAILED','PROVIDER_UNCERTAIN'].includes(type)){
    const attempt=await tx.hrEmailDeliveryAttempt.updateMany({where:{outboxId:row.id,attemptNumber:row.attemptCount,status:'PROCESSING'},data:{status:updated.status,provider:'resend',providerMessageId:options.outcome?.providerMessageId,safeError:type==='PROVIDER_ACCEPTED'?null:'EMAIL_PROVIDER_OUTCOME_REVIEW'}});
    if(attempt.count!==1)throw new ClaimConflict();
   }
   return updated;
  });
 }
 async function dispatch(candidate:Row):Promise<Counts>{
  const result=counts();if(candidate.safetyContractVersion!==1){result.blocked++;return result;}
  const claim=id();let row=await move(candidate,'CLAIM',{claim});if(!row){result.blocked++;return result;}if(row.status==='HELD'){result.held++;return result;}result.claimed++;
  let content:{body:string;html:string};
  try {
   content=deps.render(row.template,row.payload);
  } catch {
   const held=await move(row,'HOLD',{unsupported:true});
   if(held?.status==='HELD')result.held++;
   else result.blocked++;
   return result;
  }
  for(const type of ['DISPATCH_INTENT','BEGIN_ATTEMPT','BEGIN_INVOCATION'] as const){const next=await move(row,type);if(!next){result.blocked++;return result;}row=next;if(row.status==='HELD'){result.held++;return result;}}
  // Durable ATTEMPTED is possible invocation, not proof of HTTP transmission.
  // A final rejection preserves that counted ambiguity without refund or retry.
  const allowed=await deps.client.$transaction(async tx=>{
   const current=await tx.hrEmailOutbox.findFirst({where:{id:row!.id,organizationId:row!.organizationId,version:row!.version,claimId:claim,status:'PROCESSING',dispatchPhase:'ATTEMPTED'}});
   if(!current||!current.claimExpiresAt||current.claimExpiresAt.getTime()-now().getTime()<30_000)return false;
   const c=await credential(tx,current,now());return policy(current).decision==='ALLOW'&&(c.credentialState==='NOT_APPLICABLE'||c.credentialState==='VALID');
  });
  let outcome:EmailSendResult;
  if(!allowed)outcome={provider:'resend',status:'uncertain',invoked:false};
  else try{outcome=await deps.send({applicationId:row.id,to:row.recipient,template:row.template,subject:row.subject,body:content.body,html:content.html,dispatchKey:row.dispatchId??undefined,sensitiveBody:['hr-account-invitation','hr-password-reset'].includes(row.template)});}catch{outcome={provider:'resend',status:'uncertain',invoked:true};}
  const accepted=outcome.status==='sent'&&outcome.provider==='resend'&&outcome.invoked===true&&typeof outcome.providerMessageId==='string'&&/^[A-Za-z0-9_-]{1,256}$/.test(outcome.providerMessageId);
  const rejected=outcome.status==='failed'&&outcome.provider==='resend'&&outcome.invoked===true;
  const final=await move(row,accepted?'PROVIDER_ACCEPTED':rejected?'PROVIDER_FAILED':'PROVIDER_UNCERTAIN',{outcome:{...outcome,providerMessageId:accepted?outcome.providerMessageId:undefined}});
  if(!final){result.blocked++;return result;}
  if(final.status==='DELIVERED')result.delivered++;else if(final.status==='HELD')result.held++;else if(final.status==='ABANDONED')result.abandoned++;else result.failed++;
  return result;
 }
 async function recover(){
  const rows=await deps.client.hrEmailOutbox.findMany({where:{safetyContractVersion:1,status:'PROCESSING',claimExpiresAt:{lte:now()}},take:100});
  for(const row of rows)await move(row,'RECOVER');
 }
 async function processBatch(limit=25){
  await recover();const rows=await deps.client.hrEmailOutbox.findMany({where:{safetyContractVersion:1,status:{in:['PENDING','FAILED']},nextAttemptAt:{lte:now()},attemptCount:{lt:MAX_ATTEMPTS}},orderBy:[{nextAttemptAt:'asc'},{createdAt:'asc'}],take:Math.max(1,Math.min(100,Math.trunc(limit)||25))});const total=counts();
  for(const row of rows){try{const one=await dispatch(row);for(const key of Object.keys(total) as (keyof Counts)[])total[key]+=one[key];}catch{total.blocked++;}}
  return total;
 }
 async function processItem(outboxId:string,organizationId?:string){
  if(!organizationId)return {...counts(),blocked:1};
  const row=await deps.client.hrEmailOutbox.findFirst({where:{id:outboxId,organizationId,safetyContractVersion:1,status:{in:['PENDING','FAILED']},nextAttemptAt:{lte:now()},attemptCount:{lt:MAX_ATTEMPTS}}});return row?dispatch(row):counts();
 }
 return {processBatch,processItem};
}
