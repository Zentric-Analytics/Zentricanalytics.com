import {describe,it,expect,vi} from 'vitest';
import type {PrismaClient} from '@prisma/client';
import {createQueueDispatcher} from '../src/lib/hr/notifications/dispatch-engine';
import type {EmailSendResult} from '../src/lib/email';

function setup(){
 let clock=new Date('2030-01-01T00:00:00Z'),sequence=0,tail=Promise.resolve();
 const state:{rows:Record<string,unknown>[];journal:Record<string,unknown>[];attempts:Record<string,unknown>[];audit:Record<string,unknown>[]}={rows:[],journal:[],attempts:[],audit:[]};
 const matches=(row:Record<string,unknown>,where:Record<string,unknown>={})=>Object.entries(where).every(([k,v])=>{const x=row[k];if(v&&typeof v==='object'&&!(v instanceof Date)){const c=v as Record<string,unknown>;if(c.in)return (c.in as unknown[]).includes(x);if(c.lt!==undefined)return (x as number)<(c.lt as number);if(c.lte!==undefined)return (x as number)<=(c.lte as number);}return x===v;});
 function table(key:keyof typeof state){return {
  findFirst:vi.fn(async({where}:{where:Record<string,unknown>})=>structuredClone(state[key].find(r=>matches(r,where))??null)),
  findMany:vi.fn(async({where,take=100}:{where:Record<string,unknown>;take?:number})=>structuredClone(state[key].filter(r=>matches(r,where)).slice(0,take))),
  create:vi.fn(async({data}:{data:Record<string,unknown>})=>{if(key==='journal'&&state.journal.some(r=>r.outboxId===data.outboxId&&r.transitionVersion===data.transitionVersion))throw Error('unique journal version');const row={id:'synthetic_'+(++sequence),...data};state[key].push(row);return structuredClone(row);}),
  updateMany:vi.fn(async({where,data}:{where:Record<string,unknown>;data:Record<string,unknown>})=>{if(key==='attempts')throw Error('Email delivery attempts are immutable');let count=0;for(const r of state[key])if(matches(r,where)){for(const[k,v]of Object.entries(data)){if(v&&typeof v==='object'&&'increment'in v)r[k]=typeof r[k]==='bigint'?(r[k] as bigint)+BigInt((v as {increment:number}).increment):(r[k] as number)+(v as {increment:number}).increment;else r[k]=v;}count++;}return {count};}),
 };}
 const tx={hrEmailOutbox:table('rows'),hrEmailDispatchEvent:table('journal'),hrEmailDeliveryAttempt:table('attempts'),hrAuditEvent:table('audit'),hrAccountInvitation:{findFirst:vi.fn(async()=>null)},hrPasswordResetChallenge:{findFirst:vi.fn(async()=>null)}};
 const client={...tx,$transaction:async(fn:(t:typeof tx)=>Promise<unknown>)=>{let release!:()=>void;const next=new Promise<void>(r=>release=r),previous=tail;tail=next;await previous;const saved=structuredClone(state);try{return await fn(tx);}catch(e){Object.assign(state,saved);throw e;}finally{release();}}};
 let decision:'ALLOW'|'HOLD'|'CONFIGURATION_BLOCKED'|'INVALID_RECIPIENT'|'SIMULATED'='ALLOW';
 const send=vi.fn(async():Promise<EmailSendResult>=>({provider:'resend',status:'sent',invoked:true,providerMessageId:'synthetic_acceptance'}));
 const render=vi.fn(()=>({body:'Synthetic notification',html:'<p>Synthetic notification</p>'}));
 const providerConfigured=vi.fn(()=>true);
 const engine=createQueueDispatcher({client:client as unknown as PrismaClient,policy:()=>({decision,reasonCode:'FIXTURE_POLICY'}),send,render,providerConfigured,now:()=>clock,id:()=>`synthetic_${++sequence}`});
 function row(overrides:Record<string,unknown>={}){const r={id:'message_'+(state.rows.length+1),organizationId:'org_aurora',recipient:'recipient@example.invalid',template:'hr-new-application',subject:'Synthetic subject',payload:{},idempotencyKey:'synthetic_idempotency',status:'PENDING',attemptCount:0,version:0n,safetyContractVersion:1,dispatchPhase:'NONE',claimId:null,claimedAt:null,claimExpiresAt:null,dispatchId:null,holdReason:null,heldAt:null,holdPolicyRevision:null,reviewDueAt:null,retentionReviewAt:null,messageExpiresAt:null,providerAcceptedAt:null,provider:null,providerMessageId:null,lastError:null,lastAttemptedAt:null,deliveredAt:null,invitationId:null,resetChallengeId:null,nextAttemptAt:new Date(clock),createdAt:new Date(clock),...overrides};state.rows.push(r);return r;}
 return {engine,state,row,send,render,tx,providerConfigured,setPolicy:(p:typeof decision)=>{decision=p;},advance:(ms:number)=>{clock=new Date(clock.getTime()+ms);}};
}
describe('transactional queue integration with synthetic store and fake providers',()=>{
 it('records ordered boundaries and provider acceptance without claiming mailbox delivery',async()=>{const f=setup();const r=f.row();const result=await f.engine.processBatch();expect(result.delivered).toBe(1);expect(f.send).toHaveBeenCalledTimes(1);expect(r.attemptCount).toBe(1);expect(r.providerAcceptedAt).toBeInstanceOf(Date);expect(f.state.journal.map(e=>e.kind)).toEqual(['CLAIMED','INTENT_RECORDED','RESERVED','INVOCATION_BOUNDARY','PROVIDER_ACCEPTED']);expect(f.state.attempts).toHaveLength(1);});
 for(const decision of ['HOLD','INVALID_RECIPIENT']as const)it('holds '+decision+' with zero provider attempts',async()=>{const f=setup();const r=f.row();f.setPolicy(decision);expect((await f.engine.processBatch()).held).toBe(1);expect(r.status).toBe('HELD');expect(r.attemptCount).toBe(0);expect(f.state.attempts).toHaveLength(0);expect(f.send).not.toHaveBeenCalled();});
 for(const decision of ['CONFIGURATION_BLOCKED','SIMULATED']as const)it('pauses '+decision+' before claiming',async()=>{const f=setup();const r=f.row();f.setPolicy(decision);await f.engine.processBatch();expect(r.status).toBe('PENDING');expect(r.version).toBe(0n);expect(f.send).not.toHaveBeenCalled();});
 it('does not process legacy rows or auto-release HELD',async()=>{const f=setup();f.row({safetyContractVersion:null,dispatchPhase:null});f.row({status:'HELD',holdReason:'INVALID_RECIPIENT'});await f.engine.processBatch();expect(f.send).not.toHaveBeenCalled();});
 it('missing tenant scope cannot dispatch one guessed outbox id',async()=>{const f=setup();f.row();expect((await f.engine.processItem('message_1')).blocked).toBe(1);expect(f.tx.hrEmailOutbox.findFirst).not.toHaveBeenCalled();expect(f.send).not.toHaveBeenCalled();});
 it('cross-tenant selection cannot dispatch',async()=>{const f=setup();f.row();await f.engine.processItem('message_1','org_other');expect(f.send).not.toHaveBeenCalled();});
 it('render failure is held without consuming an attempt',async()=>{const f=setup();const r=f.row();f.render.mockImplementation(()=>{throw Error('invalid template');});await f.engine.processBatch();expect(r.status).toBe('HELD');expect(r.holdReason).toBe('UNSUPPORTED_TEMPLATE');expect(r.attemptCount).toBe(0);expect(f.send).not.toHaveBeenCalled();});
 it('reports a blocked dispatch when the render-failure hold loses its version fence',async()=>{
  const f=setup();
  const r=f.row();
  f.render.mockImplementation(()=>{
   f.tx.hrEmailOutbox.updateMany.mockResolvedValueOnce({count:0});
   throw Error('invalid template');
  });
  const result=await f.engine.processBatch();
  expect(result).toMatchObject({claimed:1,held:0,blocked:1});
  expect(r.status).toBe('PROCESSING');
  expect(r.attemptCount).toBe(0);
  expect(f.state.journal.map(event=>event.kind)).toEqual(['CLAIMED']);
  expect(f.send).not.toHaveBeenCalled();
 });
 it('provider rejection records a single confirmed failure',async()=>{const f=setup();const r=f.row();f.send.mockResolvedValue({provider:'resend',status:'failed',invoked:true,retryable:false});await f.engine.processBatch();expect(r.status).toBe('ABANDONED');expect(r.attemptCount).toBe(1);expect(f.state.journal.at(-1)?.kind).toBe('PROVIDER_FAILED');});
 it('confirmed rate limit is scheduled with backoff, not immediately replayed',async()=>{const f=setup();const r=f.row();f.send.mockResolvedValue({provider:'resend',status:'failed',invoked:true,retryable:true});await f.engine.processBatch();await f.engine.processBatch();expect(r.status).toBe('FAILED');expect(f.send).toHaveBeenCalledTimes(1);});
 it('timeout or thrown provider outcome is HELD and never automatically retried',async()=>{const f=setup();const r=f.row();f.send.mockRejectedValue(Error('synthetic secret body'));await f.engine.processBatch();await f.engine.processBatch();expect(r.status).toBe('HELD');expect(r.holdReason).toBe('PROVIDER_OUTCOME_UNCERTAIN');expect(r.attemptCount).toBe(1);expect(f.send).toHaveBeenCalledTimes(1);expect(JSON.stringify(f.state.audit)).not.toContain('synthetic secret body');});
 it('console simulation is never recorded as delivery',async()=>{const f=setup();const r=f.row();f.send.mockResolvedValue({provider:'console',status:'simulated',invoked:false});await f.engine.processBatch();expect(r.status).toBe('HELD');expect(r.providerAcceptedAt).toBeNull();});
 it('two concurrent callers produce one provider invocation under CAS',async()=>{const f=setup();f.row();await Promise.all([f.engine.processBatch(),f.engine.processBatch()]);expect(f.send).toHaveBeenCalledTimes(1);expect(f.state.journal.filter(e=>e.kind==='INVOCATION_BOUNDARY')).toHaveLength(1);});
 it('expired claim with no intent is audited and can be freshly claimed',async()=>{const f=setup();const r=f.row({status:'PROCESSING',claimId:'expired',claimedAt:new Date('2020-01-01'),claimExpiresAt:new Date('2020-01-02')});await f.engine.processBatch();expect(r.status).toBe('DELIVERED');expect(f.state.audit.some(a=>a.action==='hr.email.queue.recover')).toBe(true);expect(f.send).toHaveBeenCalledTimes(1);});
 for(const phase of ['INTENT','RESERVED'])it('expired '+phase+' stays uncertain without replay',async()=>{const f=setup();const r=f.row({status:'PROCESSING',claimId:'expired',claimExpiresAt:new Date('2020-01-01'),dispatchPhase:phase,dispatchId:'old_dispatch'});await f.engine.processBatch();expect(r.status).toBe('HELD');expect(f.state.attempts).toHaveLength(0);expect(f.send).not.toHaveBeenCalled();});
 it('closes an expired attempted claim and its existing attempt as uncertain',async()=>{
  const f=setup();
  const row=f.row({status:'PROCESSING',claimId:'expired',claimExpiresAt:new Date('2020-01-01'),dispatchPhase:'ATTEMPTED',dispatchId:'old_dispatch',attemptCount:1});
  const attempt={outboxId:row.id,attemptNumber:1,status:'PROCESSING',provider:'resend',providerMessageId:null};
  f.state.attempts.push(attempt);
  await f.engine.processBatch();
  await f.engine.processBatch();
  expect(row).toMatchObject({status:'HELD',holdReason:'PROVIDER_OUTCOME_UNCERTAIN',attemptCount:1,dispatchPhase:'ATTEMPTED',providerAcceptedAt:null,deliveredAt:null,version:1n});
  expect(f.state.attempts).toHaveLength(1);
  expect(attempt).toEqual({outboxId:row.id,attemptNumber:1,status:'PROCESSING',provider:'resend',providerMessageId:null});
  expect(f.tx.hrEmailDeliveryAttempt.updateMany).not.toHaveBeenCalled();
  expect(attempt.providerMessageId).toBeFalsy();
  expect(f.state.journal).toHaveLength(1);
  expect(f.state.journal[0]).toMatchObject({kind:'HELD',reason:'PROVIDER_OUTCOME_UNCERTAIN',auditEventId:f.state.audit[0].id});
  expect(f.send).not.toHaveBeenCalled();
 });
 it('rolls back attempted recovery if the matching processing attempt cannot be closed',async()=>{
  const f=setup();
  f.row({status:'PROCESSING',claimId:'expired',claimExpiresAt:new Date('2020-01-01'),dispatchPhase:'ATTEMPTED',dispatchId:'old_dispatch',attemptCount:1});
  await expect(f.engine.processBatch()).rejects.toThrow();
  expect(f.state.rows[0]).toMatchObject({status:'PROCESSING',claimId:'expired',attemptCount:1,version:0n});
  expect(f.state.audit).toHaveLength(0);
  expect(f.state.journal).toHaveLength(0);
  expect(f.send).not.toHaveBeenCalled();
 });
 it('expired credential is held before rendering or invocation',async()=>{const f=setup();const r=f.row({template:'hr-password-reset',resetChallengeId:'old',messageExpiresAt:new Date('2020-01-01')});await f.engine.processBatch();expect(r.holdReason).toBe('CREDENTIAL_EXPIRED_OR_UNUSABLE');expect(f.render).not.toHaveBeenCalled();expect(f.send).not.toHaveBeenCalled();});
 it('configuration changes after reservation cancel with durable zero-attempt evidence',async()=>{const f=setup();const r=f.row();const original=f.tx.hrEmailDispatchEvent.create.getMockImplementation()!;f.tx.hrEmailDispatchEvent.create.mockImplementation(async args=>{const created=await original(args);if(args.data.kind==='RESERVED')f.setPolicy('HOLD');return created;});await f.engine.processBatch();expect(r.status).toBe('HELD');expect(r.holdReason).toBe('PRE_INVOCATION_CANCELLED');expect(r.attemptCount).toBe(0);expect(f.state.journal.at(-1)?.kind).toBe('RESERVATION_CANCELLED');expect(f.send).not.toHaveBeenCalled();});
 it('post-boundary policy changes preserve uncertainty without a counter refund',async()=>{const f=setup();const r=f.row();const original=f.tx.hrEmailDispatchEvent.create.getMockImplementation()!;f.tx.hrEmailDispatchEvent.create.mockImplementation(async args=>{const created=await original(args);if(args.data.kind==='INVOCATION_BOUNDARY')f.setPolicy('HOLD');return created;});await f.engine.processBatch();expect(r.status).toBe('HELD');expect(r.attemptCount).toBe(1);expect(f.send).not.toHaveBeenCalled();});
 it('credential references cannot cross organizations',async()=>{const f=setup();const r=f.row({template:'hr-account-invitation',invitationId:'invite',messageExpiresAt:new Date('2099-01-01')});await f.engine.processBatch();expect(r.status).toBe('HELD');expect(f.send).not.toHaveBeenCalled();});
});
