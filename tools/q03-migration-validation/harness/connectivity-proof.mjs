import {RUN} from './config.mjs';
import {readPinnedManifest,ENDPOINT} from './target-boundary.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
export function connectivityPlan(imageId){
 if(!/^sha256:[a-f0-9]{64}$/.test(imageId))throw Error('RUNNER_IMAGE_NOT_PINNED');
 const target=readPinnedManifest();
 return Object.freeze({run:RUN,imageId,endpoint:ENDPOINT,network:`container:${target.ContainerId}`,pid:'private',database:'q03_disposable',username:'q03_owner',credentialTransport:'private-stdin',readOnlyTransaction:true,migrations:false,clientGeneration:false,executionAuthorized:false});
}
export function encodeDisposableCredential(snapshot){
 const keys=['run','username','database','password'];
 if(!snapshot||Object.getPrototypeOf(snapshot)!==Object.prototype||Reflect.ownKeys(snapshot).length!==4
  ||keys.some(k=>!Object.hasOwn(Object.getOwnPropertyDescriptor(snapshot,k)??{},'value'))
  ||snapshot.run!==RUN||snapshot.username!=='q03_owner'||snapshot.database!=='q03_disposable'
  ||typeof snapshot.password!=='string'||snapshot.password.length<24||snapshot.password.length>256||/[\x00-\x20\x7f]/.test(snapshot.password))throw Error('DISPOSABLE_CREDENTIAL_ENVELOPE_INVALID');
 // Future private stdin bytes only. Never pass this result to logs, files or Docker env.
 return Buffer.from(JSON.stringify(snapshot)+'\n','utf8');
}
export function connectivityProof(){throw Error('CONNECTIVITY_REQUIRES_SEPARATE_OWNER_AUTHORIZATION');}

export const A8_IMAGE='sha256:efa8f09478536bb9a22ad8646a7b299d3300ecf65417b8bc25e4d57ff6122334';
export const A8_CONTAINER='f877a874e84d45edbf1f3c5039d203b2080c1855369800ccd98a96544565f49f';
export const A8_MODES=Object.freeze(['a8-normal','a8-interrupt','a8-closure']);
export const A8_OPTIONS='-c default_transaction_read_only=on -c statement_timeout=12000 -c idle_in_transaction_session_timeout=5000 -c lock_timeout=2000 -c client_connection_check_interval=1000';
const capabilities=new WeakMap();
export function issueA8Capability(argv){
 if(!Array.isArray(argv)||JSON.stringify(argv)!==JSON.stringify(['--q03-a8-connectivity','--authorize-run',RUN]))throw Error('A8_EXPLICIT_SCOPE_REQUIRED');
 const cap=Object.freeze({unit:'Q03-A8',scope:'SELECT_ONLY_CONNECTIVITY'});
 capabilities.set(cap,{active:true,expires:Date.now()+300000,modes:new Set()});return cap;
}
export function useA8Capability(cap,mode){
 const state=capabilities.get(cap);
 if(!state?.active||Date.now()>state.expires||!A8_MODES.includes(mode)||state.modes.has(mode))throw Error('A8_CAPABILITY_UNAVAILABLE');
 state.modes.add(mode);return true;
}
export function assertA8Capability(cap){const s=capabilities.get(cap);if(!s?.active||Date.now()>s.expires)throw Error('A8_CAPABILITY_UNAVAILABLE');}
export function expireA8Capability(cap){const s=capabilities.get(cap);if(s)s.active=false;}
export function rejectA8Overrides(env){
 if(Object.keys(env).some(k=>/^(?:DATABASE_URL|DIRECT_URL|SHADOW_DATABASE_URL|PGHOST|PGPORT|PGDATABASE|PGUSER|PGPASSWORD|PGSERVICE|PGOPTIONS|RESEND_API_KEY|EMAIL_WORKER_SECRET|AWS_SECRET_ACCESS_KEY|DOCKER_HOST|DOCKER_CONTEXT|NODE_OPTIONS)$/.test(k)))throw Error('A8_ENVIRONMENT_OVERRIDE_REJECTED');
}
export function a8SafeOutput(text,secret){if((secret&&text.includes(secret))||/postgres(?:ql)?:\/\//i.test(text)||/"(?:password|DATABASE_URL)"\s*:/i.test(text))return '[A8_UNSAFE_OUTPUT_REJECTED]';return text;}
export function validateA8Authorization(r){
 const allowed=new Set(['unit','run','imageId','containerId','endpoint','database','role','scope','q03B','a7ManifestSHA256','sessionPrefix','sourceHashes','ownerRequestSHA256','createdDate','gateARecordSHA256']);
 if(!r||Object.getPrototypeOf(r)!==Object.prototype||Reflect.ownKeys(r).some(k=>typeof k!=='string'||!allowed.has(k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(r,k)??{},'value'))||!Array.isArray(r.sourceHashes)||!r.sourceHashes.length||r.sourceHashes.some(x=>typeof x.File!=='string'||!/^[-a-z0-9.]+\.mjs$/.test(x.File)||!/^[A-Fa-f0-9]{64}$/.test(x.SHA256)))throw Error('A8_AUTHORIZATION_MISMATCH');
 if(r?.unit!=='Q03-A8'||r.run!==RUN||r.imageId!==A8_IMAGE||r.containerId!==A8_CONTAINER||r.endpoint!==ENDPOINT||r.database!=='q03_disposable'||r.role!=='q03_owner'||r.scope!=='SELECT_ONLY_CONNECTIVITY'||r.q03B!==false||r.a7ManifestSHA256!=='FE933B8F16456A8263A8F0182D3A926DAAC7480F0F37B9E546090A12ECB5753D'||!/^q03a8_[a-f0-9]{12}$/.test(r.sessionPrefix))throw Error('A8_AUTHORIZATION_MISMATCH');
 return r;
}
export function a8Query(name,prefix){
 if(!/^q03a8_[a-f0-9]{12}$/.test(prefix))throw Error('A8_SESSION_PREFIX_INVALID');
 const identity=`'pid',pg_backend_pid(),'database',current_database(),'role',current_user,'version',current_setting('server_version'),'versionNum',current_setting('server_version_num')::int,'readOnly',current_setting('transaction_read_only'),'at',clock_timestamp()`;
 const tableCount=`(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema' AND c.relkind IN ('r','p','v','m','S','f'))`;
 const sql={
  baseline:`SELECT json_build_object(${identity},'objects',${tableCount},'ledgerAbsent',to_regclass('public."_prisma_migrations"') IS NULL);`,
  pair:`SELECT json_build_object(${identity},'phase','start','otherActive',(SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND usename=current_user AND application_name LIKE '${prefix}%' AND pid<>pg_backend_pid() AND state='active')); SELECT pg_sleep(3); SELECT json_build_object(${identity},'phase','end');`,
  hold:`SELECT json_build_object(${identity},'phase','start'); SELECT pg_sleep(10); SELECT json_build_object(${identity},'phase','end');`,
  closure:`SELECT json_build_object(${identity},'remaining',(SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND usename=current_user AND application_name LIKE '${prefix}%' AND pid<>pg_backend_pid()));`,
  prisma:`SELECT 1 / (CASE WHEN current_database()='q03_disposable' AND current_user='q03_owner' AND current_setting('server_version_num')::int=180006 AND current_setting('transaction_read_only')='on' AND ${tableCount}=0 AND to_regclass('public."_prisma_migrations"') IS NULL THEN 1 ELSE 0 END) AS q03_a8_read_only_identity_assertion;`
 };
 if(!Object.hasOwn(sql,name))throw Error('A8_QUERY_NOT_APPROVED');return sql[name];
}
export function assertA8Identity(row){
 if(row?.database!=='q03_disposable'||row.role!=='q03_owner'||row.versionNum!==180006||row.readOnly!=='on'||!Number.isInteger(row.pid)||row.pid<=0)throw Error('A8_DATABASE_IDENTITY_MISMATCH');
}
export function assertA8Overlap(a,b){
 for(const list of [a,b]){if(list.length!==2||list[0].phase!=='start'||list[1].phase!=='end')throw Error('A8_SESSION_INTERVAL_MISSING');for(const row of list)assertA8Identity(row);if(list[0].pid!==list[1].pid)throw Error('A8_SESSION_CHANGED');}
 const times=[a[0].at,a[1].at,b[0].at,b[1].at].map(Date.parse);
 if(!times.every(Number.isFinite)||times[0]>=times[1]||times[2]>=times[3]||![a[0].otherActive,b[0].otherActive].every(x=>Number.isInteger(x)&&x>=0)||a[0].pid===b[0].pid||Math.max(times[0],times[2])>=Math.min(times[1],times[3])||Math.max(a[0].otherActive,b[0].otherActive)<1)throw Error('A8_ACTIVE_OVERLAP_NOT_PROVEN');
 return true;
}
function runnerAuthorization(){
 const dir=path.dirname(new URL(import.meta.url).pathname);
 const auth=validateA8Authorization(JSON.parse(fs.readFileSync(path.join(dir,'a8-authorization.json'),'utf8')));
 for(const file of ['config.mjs','target-boundary.mjs','connectivity-proof.mjs','runner-entrypoint.mjs']){
  const expected=auth.sourceHashes.find(x=>x.File===file)?.SHA256;
  if(!expected||crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,file))).digest('hex').toUpperCase()!==expected)throw Error('A8_RUNTIME_SOURCE_MISMATCH');
 }
 return auth;
}
async function readCredential(){let input='';for await(const data of process.stdin){input+=data;if(input.length>2048)throw Error('A8_CREDENTIAL_INPUT_LIMIT');if(input.includes('\n'))break;}let parsed;try{parsed=JSON.parse(input);}catch{throw Error('A8_CREDENTIAL_INPUT_INVALID');}encodeDisposableCredential(parsed);return parsed;}
export async function runA8Connectivity(mode){
 if(!A8_MODES.includes(mode))throw Error('A8_MODE_NOT_APPROVED');
 const auth=runnerAuthorization();
 rejectA8Overrides(process.env);
 if(process.version!=='v22.23.3'||JSON.parse(fs.readFileSync('/opt/project/node_modules/prisma/package.json','utf8')).version!=='6.10.1'||JSON.parse(fs.readFileSync('/opt/project/node_modules/@prisma/client/package.json','utf8')).version!=='6.10.1')throw Error('A8_TOOLCHAIN_VERSION_MISMATCH');
 for(const [file,hash] of [['schema-engine','348b9e6f5c531d13a2cdb1e130b90306b8fe8d30cda879fbf22d21ea787f6244'],['libquery_engine.so.node','aef387b0b42412126048b637c502bd30ac32f696da402d39985f83ac95899544']])if(crypto.createHash('sha256').update(fs.readFileSync('/opt/engines/'+file)).digest('hex')!==hash)throw Error('A8_ENGINE_HASH_MISMATCH');
 const secret=await readCredential();
 const options=A8_OPTIONS;
 const env={PATH:'/opt/node/bin:/usr/bin:/bin',HOME:'/tmp',TMPDIR:'/tmp',PGHOST:'127.0.0.1',PGPORT:'5432',PGDATABASE:'q03_disposable',PGUSER:'q03_owner',PGPASSWORD:secret.password,PGCONNECT_TIMEOUT:'5',PGOPTIONS:options};
 function session(query,tag){
  let startedResolve,startedReject;const started=new Promise((resolve,reject)=>{startedResolve=resolve;startedReject=reject;});started.catch(()=>{});
  const rows=[];let buffer='';
  const finished=new Promise((resolve,reject)=>{
   const c=spawn('/usr/bin/psql',['--no-psqlrc','--no-password','--quiet','--tuples-only','--no-align','--set=ON_ERROR_STOP=1'],{env:{...env,PGAPPNAME:auth.sessionPrefix+'_'+tag},stdio:['pipe','pipe','pipe']});
   const timer=setTimeout(()=>{c.kill();reject(Error('A8_SELECT_TIMEOUT'));},15000);
   c.stderr.resume();c.stdin.on('error',()=>{});c.stdin.end(a8Query(query,auth.sessionPrefix));
   c.stdout.on('data',data=>{buffer+=data;if(buffer.length>65536){c.kill();reject(Error('A8_OUTPUT_LIMIT'));return;}const lines=buffer.split(/\r?\n/);buffer=lines.pop();for(const line of lines){if(!line.trim().startsWith('{'))continue;try{const row=JSON.parse(line);assertA8Identity(row);rows.push(row);if(row.phase==='start')startedResolve(row);}catch{c.kill();reject(Error('A8_SELECT_RESULT_INVALID'));}}});
   c.on('error',()=>{clearTimeout(timer);startedReject(Error('A8_PSQL_START_FAILED'));reject(Error('A8_PSQL_START_FAILED'));});
   c.on('close',code=>{clearTimeout(timer);if(code!==0){startedReject(Error('A8_SELECT_FAILED'));reject(Error('A8_SELECT_FAILED'));}else{startedResolve(rows[0]);resolve(rows);}});
  });finished.catch(()=>{});return {started,finished};
 }
 const baseline=(await session('baseline','baseline').finished)[0];
 console.log(JSON.stringify({kind:'baseline',...baseline}));
 if(mode!=='a8-closure'&&(!baseline||baseline.objects!==0||baseline.ledgerAbsent!==true))throw Error('A8_UNEXPECTED_BASELINE_OBJECTS');
 if(mode==='a8-closure'){
  const observations=[];
  for(let i=0;i<30;i++){const row=(await session('closure','closure').finished)[0];observations.push({at:row.at,remaining:row.remaining});if(row.remaining===0){console.log(JSON.stringify({kind:'closure',observations,closed:true}));return;}await new Promise(r=>setTimeout(r,500));}
  throw Error('A8_SESSIONS_NOT_CLOSED');
 }
 if(mode==='a8-interrupt'){
  const hold=session('hold','interrupt');const ready=await hold.started;
  console.log(JSON.stringify({kind:'interruptReady',...ready}));await hold.finished;throw Error('A8_EXPECTED_HOST_INTERRUPTION_MISSING');
 }
 // Genuine Prisma CLI operation, using the unmodified, read-only source schema.
 const url=new URL('postgresql://127.0.0.1:5432/q03_disposable');url.username='q03_owner';url.password=secret.password;
 url.searchParams.set('options',options);url.searchParams.set('application_name',auth.sessionPrefix+'_prisma');url.searchParams.set('connect_timeout','5');url.searchParams.set('socket_timeout','12');
 const cliEnv={PATH:env.PATH,HOME:'/tmp',TMPDIR:'/tmp',DATABASE_URL:url.href,CHECKPOINT_DISABLE:'1',DO_NOT_TRACK:'1',PRISMA_SKIP_POSTINSTALL_GENERATE:'1',PRISMA_SCHEMA_ENGINE_BINARY:'/opt/engines/schema-engine',PRISMA_QUERY_ENGINE_LIBRARY:'/opt/engines/libquery_engine.so.node'};
 await new Promise((resolve,reject)=>{const c=spawn('/opt/node/bin/node',['/opt/project/node_modules/prisma/build/index.js','db','execute','--stdin','--schema','/opt/harness/inputs/prisma/schema.prisma'],{env:cliEnv,cwd:'/work',stdio:['pipe','pipe','pipe']});const timer=setTimeout(()=>{c.kill();reject(Error('A8_PRISMA_TIMEOUT'));},15000);c.stdout.resume();c.stderr.resume();c.stdin.on('error',()=>{});c.stdin.end(a8Query('prisma',auth.sessionPrefix));c.on('error',()=>{clearTimeout(timer);reject(Error('A8_PRISMA_START_FAILED'));});c.on('close',code=>{clearTimeout(timer);if(code===0)resolve();else reject(Error('A8_PRISMA_READ_ONLY_CHECK_FAILED'));});});
 console.log(JSON.stringify({kind:'prisma',version:'6.10.1',engineRevision:'9b628578b3b7cae625e8c927178f15a170e74a9c',readOnlyIdentityAssertionPassed:true,clientGenerated:false}));
 const first=session('pair','pair_a');await first.started;const second=session('pair','pair_b');const [a,b]=await Promise.all([first.finished,second.finished]);assertA8Overlap(a,b);
 console.log(JSON.stringify({kind:'overlap',sessions:[a,b],verified:true}));
}
