import assert from 'node:assert/strict';
import {queue,processing,held,journal,insert,id,literal} from './fixtures.mjs';
import {overlapQueries,runOverlap} from './concurrency.mjs';
import {assertTransition} from './evidence-rules.mjs';
/** SQL is only passed to an explicitly authorized adapter by future run-q03b. */
export async function runDatabaseTests(db){
 const results=[];
 async function test(name,fn){await fn();results.push({name,status:'PASS'});}
 async function rejectSQL(name,sql,code){await test(name,async()=>{
  // Nested exception block rolls back the failed operation; outer rollback removes fixtures.
  const statements=sql.split(';').map(s=>s.trim()).filter(Boolean);
  const target=statements.pop();
  const statement=`BEGIN; ${statements.join(';')}${statements.length?';':''} DO $q03$ BEGIN BEGIN ${target}; RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='Expected rejection did not occur'; EXCEPTION WHEN SQLSTATE '${code}' THEN NULL; END; END $q03$; ROLLBACK;`;
  await db.sql(statement);
 });}
 async function transaction(sql){return db.sql(`BEGIN; ${sql} ROLLBACK;`);}
 await test('valid new-contract states and phases',()=>transaction([
  insert('HrEmailOutbox',queue('new_pending')),
  insert('HrEmailOutbox',queue('new_failed',{status:'FAILED',attemptCount:1})),
  insert('HrEmailOutbox',held('new_held')),
  ...['NONE','INTENT','RESERVED','ATTEMPTED'].map(phase=>insert('HrEmailOutbox',processing(`new_${phase}`,phase))),
 ].join('\n')));
 for(const [name,override] of [
  ['missing-phase',{dispatchPhase:null}],['pending-intent',{dispatchPhase:'INTENT',dispatchId:id('bad_phase')}],
  ['orphan-claim',{claimId:id('orphan')}],['missing-lease',{status:'PROCESSING',claimId:id('claim')}],
  ['held-missing-reason',{status:'HELD'}],['held-empty-revision',{status:'HELD',holdReason:'INVALID_RECIPIENT',heldAt:'2030-01-01',holdPolicyRevision:''}],
  ['attempted-zero-counter',{...processing('ignored','ATTEMPTED'),attemptCount:0}],
  ['invalid-cancellation-phase',{...held('ignored'),holdReason:'PRE_INVOCATION_CANCELLED'}],
 ])await rejectSQL(name,insert('HrEmailOutbox',queue(`bad_${name.replaceAll('-','_')}`,override)),'23514');
 await rejectSQL('cross-tenant invitation',insert('HrEmailOutbox',queue('bad_invite',{template:'hr-account-invitation',invitationId:id('invite_cobalt_valid'),messageExpiresAt:'2099-01-01'})),'P0001');
 await rejectSQL('cross-tenant reset',insert('HrEmailOutbox',queue('bad_reset',{template:'hr-password-reset',resetChallengeId:id('reset_cobalt_valid'),messageExpiresAt:'2099-01-01'})),'P0001');
 await rejectSQL('missing credential FK',insert('HrEmailOutbox',queue('missing_ref',{template:'hr-account-invitation',invitationId:id('does_not_exist'),messageExpiresAt:'2099-01-01'})),'P0001');
 const jrow=held('journal_target');
 const event=journal('journal_event',jrow,'HELD',{reason:'INVALID_RECIPIENT',policyRevision:'q03-fixture'});
 await rejectSQL('cross-tenant journal',insert('HrEmailOutbox',jrow)+insert('HrEmailDispatchEvent',{...event,organizationId:id('org_cobalt')}),'23503');
 await rejectSQL('cross-tenant actor',insert('HrEmailOutbox',jrow)+insert('HrEmailDispatchEvent',{...event,actorUserId:id('user_cobalt')}),'P0001');
 await rejectSQL('cross-tenant audit',insert('HrEmailOutbox',jrow)+insert('HrEmailDispatchEvent',{...event,auditEventId:id('audit_cobalt')}),'P0001');
 for(const [name,sql]of [['update','UPDATE "HrEmailDispatchEvent" SET "recordedAt"=CURRENT_TIMESTAMP;'],['delete','DELETE FROM "HrEmailDispatchEvent";'],['truncate','TRUNCATE TABLE "HrEmailDispatchEvent";']]){
  await rejectSQL(`journal ${name} rejected`,insert('HrEmailOutbox',jrow)+insert('HrEmailDispatchEvent',event)+sql,'P0001');
 }
 await rejectSQL('duplicate idempotency',insert('HrEmailOutbox',queue('idem_one'))+insert('HrEmailOutbox',queue('idem_two',{idempotencyKey:id('idem_idem_one')})),'23505');
 await rejectSQL('held direct processing',insert('HrEmailOutbox',jrow)+`UPDATE "HrEmailOutbox" SET status='PROCESSING',version=1,"claimId"='x',"claimedAt"=CURRENT_TIMESTAMP,"claimExpiresAt"=CURRENT_TIMESTAMP+interval '1 minute',"holdReason"=NULL,"heldAt"=NULL,"holdPolicyRevision"=NULL WHERE id=${literal(jrow.id)};`,'P0001');
 const reservation=processing('counter_reservation','RESERVED');
 await test('reservation and invocation counter accuracy',async()=>{
  const sql=insert('HrEmailOutbox',reservation)+`UPDATE "HrEmailOutbox" SET version=1,"dispatchPhase"='ATTEMPTED',"attemptCount"=1 WHERE id=${literal(reservation.id)};
   SELECT "attemptCount" FROM "HrEmailOutbox" WHERE id=${literal(reservation.id)};`;
  assert.equal((await transaction(sql)).trim(),'1');
 });
 const intent=processing('counter_intent','INTENT');
 await rejectSQL('counter increment before invocation',insert('HrEmailOutbox',intent)+`UPDATE "HrEmailOutbox" SET version=1,"attemptCount"=1 WHERE id=${literal(intent.id)};`,'P0001');
 await rejectSQL('counter refund',insert('HrEmailOutbox',processing('counter_refund','ATTEMPTED'))+`UPDATE "HrEmailOutbox" SET version=1,"attemptCount"=0 WHERE id=${literal(id('counter_refund'))};`,'P0001');
 const accepted=queue('accepted',{status:'DELIVERED',dispatchPhase:'ATTEMPTED',dispatchId:id('accepted_dispatch'),attemptCount:1,provider:'resend',providerAcceptedAt:'2030-01-01'});
 await test('provider acceptance shape accepted, not mailbox proof',()=>transaction(insert('HrEmailOutbox',accepted)));
 await rejectSQL('console success cannot be accepted',insert('HrEmailOutbox',{...accepted,id:id('console_acceptance'),provider:'console'}),'23514');
 await rejectSQL('missing acceptance timestamp',insert('HrEmailOutbox',{...accepted,id:id('no_acceptance'),providerAcceptedAt:null}),'23514');
 for(const phase of ['INTENT','RESERVED','ATTEMPTED'])await test(`uncertainty held at ${phase}`,()=>transaction(insert('HrEmailOutbox',held(`uncertain_${phase}`,{dispatchPhase:phase,dispatchId:id(`uncertain_dispatch_${phase}`),attemptCount:phase==='ATTEMPTED'?1:0,holdReason:'PROVIDER_OUTCOME_UNCERTAIN'}))));
 await test('ordinary claim predicates exclude HELD',async()=>{
  assert.equal((await transaction(insert('HrEmailOutbox',held('exclude_held'))+`SELECT count(*) FROM "HrEmailOutbox" WHERE id=${literal(id('exclude_held'))} AND status IN ('PENDING','FAILED');`)).trim(),'0');
 });
 for(const [name,version,owner,expires] of [['stale_version',999,null,'2099-01-01'],['wrong_owner',0,'wrong','2099-01-01'],['expired_lease',0,null,'2000-01-01']])await test(name+' independently fences invocation',async()=>{
  const row=processing(name,'RESERVED',{claimedAt:'1999-01-01',claimExpiresAt:expires});
  const sql=insert('HrEmailOutbox',row)+`WITH changed AS (UPDATE "HrEmailOutbox" SET version=1,"dispatchPhase"='ATTEMPTED',"attemptCount"=1 WHERE id=${literal(row.id)} AND version=${version} AND "claimId"=${literal(owner??row.claimId)} AND "claimExpiresAt">CURRENT_TIMESTAMP RETURNING id) SELECT count(*) FROM changed; SELECT json_build_object('version',version,'attemptCount',"attemptCount",'phase',"dispatchPhase") FROM "HrEmailOutbox" WHERE id=${literal(row.id)};`;
  const output=(await transaction(sql)).trim().split(/\r?\n/);assert.equal(output[0],'0');assert.deepEqual(JSON.parse(output[1]),{version:0,attemptCount:0,phase:'RESERVED'});
 });
 // Expiry itself is NOT a SQL CHECK. Demonstrate structural FK validity, then
 // separately assert current credential state through the harness snapshot oracle.
 for(const kind of ['expired','used','revoked','superseded'])await test(`credential ${kind} requires trusted runtime refusal`,async()=>{
  const row=queue(`credential_${kind}`,{template:'hr-account-invitation',invitationId:id(`invite_aurora_${kind}`),messageExpiresAt:'2099-01-01'});
  await transaction(insert('HrEmailOutbox',row));
  assert.equal((await db.sql(`SELECT count(*) FROM "HrAccountInvitation" WHERE id=${literal(row.invitationId)} AND status='ACTIVE' AND "usedAt" IS NULL AND "expiresAt">CURRENT_TIMESTAMP;`)).trim(),'0');
  assert.equal((await db.sql(`SELECT count(*) FROM "HrPasswordResetChallenge" WHERE id=${literal(id(`reset_aurora_${kind}`))} AND status='ACTIVE' AND "usedAt" IS NULL AND "expiresAt">CURRENT_TIMESTAMP;`)).trim(),'0');
 });
 await test('new dispatch cycle permits legitimate retry history',async()=>{
  const row=processing('retry_cycles','RESERVED');
  const sql=insert('HrEmailOutbox',row)
   +`UPDATE "HrEmailOutbox" SET version=1,"dispatchPhase"='ATTEMPTED',"attemptCount"=1 WHERE id=${literal(row.id)};`
   +insert('HrEmailDispatchEvent',journal('cycle_a_boundary',row,'INVOCATION_BOUNDARY',{transitionVersion:1,policyRevision:'q03-policy'}))
   +`UPDATE "HrEmailOutbox" SET version=2,status='FAILED',"dispatchPhase"='NONE',"dispatchId"=NULL,"claimId"=NULL,"claimedAt"=NULL,"claimExpiresAt"=NULL WHERE id=${literal(row.id)};`
   +insert('HrEmailDispatchEvent',journal('cycle_a_fail',row,'PROVIDER_FAILED',{transitionVersion:2}))
   +`UPDATE "HrEmailOutbox" SET version=3,status='PROCESSING',"claimId"=${literal(id('retry_claim'))},"claimedAt"=CURRENT_TIMESTAMP,"claimExpiresAt"=CURRENT_TIMESTAMP+interval '5 minutes' WHERE id=${literal(row.id)};`
   +insert('HrEmailDispatchEvent',journal('cycle_b_claim',{...row,claimId:id('retry_claim'),dispatchId:null},'CLAIMED',{transitionVersion:3}))
   +`UPDATE "HrEmailOutbox" SET version=4,"dispatchPhase"='INTENT',"dispatchId"=${literal(id('retry_dispatch_b'))} WHERE id=${literal(row.id)};`
   +insert('HrEmailDispatchEvent',journal('cycle_b_intent',{...row,claimId:id('retry_claim'),dispatchId:id('retry_dispatch_b')},'INTENT_RECORDED',{transitionVersion:4}))
   +`UPDATE "HrEmailOutbox" SET version=5,"dispatchPhase"='RESERVED' WHERE id=${literal(row.id)};`
   +insert('HrEmailDispatchEvent',journal('cycle_b_reserved',{...row,claimId:id('retry_claim'),dispatchId:id('retry_dispatch_b')},'RESERVED',{transitionVersion:5}))
   +`UPDATE "HrEmailOutbox" SET version=6,"dispatchPhase"='ATTEMPTED',"attemptCount"=2 WHERE id=${literal(row.id)};`
   +insert('HrEmailDispatchEvent',journal('cycle_b_boundary',{...row,claimId:id('retry_claim'),dispatchId:id('retry_dispatch_b')},'INVOCATION_BOUNDARY',{transitionVersion:6,policyRevision:'q03-policy'}))
   +`UPDATE "HrEmailOutbox" SET version=7,status='FAILED',"dispatchPhase"='NONE',"dispatchId"=NULL,"claimId"=NULL,"claimedAt"=NULL,"claimExpiresAt"=NULL WHERE id=${literal(row.id)};`
   +insert('HrEmailDispatchEvent',journal('cycle_b_fail',{...row,dispatchId:id('retry_dispatch_b')},'PROVIDER_FAILED',{transitionVersion:7}))
   +`SELECT json_build_object('version',o.version,'counter',o."attemptCount",'status',o.status,'journalVersions',(SELECT json_agg("transitionVersion" ORDER BY "transitionVersion") FROM "HrEmailDispatchEvent" WHERE "outboxId"=o.id),'dispatches',(SELECT count(DISTINCT "dispatchId") FROM "HrEmailDispatchEvent" WHERE "outboxId"=o.id)) FROM "HrEmailOutbox" o WHERE o.id=${literal(row.id)};`;
  assert.deepEqual(JSON.parse((await transaction(sql)).trim()),{version:7,counter:2,status:'FAILED',journalVersions:[1,2,3,4,5,6,7],dispatches:2});
 });
 await rejectSQL('same-cycle duplicate boundary rejected',insert('HrEmailOutbox',reservation)
  +insert('HrEmailDispatchEvent',journal('boundary_a',reservation,'RESERVED'))
  +insert('HrEmailDispatchEvent',journal('boundary_b',reservation,'RESERVED',{transitionVersion:2})),'23505');
 await rejectSQL('restrictive journal parent deletion',insert('HrEmailOutbox',jrow)+insert('HrEmailDispatchEvent',event)+`DELETE FROM "HrEmailOutbox" WHERE id=${literal(jrow.id)};`,'23503');
 await rejectSQL('global dispatch ID uniqueness across messages',insert('HrEmailOutbox',reservation)+insert('HrEmailOutbox',processing('other_dispatch','INTENT',{dispatchId:reservation.dispatchId})),'23505');
 for(const [table,key] of [['HrAccountInvitation','invitationId'],['HrPasswordResetChallenge','resetChallengeId']]){
  const ref=id(key==='invitationId'?'invite_aurora_valid':'reset_aurora_valid');
  const row=queue(`restrict_${key}`,{template:key==='invitationId'?'hr-account-invitation':'hr-password-reset',[key]:ref,messageExpiresAt:'2099-01-01'});
  await rejectSQL(`referenced ${table} cannot be deleted`,insert('HrEmailOutbox',row)+`DELETE FROM "${table}" WHERE id=${literal(ref)};`,'23503');
 }
 for(const phase of ['INTENT','RESERVED','ATTEMPTED'])await test(`actual uncertain recovery transition ${phase}`,async()=>{
  const row=processing(`recover_${phase}`,phase);const sql=insert('HrEmailOutbox',row)
   +`UPDATE "HrEmailOutbox" SET status='HELD',version=1,"holdReason"='PROVIDER_OUTCOME_UNCERTAIN',"heldAt"=CURRENT_TIMESTAMP,"holdPolicyRevision"='q03-policy',"claimId"=NULL,"claimedAt"=NULL,"claimExpiresAt"=NULL WHERE id=${literal(row.id)} AND version=0 AND "claimId"=${literal(row.claimId)};`
   +insert('HrEmailDispatchEvent',journal(`recovery_event_${phase}`,row,'OUTCOME_UNCERTAIN',{transitionVersion:1,reason:'PROVIDER_OUTCOME_UNCERTAIN',policyRevision:'q03-policy'}))
   +`SELECT json_build_object('version',version,'status',status,'phase',"dispatchPhase",'counter',"attemptCount",'claim',"claimId") FROM "HrEmailOutbox" WHERE id=${literal(row.id)};`;
  assertTransition({version:0},JSON.parse((await transaction(sql)).trim()),{status:'HELD',phase,counter:row.attemptCount,claim:null});
 });
 await test('legacy pending classification preserves every historical value',async()=>{
  const row=queue('classify_legacy',{recipient:'classify@example.invalid',provider:'console',lastError:'historical',createdAt:'2020-01-01',nextAttemptAt:'2030-01-01'});delete row.safetyContractVersion;delete row.dispatchPhase;delete row.version;
  const sql=insert('HrEmailOutbox',row)+`CREATE TEMP TABLE q03_before ON COMMIT DROP AS SELECT row_to_json(o)::jsonb AS value FROM "HrEmailOutbox" o WHERE id=${literal(row.id)};
   UPDATE "HrEmailOutbox" SET "safetyContractVersion"=1,"dispatchPhase"='NONE' WHERE id=${literal(row.id)};
   SELECT (to_jsonb(o)-ARRAY['safetyContractVersion','dispatchPhase'])=(b.value-ARRAY['safetyContractVersion','dispatchPhase']) FROM "HrEmailOutbox" o CROSS JOIN q03_before b WHERE o.id=${literal(row.id)};`;
  assert.equal((await transaction(sql)).trim(),'t');
 });
 for(const [kind,statement] of [['update','UPDATE "HrEmailDeliveryAttempt" SET "safeError"=\'changed\''],['delete','DELETE FROM "HrEmailDeliveryAttempt"']])await rejectSQL(`historical attempt ${kind} rejected`,`${statement} WHERE id=${literal(id('legacy_attempt_1_1'))};`,'P0001');
 const terminal=queue('terminal_abandoned',{status:'ABANDONED'});
 await rejectSQL('terminal transition rejected',insert('HrEmailOutbox',terminal)+`UPDATE "HrEmailOutbox" SET version=1,status='PENDING' WHERE id=${literal(terminal.id)};`,'P0001');
 const downgrade=queue('downgrade');await rejectSQL('contract downgrade rejected',insert('HrEmailOutbox',downgrade)+`UPDATE "HrEmailOutbox" SET version=1,"safetyContractVersion"=NULL WHERE id=${literal(downgrade.id)};`,'P0001');
 await rejectSQL('review cannot precede hold',insert('HrEmailOutbox',held('review_in_past',{reviewDueAt:'2000-01-01'})),'23514');
 await test('legitimate scheduling update remains permitted',async()=>{
  const row=queue('schedule_update');const output=await transaction(insert('HrEmailOutbox',row)+`UPDATE "HrEmailOutbox" SET version=1,"nextAttemptAt"='2031-01-01',"lastError"='Q03 reviewed retry' WHERE id=${literal(row.id)}; SELECT json_build_object('version',version,'counter',"attemptCount",'status',status,'error',"lastError") FROM "HrEmailOutbox" WHERE id=${literal(row.id)};`);
  assert.deepEqual(JSON.parse(output.trim()),{version:1,counter:0,status:'PENDING',error:'Q03 reviewed retry'});
 });
 return results;
}

export const RACE_CASES=Object.freeze([['claim',null,'CLAIMED','CLAIMED'],['cancel_reservation','INTENT','HELD','RESERVED'],['reservation_cancel','INTENT','RESERVED','HELD'],['cancel_invocation','RESERVED','RESERVATION_CANCELLED','INVOCATION_BOUNDARY'],['invocation_cancel','RESERVED','INVOCATION_BOUNDARY','RESERVATION_CANCELLED'],['two_reservations','INTENT','RESERVED','RESERVED'],['interrupted_lock',null,'CLAIMED','CLAIMED']].map(Object.freeze));
export async function runConcurrencyTests(db){
 const results=[];
 for(const [name,phase,left,right] of RACE_CASES){
  const row=phase?processing(`overlap_${name}`,phase):queue(`overlap_${name}`);await db.sql(insert('HrEmailOutbox',row));
  function operation(kind,side){
   const condition=`id=${literal(row.id)} AND version=0 AND status='${phase?'PROCESSING':'PENDING'}'`+(phase?` AND "claimId"=${literal(row.claimId)} AND "claimExpiresAt">CURRENT_TIMESTAMP AND "dispatchPhase"='${phase}'`:'');
   const owner=phase?row.claimId:id(`overlap_owner_${side}_${name}`);
   let update;
   if(kind==='CLAIMED')update=`status='PROCESSING',"claimId"=${literal(owner)},"claimedAt"=CURRENT_TIMESTAMP,"claimExpiresAt"=CURRENT_TIMESTAMP+interval '5 minutes'`;
   else if(kind==='RESERVED')update=`"dispatchPhase"='RESERVED'`;
   else if(kind==='INVOCATION_BOUNDARY')update=`"dispatchPhase"='ATTEMPTED',"attemptCount"="attemptCount"+1`;
   else update=`status='HELD',"holdReason"='${kind==='RESERVATION_CANCELLED'?'PRE_INVOCATION_CANCELLED':'STAGING_RECIPIENT_NOT_ALLOWLISTED'}',"heldAt"=CURRENT_TIMESTAMP,"holdPolicyRevision"='q03-policy',"claimId"=NULL,"claimedAt"=NULL,"claimExpiresAt"=NULL`;
   const reason=kind==='RESERVATION_CANCELLED'?"'PRE_INVOCATION_CANCELLED'":kind==='HELD'?"'STAGING_RECIPIENT_NOT_ALLOWLISTED'":'NULL';
   return `WITH changed AS (UPDATE "HrEmailOutbox" SET version=1,${update} WHERE ${condition} RETURNING *), receipt AS (INSERT INTO "HrEmailDispatchEvent" (id,"outboxId","organizationId",kind,"dispatchId","transitionVersion","claimId",reason,"policyRevision") SELECT ${literal(id(`overlap_event_${name}_${side}`))},id,"organizationId",'${kind}',"dispatchId",version,${literal(owner)},${reason}::"HrEmailHoldReason",'q03-policy' FROM changed RETURNING id) SELECT json_build_object('affected',count(*)) FROM receipt;`;
  }
  const result=await runOverlap(db,overlapQueries(name,operation(left,'a'),operation(right,'b'),{interrupt:name==='interrupted_lock'}));
  if(name==='interrupted_lock')assert.equal(result.follower,1);else assert.deepEqual([result.leader,result.follower],[1,0]);
  const observed=JSON.parse((await db.sql(`SELECT json_build_object('version',version,'counter',"attemptCount",'events',(SELECT count(*) FROM "HrEmailDispatchEvent" WHERE "outboxId"=o.id),'eventVersion',(SELECT max("transitionVersion") FROM "HrEmailDispatchEvent" WHERE "outboxId"=o.id)) FROM "HrEmailOutbox" o WHERE id=${literal(row.id)};`)).trim());
  assert.deepEqual(observed,{version:1,counter:left==='INVOCATION_BOUNDARY'?1:0,events:1,eventVersion:1});
  results.push({name,proof:result.proof,status:'PASS',scope:'synchronized synthetic SQL transactions; not production Q04 worker evidence'});
 }
 return results;
}
