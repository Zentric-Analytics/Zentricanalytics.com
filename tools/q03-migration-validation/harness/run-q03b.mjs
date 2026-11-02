import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {ROOT,RUN,DATABASES,NEW_MIGRATIONS,executionGate,verifyInputs,sanitize} from './config.mjs';
import {baseFixturesSQL,legacyFixturesSQL,LEGACY_SNAPSHOT_SQL} from './fixtures.mjs';
import {createAdapter} from './runtime.mjs';
import {runDatabaseTests,runConcurrencyTests} from './db-tests.mjs';
import {runFinalized} from './lifecycle.mjs';
import {CATALOG_SQL,assertHistoricalPreserved,assertMigrationFailure,assertBlindRetry,assertCatalogEqual,assertSafetyDefinitions} from './evidence-rules.mjs';
export function offlinePlan(){return Object.freeze({run:RUN,inputFiles:verifyInputs(),trackA:DATABASES.A,trackB:DATABASES.B,failureTrack:DATABASES.F,
 migrations:NEW_MIGRATIONS,defaultMode:'OFFLINE_ONLY',executionAuthorizedByThisUnit:false,databaseExecutionReadiness:'BLOCKED_RELAY_LIFECYCLE_NOT_CERTIFIED'});}
async function ledger(adapter,name){const raw=await adapter.database(name).sql('SELECT COALESCE(json_agg(json_build_object(\'id\',id,\'checksum\',checksum,\'startedAt\',started_at,\'finishedAt\',finished_at,\'rolledBackAt\',rolled_back_at,\'appliedSteps\',applied_steps_count,\'name\',migration_name,\'finished\',finished_at IS NOT NULL,\'rolledBack\',rolled_back_at IS NOT NULL) ORDER BY migration_name),\'[]\'::json) FROM "_prisma_migrations";');return JSON.parse(raw.trim());}
function assertLedgerChecksums(rows,project){for(const row of rows){const bytes=fs.readFileSync(path.join(project,'prisma/migrations',row.name,'migration.sql'));assert.equal(row.checksum,crypto.createHash('sha256').update(bytes).digest('hex'),'MIGRATION_LEDGER_CHECKSUM_MISMATCH');}}
async function catalog(db){return JSON.parse((await db.sql(CATALOG_SQL)).trim());}
async function assertCatalog(db){
 const result=await catalog(db);const source=fs.readFileSync(path.join(ROOT,'inputs/prisma/migrations',NEW_MIGRATIONS[1],'migration.sql'),'utf8');assertSafetyDefinitions(result,source);
 const labels=JSON.parse((await db.sql(`SELECT json_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='HrOutboxStatus';`)).trim());
 assert.deepEqual(labels,['PENDING','PROCESSING','DELIVERED','FAILED','ABANDONED','HELD']);return result;
}
export async function main(argv){
 if(argv.length===0||argv.join(' ')==='--self-check'){console.log(JSON.stringify(offlinePlan()));return;}
 const gate=executionGate(argv);const adapter=await createAdapter(gate);const report={run:RUN,status:'RUNNING',tracks:[],tests:[]};
 await runFinalized({execute:async()=>{try{
  const names=fs.readdirSync(path.join(ROOT,'inputs/prisma/migrations')).filter(n=>/^\d{14}_/.test(n)).sort();
  assert.equal(names.length,68);assert.deepEqual(names.slice(-2),NEW_MIGRATIONS);
  await adapter.createDatabase(DATABASES.A);const a=await adapter.prepareProject('track-a',true);
  await adapter.probe(DATABASES.A,a);
  await adapter.prisma(DATABASES.A,a,['migrate','deploy']);
  const la=await ledger(adapter,DATABASES.A);assertLedgerChecksums(la,a);assert.deepEqual(la.filter(x=>x.finished&&!x.rolledBack).map(x=>x.name),names);
  const aCatalog=await assertCatalog(adapter.database(DATABASES.A));report.tracks.push({name:'A',ledger:la,catalog:aCatalog});
  await adapter.createDatabase(DATABASES.B);const b=await adapter.prepareProject('track-b',false);
  await adapter.probe(DATABASES.B,b);
  await adapter.prisma(DATABASES.B,b,['migrate','deploy']);const bdb=adapter.database(DATABASES.B);
  await bdb.sql(baseFixturesSQL());await bdb.sql(legacyFixturesSQL());
  const before=JSON.parse((await bdb.sql(LEGACY_SNAPSHOT_SQL)).trim());
  fs.mkdirSync(path.join(ROOT,'evidence'),{recursive:true});fs.writeFileSync(path.join(ROOT,'evidence/legacy-before.json'),JSON.stringify(before,null,2));
  adapter.addNewMigrations(b);await adapter.prisma(DATABASES.B,b,['migrate','deploy']);
  const after=JSON.parse((await bdb.sql(LEGACY_SNAPSHOT_SQL)).trim());assertHistoricalPreserved(before,after);
  fs.writeFileSync(path.join(ROOT,'evidence/legacy-after.json'),JSON.stringify(after,null,2));
  const lb=await ledger(adapter,DATABASES.B);assertLedgerChecksums(lb,b);assert.deepEqual(lb.filter(x=>x.finished&&!x.rolledBack).map(x=>x.name),names);
  const bCatalog=await assertCatalog(bdb);assertCatalogEqual(aCatalog,bCatalog);report.tracks.push({name:'B',legacyPreserved:true,ledger:lb,catalog:bCatalog});
  report.tests.push(...await runDatabaseTests(bdb),...await runConcurrencyTests(bdb));
  await adapter.compatibility(DATABASES.B,b);
  // Isolated failure injection modifies only a derived copy, never migration snapshots.
  await adapter.createDatabase(DATABASES.F);const f=await adapter.prepareProject('failure',false);
  await adapter.probe(DATABASES.F,f);
  await adapter.prisma(DATABASES.F,f,['migrate','deploy']);const fdb=adapter.database(DATABASES.F);const fBefore=await catalog(fdb);adapter.addNewMigrations(f);
  const failFile=path.join(f,'prisma/migrations',NEW_MIGRATIONS[1],'migration.sql');
  const original=fs.readFileSync(failFile,'utf8');assert.ok(/COMMIT;\s*$/.test(original));
  fs.writeFileSync(failFile,original.replace(/COMMIT;\s*$/,'SELECT 1/0;\nCOMMIT;\n'));
  const failure=await adapter.prisma(DATABASES.F,f,['migrate','deploy'],true);
  const rolled=JSON.parse((await fdb.sql(`SELECT json_build_object('held',EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='HrOutboxStatus' AND e.enumlabel='HELD'),'journalAbsent',to_regclass('"HrEmailDispatchEvent"') IS NULL);`)).trim());
  assert.equal(rolled.held,true);assert.equal(rolled.journalAbsent,true);
  const failedLedger=await ledger(adapter,DATABASES.F);assertLedgerChecksums(failedLedger,f);assertMigrationFailure(failure,failedLedger,names,fBefore,await catalog(fdb));
  const retry=await adapter.prisma(DATABASES.F,f,['migrate','deploy'],true);assertBlindRetry(retry,failedLedger,await ledger(adapter,DATABASES.F));assertCatalogEqual(fBefore,await catalog(fdb));
  report.tracks.push({name:'F',expectedFailure:true,transactionRollbackObserved:true,blindRetryBlocked:true,ledger:failedLedger});
  report.status='PASS_WITH_RUNTIME_LIMITATIONS';report.runtimeNotCertified=['policy/RBAC','real provider delivery','production workers','credential supersession concurrency','exactly-once delivery'];
 }catch(error){report.status='FAIL_STOP';report.error=sanitize(error.message);throw error;}},
 writeEvidence:async()=>{report.cleanup=adapter.cleanupPlan();fs.mkdirSync(path.join(ROOT,'evidence'),{recursive:true});fs.writeFileSync(path.join(ROOT,'evidence/result.json'),JSON.stringify(report,null,2));},
 close:()=>adapter.close()});
 console.log(JSON.stringify({status:report.status,testCount:report.tests.length}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){main(process.argv.slice(2)).catch(error=>{console.error(JSON.stringify({error:sanitize(error.message),secondary:error.secondary??[]}));process.exitCode=1;});}
