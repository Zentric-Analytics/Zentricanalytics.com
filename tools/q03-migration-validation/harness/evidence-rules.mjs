import assert from 'node:assert/strict';
import {NEW_MIGRATIONS} from './config.mjs';
export const HISTORICAL_OUTBOX=Object.freeze(['id','organizationId','recipient','template','subject','payload','status','attemptCount','nextAttemptAt','lastAttemptedAt','lastError','provider','providerMessageId','idempotencyKey','createdAt','deliveredAt']);
export const HISTORICAL_ATTEMPT=Object.freeze(['id','outboxId','attemptNumber','status','provider','providerMessageId','safeError','attemptedAt']);
export const HISTORICAL_AUDIT=Object.freeze(['id','organizationId','actorUserId','actorRole','entityType','entityId','action','previousValues','newValues','reason','ipHash','userAgent','requestId','correlationId','createdAt']);
export const NEW_OUTBOX=Object.freeze(['safetyContractVersion','version','dispatchPhase','claimId','claimedAt','claimExpiresAt','dispatchId','holdReason','heldAt','holdPolicyRevision','reviewDueAt','retentionReviewAt','messageExpiresAt','providerAcceptedAt','invitationId','resetChallengeId']);
export function assertHistoricalSnapshot(snapshot){
 for(const [section,fields,count] of [['outbox',HISTORICAL_OUTBOX,5],['attempts',HISTORICAL_ATTEMPT,10],['audit',HISTORICAL_AUDIT,2]]){
  assert.equal(snapshot[section]?.length,count,`HISTORICAL_ROW_COUNT_${section}`);
  for(const row of snapshot[section])assert.deepEqual(Object.keys(row).sort(),[...fields].sort(),`HISTORICAL_FIELDS_${section}`);
 }
}
export function assertHistoricalPreserved(before,after){assertHistoricalSnapshot(before);assertHistoricalSnapshot(after);assert.deepEqual(after,before,'HISTORICAL_VALUE_CHANGED');}
export function assertMigrationFailure(result,ledger,names,beforeCatalog,afterCatalog){
 assert.notEqual(result.code,0,'INJECTION_UNEXPECTEDLY_SUCCEEDED');
 const error=result.stderr+'\n'+result.stdout;
 assert.match(error,/\bP3018\b/,'WRONG_PRISMA_FAILURE');assert.match(error,/\b22012\b/,'WRONG_DATABASE_FAILURE');
 assert.ok(error.includes(NEW_MIGRATIONS[1]),'WRONG_FAILED_MIGRATION');
 assert.deepEqual(ledger.map(x=>x.name),names,'WRONG_MIGRATION_LEDGER');
 for(const row of ledger)assert.deepEqual([row.finished,row.rolledBack],row.name===NEW_MIGRATIONS[1]?[false,false]:[true,false],'WRONG_LEDGER_STATE');
 assert.deepEqual(afterCatalog,beforeCatalog,'PARTIAL_TRANSACTION_EFFECTS');
}
export function assertBlindRetry(result,before,after){
 assert.notEqual(result.code,0,'BLIND_RETRY_UNEXPECTEDLY_SUCCEEDED');
 assert.match(result.stderr+'\n'+result.stdout,/\bP3009\b/,'WRONG_RETRY_FAILURE');
 assert.ok((result.stderr+'\n'+result.stdout).includes(NEW_MIGRATIONS[1]),'WRONG_RETRY_MIGRATION');
 assert.deepEqual(after,before,'BLIND_RETRY_CHANGED_LEDGER');
}
export function assertTransition(before,after,expected){
 assert.equal(after.version,before.version+1,'TRANSITION_SKIPPED');
 for(const [key,value] of Object.entries(expected))assert.deepEqual(after[key],value,`TRANSITION_FIELD_${key}`);
}
export function assertCatalogEqual(expected,actual){assert.deepEqual(actual,expected,'CATALOG_DEFINITION_MISMATCH');}
export function legacyClassificationGaps(sql){
 const branch=sql.match(/IF OLD\."safetyContractVersion" IS NULL[\s\S]*?(?=IF OLD\."safetyContractVersion" = 1)/)?.[0];
 assert.ok(branch,'MISSING_LEGACY_CLASSIFICATION_GUARD');
 const guarded=new Set([...branch.matchAll(/NEW\."([^"]+)" IS DISTINCT FROM OLD\."\1"/g)].map(m=>m[1]));
 return Object.freeze(HISTORICAL_OUTBOX.filter(x=>!guarded.has(x)));
}
// Full public object definitions; timestamps/data/ledger excluded. HrOutboxStatus labels
// are asserted separately because migration 1 must commit independently of migration 2.
export const CATALOG_SQL=`SELECT json_build_object(
 'columns',(SELECT COALESCE(json_agg(row_to_json(x) ORDER BY x.table_name,x.ordinal_position),'[]') FROM (SELECT table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name <> '_prisma_migrations') x),
 'constraints',(SELECT COALESCE(json_agg(row_to_json(x) ORDER BY x.table_name,x.name),'[]') FROM (SELECT c.relname AS table_name,k.conname AS name,pg_get_constraintdef(k.oid,true) AS definition,k.convalidated AS validated FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname <> '_prisma_migrations') x),
 'indexes',(SELECT COALESCE(json_agg(row_to_json(x) ORDER BY x.tablename,x.indexname),'[]') FROM (SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename <> '_prisma_migrations') x),
 'triggers',(SELECT COALESCE(json_agg(row_to_json(x) ORDER BY x.name),'[]') FROM (SELECT t.tgname AS name,t.tgenabled AS enabled,pg_get_triggerdef(t.oid,true) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal) x),
 'functions',(SELECT COALESCE(json_agg(row_to_json(x) ORDER BY x.name),'[]') FROM (SELECT p.proname AS name,pg_get_functiondef(p.oid) AS definition,p.prosrc AS body FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f') x),
 'enums',(SELECT COALESCE(json_agg(row_to_json(x) ORDER BY x.name,x.position),'[]') FROM (SELECT t.typname AS name,e.enumsortorder AS position,e.enumlabel AS label FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname <> 'HrOutboxStatus') x));`;
export function assertSafetyDefinitions(catalog,sql){
 for(const name of [...sql.matchAll(/ADD CONSTRAINT "([^"]+)"|CONSTRAINT "([^"]+)"/g)].map(m=>m[1]??m[2]))assert.ok(catalog.constraints.some(x=>x.name===name&&x.validated),'MISSING_CONSTRAINT_'+name);
 for(const m of sql.matchAll(/CREATE (?:UNIQUE )?INDEX "([^"]+)"/g))assert.ok(catalog.indexes.some(x=>x.indexname===m[1]&&x.indexdef),'MISSING_INDEX_'+m[1]);
 for(const m of sql.matchAll(/CREATE TRIGGER "([^"]+)"/g))assert.ok(catalog.triggers.some(x=>x.name===m[1]&&x.enabled==='O'&&x.definition),'MISSING_TRIGGER_'+m[1]);
 for(const m of sql.matchAll(/CREATE FUNCTION (\w+)\(\) RETURNS trigger AS \$\$([\s\S]*?)\$\$ LANGUAGE plpgsql;/g)){
  const actual=catalog.functions.find(x=>x.name===m[1]);assert.ok(actual,'MISSING_FUNCTION_'+m[1]);assert.equal(actual.body.replaceAll('\r',''),m[2].replaceAll('\r',''),'FUNCTION_BODY_CHANGED');
 }
 for(const name of ['HrEmailOutbox_invitationId_fkey','HrEmailOutbox_resetChallengeId_fkey','HrEmailDispatchEvent_outboxId_organizationId_fkey','HrEmailDispatchEvent_actorUserId_fkey','HrEmailDispatchEvent_auditEventId_fkey']){
  const c=catalog.constraints.find(x=>x.name===name);assert.ok(c,'MISSING_RESTRICTIVE_FK');assert.match(c.definition,/ON DELETE RESTRICT/);assert.match(c.definition,/ON UPDATE RESTRICT/);
 }
}
