import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import childProcess from 'node:child_process';
import {ROOT,RUN,PREFIX,DATABASES,executionGate,assertDatabase,verifyInputs,assertIdentity,sanitize,TEST_SCOPE} from './config.mjs';
import {offlinePlan,main} from './run-q03b.mjs';
import {baseFixturesSQL,legacyFixturesSQL,processing,held,journal,insert,id,COVERAGE} from './fixtures.mjs';
test('all 72 source snapshots match hashes',()=>assert.equal(verifyInputs(),72));
test('default mode never authorizes execution',()=>assert.equal(offlinePlan().executionAuthorizedByThisUnit,false));
for(const args of [[],['--execute'],['--execute','--authorize-run','other'],['--execute','--authorize-run',RUN,'extra']])test(`reject unsafe execution arguments ${args.length}`,()=>assert.throws(()=>executionGate(args),/AUTHORIZATION_REQUIRED/));
test('execution flag is run-specific safeguard only',()=>assert.equal(executionGate(['--execute','--authorize-run',RUN]).run,RUN));
for(const db of Object.values(DATABASES))test(`only declared disposable database ${db}`,()=>assert.equal(assertDatabase(db),db));
for(const db of ['postgres','q03_disposable','production','staging','localhost','q03_other'])test(`reject unowned database ${db}`,()=>assert.throws(()=>assertDatabase(db),/NOT_ALLOWLISTED/));
test('fixtures are fictional with deterministic prefix',()=>{
 const sql=baseFixturesSQL();assert.equal(sql,baseFixturesSQL());assert.ok(sql.includes('Q03 Fictional'));
 assert.ok(sql.includes('@example.invalid'));assert.ok(sql.includes(PREFIX));assert.ok(sql.includes('HrRolePermission'));
 assert.ok(!sql.includes('DATABASE_URL'));assert.ok(!sql.includes('RESEND_API_KEY'));
});
for(const status of ['PENDING','PROCESSING','FAILED','DELIVERED','ABANDONED'])test(`legacy fixtures include ${status}`,()=>assert.ok(legacyFixturesSQL().includes(`'${status}'`)));
test('legacy fixtures never invent contract evidence',()=>{const sql=legacyFixturesSQL();assert.ok(!sql.includes('safetyContractVersion'));assert.ok(!sql.includes('dispatchPhase'));assert.ok(sql.includes('HrEmailDeliveryAttempt'));});
for(const phase of ['NONE','INTENT','RESERVED','ATTEMPTED'])test(`processing ${phase} fixture consistent`,()=>{const row=processing('fixture',phase);assert.equal(row.dispatchPhase,phase);assert.equal(row.attemptCount,phase==='ATTEMPTED'?1:0);assert.equal(row.dispatchId===null,phase==='NONE');});
test('held fixture distinct from claims',()=>{const row=held('fixture');assert.equal(row.status,'HELD');assert.equal(row.attemptCount,undefined);assert.ok(row.holdPolicyRevision);});
test('journal separates reservation cancellation from invocation',()=>{const row=processing('fixture','RESERVED');assert.notEqual(journal('a',row,'RESERVATION_CANCELLED').kind,journal('b',row,'INVOCATION_BOUNDARY').kind);});
test('SQL fixture literal escapes quotes',()=>assert.ok(insert('HrUser',{id:"a'b"}).includes("'a''b'")));
test('SQL builder refuses dynamic identifiers',()=>assert.throws(()=>insert('HrUser;DROP',{id:'x'}),/IDENTIFIER/));
test('coverage documents runtime limitations',()=>{assert.ok(COVERAGE.includes('tenant-negatives'));assert.ok(TEST_SCOPE.runtime.includes('current policy/RBAC'));});
test('sanitization removes URLs and disposable credential values',()=>assert.equal(sanitize('postgresql://x:y@host/db value=sensitive',['sensitive']),'[REDACTED_DATABASE_URL] value=[REDACTED]'));
test('resource mismatch rejects before using credentials',()=>assert.throws(()=>assertIdentity({RunId:'wrong'},{},{},{}),/MISMATCH/));
test('offline self-check opens no sockets or processes',async()=>{
 const spawn=childProcess.spawn,listen=net.Server.prototype.listen,log=console.log;let output;
 try{childProcess.spawn=()=>{throw Error('UNEXPECTED_PROCESS');};net.Server.prototype.listen=()=>{throw Error('UNEXPECTED_LISTENER');};console.log=value=>output=value;await main(['--self-check']);}
 finally{childProcess.spawn=spawn;net.Server.prototype.listen=listen;console.log=log;}
 assert.equal(JSON.parse(output).defaultMode,'OFFLINE_ONLY');
});
test('source contains no release/worker or global cleanup command',()=>{
 const sources=['runtime.mjs','transport.mjs','run-q03b.mjs'].map(file=>fs.readFileSync(path.join(ROOT,file),'utf8')).join('\n');
 assert.ok(!/hr:release|start-with-hr-workers|docker\s+(?:system|volume)\s+prune|DROP DATABASE|migrate','reset|db','push/.test(sources));
});
test('migration snapshots contain separate enum and transaction boundary',()=>{
 const first=fs.readFileSync(path.join(ROOT,'inputs/prisma/migrations/20261029000100_email_queue_held_enum/migration.sql'),'utf8');
 const second=fs.readFileSync(path.join(ROOT,'inputs/prisma/migrations/20261029000200_email_queue_safety_contract/migration.sql'),'utf8');
 assert.ok(first.includes('ADD VALUE \'HELD\''));assert.ok(second.includes('BEGIN;'));assert.ok(second.trim().endsWith('COMMIT;'));
});
