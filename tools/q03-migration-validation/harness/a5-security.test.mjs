import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {ROOT,RUN,NEW_MIGRATIONS,executionGate,requireGate} from './config.mjs';
import {readPinnedManifest,assertTarget,validateEndpoint,ENDPOINT,dockerEnvironment,engineArguments} from './target-boundary.mjs';
import {prepareTransportTarget,startLoopbackRelay} from './transport.mjs';
import {createAdapter} from './runtime.mjs';
import {lifecycle,runFinalized,installInterruptionHandlers} from './lifecycle.mjs';
import {HISTORICAL_OUTBOX,HISTORICAL_ATTEMPT,HISTORICAL_AUDIT,NEW_OUTBOX,assertHistoricalPreserved,assertMigrationFailure,assertBlindRetry,assertTransition,assertCatalogEqual,assertSafetyDefinitions,legacyClassificationGaps} from './evidence-rules.mjs';
import {RACE_CASES} from './db-tests.mjs';
import {overlapQueries,runOverlap,assertOverlap} from './concurrency.mjs';
import {legacyFixturesSQL} from './fixtures.mjs';
const gate=()=>executionGate(['--execute','--authorize-run',RUN]);
const pinned=readPinnedManifest();
const endpoint=()=>({Name:'desktop-linux',Endpoints:{docker:{Host:ENDPOINT,SkipTLSVerify:false}}});
function inspection(){
 const c={Id:pinned.ContainerId,Image:pinned.ImageId,State:{Running:true},Config:{Labels:{'zentric.q03.run':RUN},Env:['POSTGRES_DB=q03_disposable','POSTGRES_USER=q03_owner','POSTGRES_PASSWORD=fictional-test-only']},HostConfig:{PortBindings:{}},NetworkSettings:{Networks:{[pinned.NetworkName]:{}}},Mounts:[{Name:pinned.VolumeName,Type:'volume',Destination:'/var/lib/postgresql'}]};
 return {context:endpoint(),c,n:{Id:pinned.NetworkId,Labels:{'zentric.q03.run':RUN},Internal:true,Containers:{[pinned.ContainerId]:{}}},v:{Name:pinned.VolumeName,Labels:{'zentric.q03.run':RUN}}};
}
function inspector(records,calls=[]){return async(args,contextOnly)=>{calls.push({args,contextOnly});if(args[0]==='context')return records.context;if(args[0]==='network')return records.n;if(args[0]==='volume')return records.v;return records.c;};}
test('pinned manifest is immutable and candidate cannot mutate',()=>{assert.ok(Object.isFrozen(pinned));assert.throws(()=>{pinned.ContainerId='alternate';},TypeError);assert.equal(assertTarget(pinned).ContainerId,pinned.ContainerId);});
for(const candidate of [{...pinned},Object.freeze({...pinned,ContainerId:'alternate'}),Object.freeze({...pinned,RunId:'other'}),Object.freeze({...pinned,extra:'override'}),null])test('reject substitution or mutable identity '+String(candidate?.ContainerId),()=>assert.throws(()=>assertTarget(candidate),/NOT_PINNED/));
test('accessor candidate cannot supply resource identity',()=>{const c={...pinned};Object.defineProperty(c,'ContainerId',{get(){throw Error('ACCESSOR_EXECUTED');}});Object.freeze(c);assert.throws(()=>assertTarget(c),/NOT_PINNED/);});
test('forged gate is rejected',()=>assert.throws(()=>requireGate(Object.freeze({run:RUN})),/GATE_REQUIRED/));
for(const host of ['tcp://remote:2375','unix:///var/run/docker.sock','npipe:////./pipe/docker_engine',null])test('reject unexpected endpoint '+host,()=>assert.throws(()=>validateEndpoint({Name:'desktop-linux',Endpoints:{docker:{Host:host,SkipTLSVerify:false}}}),/NOT_APPROVED/));
test('reject unexpected context',()=>assert.throws(()=>validateEndpoint({...endpoint(),Name:'default'}),/NOT_APPROVED/));
test('reject absent endpoint evidence',()=>assert.throws(()=>validateEndpoint(null),/NOT_APPROVED/));
test('engine target is explicit host, not mutable context',()=>assert.deepEqual(engineArguments(['inspect',pinned.ContainerId]),['--host',ENDPOINT,'inspect',pinned.ContainerId]));
test('inherited endpoint and application overrides cannot propagate',()=>{
 const keys=['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_CONFIG','DOCKER_TLS_VERIFY','NODE_OPTIONS','DATABASE_URL'];const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{for(const k of keys)process.env[k]='synthetic-malicious-override';const clean=dockerEnvironment();for(const k of keys)assert.equal(Object.hasOwn(clean,k),false);}
 finally{for(const k of keys)if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];}
});
test('transport performs independent inspection using fixed resource identities',async()=>{const calls=[];const result=await prepareTransportTarget(pinned,gate(),inspector(inspection(),calls));assert.equal(result.containerId,pinned.ContainerId);assert.equal(calls.length,4);assert.equal(calls[0].contextOnly,true);assert.deepEqual(calls[1].args,['inspect',pinned.ContainerId]);});
for(const change of ['container','label','network','volume','running','ports','liveEnv','endpoint'])test('resource boundary fails closed '+change,async()=>{
 const r=inspection();if(change==='container')r.c.Id='other';if(change==='label')r.c.Config.Labels={};if(change==='network')r.n.Internal=false;if(change==='volume')r.v.Name='other';if(change==='running')r.c.State.Running=false;if(change==='ports')r.c.HostConfig.PortBindings={'5432/tcp':[{}]};if(change==='liveEnv')r.c.Config.Env.push('DATABASE_URL=fictional');if(change==='endpoint')r.context.Endpoints.docker.Host='tcp://remote';
 await assert.rejects(prepareTransportTarget(pinned,gate(),inspector(r)),/MISMATCH|UNEXPECTED_LIVE|NOT_APPROVED/);
});
test('revalidation rejects identity drift after earlier validation',async()=>{const r=inspection();await prepareTransportTarget(pinned,gate(),inspector(r));r.c.Config.Labels={};await assert.rejects(prepareTransportTarget(pinned,gate(),inspector(r)),/MISMATCH/);});
test('missing independent inspector is blocked',async()=>assert.rejects(prepareTransportTarget(pinned,gate()),/INSPECTION_REQUIRED/));
test('default transport and adapter refuse uncertified lifecycle without opening anything',async()=>{await assert.rejects(startLoopbackRelay(pinned,gate()),/LIFECYCLE_NOT_CERTIFIED/);await assert.rejects(createAdapter(gate()),/LIFECYCLE_NOT_CERTIFIED/);});
test('evidence write failure still closes relay',async()=>{const calls=[];await assert.rejects(runFinalized({execute:async()=>calls.push('execute'),writeEvidence:async()=>{calls.push('write');throw Error('DISK_FULL');},close:async()=>calls.push('close')}),/DISK_FULL/);assert.deepEqual(calls,['execute','write','close']);});
test('primary error preserved and cleanup/evidence errors sanitized',async()=>{
 const primary=Error('PRIMARY');
 try{await runFinalized({execute:async()=>{throw primary;},writeEvidence:async()=>{throw Error('secret disk');},close:async()=>{throw Error('secret cleanup');},secrets:['secret']});assert.fail('EXPECTED_FAILURE');}
 catch(e){assert.equal(e.cause,primary);assert.equal(e.primary,'PRIMARY');assert.equal(e.message,'PRIMARY');assert.deepEqual(e.secondary.map(x=>x.stage),['evidence','cleanup']);assert.ok(!JSON.stringify(e.secondary).includes('secret'));}
});
for(const failure of ['listener','child','orphan','timeout'])test('cleanup failure is fail-closed '+failure,async()=>{
 const l=lifecycle({timeout:5,listener:{close:async()=>{if(failure==='listener')throw Error('LISTENER_START_FAILED');}}});
 l.child({stop:async()=>{if(failure==='child')throw Error('CHILD_START_FAILED');if(failure==='timeout')await new Promise(()=>{});},verifyStopped:async()=>failure!=='orphan'});
 await assert.rejects(l.close(),/TERMINATION_UNPROVEN/);await assert.rejects(l.close(),/TERMINATION_UNPROVEN/);
});
test('all active mock connections stop and close is idempotent',async()=>{
 let sockets=0,children=0,listener=0,verified=0;const l=lifecycle({listener:{close:async()=>{listener++;}}});
 for(let i=0;i<4;i++){l.socket({destroy(){sockets++;}});l.child({stop:async()=>{children++;},verifyStopped:async()=>{verified++;return true;}});}
 await Promise.all([l.close(),l.close()]);assert.deepEqual([sockets,children,listener,verified],[4,4,1,4]);assert.throws(()=>l.socket({}),/CLOSING/);
});
for(const signal of ['SIGINT','SIGTERM'])test('interruption enters cleanup '+signal,async()=>{const emitter=new EventEmitter();let count=0;const handle=installInterruptionHandlers(emitter,async()=>{count++;});emitter.emit(signal);await Promise.resolve();assert.equal(count,1);assert.throws(()=>handle.assertRunning(),/INTERRUPTED/);handle.remove();assert.equal(emitter.listenerCount(signal),0);});
test('normal finalization returns result and cleans up',async()=>{let closed=false;assert.equal(await runFinalized({execute:async()=>7,writeEvidence:async()=>{},close:async()=>{closed=true;}}),7);assert.equal(closed,true);});
for(const failure of ['LISTENER_START_FAILED','CHILD_START_FAILED'])test('startup failure cleans all already tracked resources '+failure,async()=>{
 let closed=0,stopped=0;const l=lifecycle({listener:{close:async()=>{closed++;}}});
 l.child({stop:async()=>{stopped++;},verifyStopped:async()=>true});
 await assert.rejects(runFinalized({execute:async()=>{throw Error(failure);},writeEvidence:async()=>{},close:()=>l.close()}),new RegExp(failure));
 assert.deepEqual([closed,stopped],[1,1]);
});
test('socket-close error still attempts all child and listener cleanup',async()=>{let stopped=0;const l=lifecycle({listener:{close:async()=>{stopped++;}}});l.socket({destroy(){throw Error('SOCKET_ERROR');}});l.child({stop:async()=>{stopped++;},verifyStopped:async()=>true});await assert.rejects(l.close(),/SOCKET_CLOSE_FAILED/);assert.equal(stopped,2);});
test('strict guard blocks real process, socket, listener, DNS and HTTP boundaries',async()=>{
 const cp=await import('node:child_process'),net=await import('node:net'),dns=await import('node:dns'),http=await import('node:http');
 for(const call of [()=>cp.spawn('must-not-run'),()=>net.connect(1,'127.0.0.1'),()=>net.createServer().listen(0),()=>dns.lookup('must-not-resolve.invalid'),()=>http.get('http://must-not-contact.invalid')])assert.throws(call,/OFFLINE_VALIDATION_FORBIDDEN_API/);
});
const fields={outbox:HISTORICAL_OUTBOX,attempts:HISTORICAL_ATTEMPT,audit:HISTORICAL_AUDIT};
function snapshot(){return Object.fromEntries(Object.entries(fields).map(([name,keys])=>[name,Array.from({length:name==='outbox'?5:name==='attempts'?10:2},(_,i)=>Object.fromEntries(keys.map(k=>[k,`${name}-${i}-${k}`])))]));}
test('complete historical snapshot passes without normalization',()=>{const s=snapshot();assertHistoricalPreserved(s,structuredClone(s));});
for(const [section,keys] of Object.entries(fields))for(const field of keys)test(`historical mutation rejected ${section}.${field}`,()=>{const before=snapshot(),after=structuredClone(before);after[section][0][field]='MUTATED';assert.throws(()=>assertHistoricalPreserved(before,after),/HISTORICAL_VALUE_CHANGED/);});
test('missing historical column rejected',()=>{const before=snapshot(),after=structuredClone(before);delete after.outbox[0].lastError;assert.throws(()=>assertHistoricalPreserved(before,after),/HISTORICAL_FIELDS/);});
test('row removal rejected',()=>{const before=snapshot(),after=structuredClone(before);after.attempts.pop();assert.throws(()=>assertHistoricalPreserved(before,after),/ROW_COUNT/);});
test('historical inventory matches original CREATE TABLE columns',()=>{
 const sql=fs.readFileSync(path.join(ROOT,'inputs/prisma/migrations/20260729000000_hrms_secure_foundation/migration.sql'),'utf8');
 for(const [table,expected]of [['HrEmailOutbox',HISTORICAL_OUTBOX],['HrEmailDeliveryAttempt',HISTORICAL_ATTEMPT],['HrAuditEvent',HISTORICAL_AUDIT]]){
  const body=sql.match(new RegExp('CREATE TABLE "'+table+'" \\(([\\s\\S]*?)\\n\\);'))?.[1];assert.ok(body);assert.deepEqual([...body.matchAll(/^\s*"([^"]+)"\s/gm)].map(m=>m[1]).sort(),[...expected].sort());
 }
});
test('expanded fixtures supply every outbox/attempt field explicitly',()=>{const sql=legacyFixturesSQL();for(const f of [...HISTORICAL_OUTBOX,...HISTORICAL_ATTEMPT])assert.ok(sql.includes('"'+f+'"'),f);assert.equal((sql.match(/INSERT INTO "HrEmailDeliveryAttempt"/g)||[]).length,10);});
test('new columns are an explicit separate inventory',()=>{assert.equal(NEW_OUTBOX.length,16);assert.ok(!NEW_OUTBOX.some(x=>HISTORICAL_OUTBOX.includes(x)));});
test('legacy classification omissions are reported, not silently fixed',()=>{
 const sql=fs.readFileSync(path.join(ROOT,'inputs/prisma/migrations',NEW_MIGRATIONS[1],'migration.sql'),'utf8');
 assert.deepEqual(legacyClassificationGaps(sql),['id','subject','status','nextAttemptAt','lastAttemptedAt','lastError','provider','providerMessageId','createdAt','deliveredAt']);
});
test('prepared races include both cancellation winners and interruption',()=>{
 assert.deepEqual(RACE_CASES.map(x=>x[0]),['claim','cancel_reservation','reservation_cancel','cancel_invocation','invocation_cancel','two_reservations','interrupted_lock']);assert.ok(RACE_CASES.every(Object.isFrozen));
});
const names=['historical',...NEW_MIGRATIONS];const ledger=()=>names.map(name=>({name,finished:name!==NEW_MIGRATIONS[1],rolledBack:false}));
const failure=()=>({code:1,stderr:`P3018 22012 ${NEW_MIGRATIONS[1]}`,stdout:''});
test('expected failed migration requires error, ledger and rollback evidence',()=>assertMigrationFailure(failure(),ledger(),names,{tables:[]},{tables:[]}));
for(const change of ['unrelated','success','wrongReason','ledger','partialRollback'])test('failure false positive rejected '+change,()=>{
 const f=failure(),l=ledger();let after={tables:[]};if(change==='unrelated')f.stderr='OTHER_COMMAND_FAILURE';if(change==='success')f.code=0;if(change==='wrongReason')f.stderr=`P3018 23505 ${NEW_MIGRATIONS[1]}`;if(change==='ledger')l[2].finished=true;if(change==='partialRollback')after={tables:['partial']};assert.throws(()=>assertMigrationFailure(f,l,names,{tables:[]},after));
});
test('blind retry requires P3009 and same ledger',()=>assertBlindRetry({code:1,stderr:`P3009 ${NEW_MIGRATIONS[1]}`,stdout:''},ledger(),ledger()));
for(const change of ['error','success','ledger'])test('blind retry false positive rejected '+change,()=>{const f={code:1,stderr:`P3009 ${NEW_MIGRATIONS[1]}`,stdout:''},after=ledger();if(change==='error')f.stderr='NETWORK_ERROR';if(change==='success')f.code=0;if(change==='ledger')after[2].rolledBack=true;assert.throws(()=>assertBlindRetry(f,ledger(),after));});
test('skipped recovery transition fails',()=>assert.throws(()=>assertTransition({version:0},{version:0,status:'HELD'},{status:'HELD'}),/SKIPPED/));
test('incorrect recovery outcome fails',()=>assert.throws(()=>assertTransition({version:0},{version:1,status:'PROCESSING'},{status:'HELD'}),/TRANSITION_FIELD/));
test('definition mismatch fails even if object counts match',()=>assert.throws(()=>assertCatalogEqual({constraints:[{name:'x',definition:'CHECK(a>0)'}]},{constraints:[{name:'x',definition:'CHECK(a>=0)'}]}),/DEFINITION_MISMATCH/));
test('missing SQL-only protections fails',()=>assert.throws(()=>assertSafetyDefinitions({constraints:[],indexes:[],triggers:[],functions:[]},'ALTER TABLE x ADD CONSTRAINT "required" CHECK (true);'),/MISSING_CONSTRAINT/));
test('overlap query requires observed three-session blocking chain',()=>{const q=overlapQueries('test_race','SELECT 1;','SELECT 2;');assert.ok(q.control.includes('pg_blocking_pids'));assert.ok(q.control.includes('Q03_OVERLAP_NOT_OBSERVED'));assert.ok(q.control.includes('clock_timestamp()'));assert.ok(q.leader.includes("lock_timeout='12s'"));assert.ok(q.leaderVisible.includes('pg_blocking_pids'));});
for(const proof of [null,{q03Overlap:true,chain:false,controller:1,leader:2,follower:3},{q03Overlap:true,chain:true,controller:1,leader:1,follower:3},{q03Overlap:true,chain:true,controller:1,leader:2}])test('missing/sequential overlap proof rejected '+JSON.stringify(proof),()=>assert.throws(()=>assertOverlap(proof)));
test('simulated transaction ordering requires controller then leader barriers',async()=>{
 const q=overlapQueries('mock_race','SELECT 1;','SELECT 2;');const calls=[];let releaseController,releaseLeader;
 const db={sql:async text=>{calls.push(text);if(text===q.control)return new Promise(r=>{releaseController=r;});if(text===q.visible)return't';if(text===q.leaderVisible)return't';if(text===q.leader)return new Promise(r=>{releaseLeader=r;});if(text===q.follower){releaseController(JSON.stringify({q03Overlap:true,chain:true,controller:1,leader:2,follower:3}));releaseLeader('{"affected":1}');return'{"affected":0}';}throw Error('UNEXPECTED_SQL');}};
 const result=await runOverlap(db,q);assert.deepEqual(calls,[q.control,q.visible,q.leader,q.leaderVisible,q.follower]);assert.deepEqual([result.leader,result.follower],[1,0]);
});
test('sequential operations cannot pass the overlap oracle',async()=>{
 const q=overlapQueries('mock_sequential','SELECT 1;','SELECT 2;');
 const db={sql:async text=>text===q.control?JSON.stringify({q03Overlap:true,chain:false,controller:1,leader:2,follower:3}):text===q.visible||text===q.leaderVisible?'t':'{"affected":1}'};
 await assert.rejects(runOverlap(db,q),/NO_BLOCKING_CHAIN/);
});
test('missing controller evidence fails before any mutation session',async()=>{const q=overlapQueries('no_controller','SELECT 1;','SELECT 2;');let mutations=0;const db={sql:async text=>{if(text===q.control)return'controller failed';if(text===q.visible)return'f';mutations++;return'';}};await assert.rejects(runOverlap(db,q,{pollLimit:2,delay:async()=>{}}),/CONTROLLER_LOCK_NOT_OBSERVED/);assert.equal(mutations,0);});
test('missing leader lock evidence prevents follower execution',async()=>{const q=overlapQueries('no_leader','SELECT 1;','SELECT 2;');let followerStarted=false;const db={sql:async text=>{if(text===q.control)return'failed';if(text===q.visible)return't';if(text===q.leaderVisible)return'f';if(text===q.follower)followerStarted=true;return'{"affected":0}';}};await assert.rejects(runOverlap(db,q,{pollLimit:2,delay:async()=>{}}),/LEADER_LOCK_NOT_OBSERVED/);assert.equal(followerStarted,false);});
test('simulated interruption must prove cancellation cause',async()=>{
 const q=overlapQueries('mock_interrupt','SELECT 1;','SELECT 2;',{interrupt:true});const proof=JSON.stringify({q03Overlap:true,chain:true,controller:1,leader:2,follower:3});
 function mock(message){return{sql:async text=>{if(text===q.control)return proof;if(text===q.visible||text===q.leaderVisible)return't';if(text===q.leader)throw Error(message);return'{"affected":1}';}};}
 const r=await runOverlap(mock('canceling statement due to user request'),q);assert.equal(r.follower,1);
 await assert.rejects(runOverlap(mock('unrelated failure'),q),/WRONG_INTERRUPTION/);
});
test('before evidence records original vulnerabilities without executing them',()=>{
 const old=fs.readFileSync(path.join(ROOT,'a5-evidence/transport.mjs.before'),'utf8');assert.ok(old.includes("'--context','desktop-linux','exec','-i',m.ContainerId"));
 const previous=fs.readFileSync(path.join(ROOT,'a5-evidence/run-q03b.mjs.before'),'utf8');assert.ok(previous.indexOf("fs.writeFileSync(path.join(ROOT,'evidence/result.json')")<previous.indexOf('await adapter.close()'));
 const current=fs.readFileSync(path.join(ROOT,'transport.mjs'),'utf8');assert.ok(!current.includes('spawn('));assert.ok(!current.includes('createServer('));
});
