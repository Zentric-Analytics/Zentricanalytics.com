import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {ROOT,WORKSPACE,DOCKER,NODE,DATABASES,NEW_MIGRATIONS,assertIdentity,assertDatabase,requireGate,cleanEnvironment,sanitize,verifyInputs} from './config.mjs';
import {startLoopbackRelay,requireTransportReadiness,prepareTransportTarget} from './transport.mjs';
import {readPinnedManifest,dockerEnvironment,engineArguments} from './target-boundary.mjs';
import {installInterruptionHandlers} from './lifecycle.mjs';
export async function executeProcess(file,args,{input='',env=cleanEnvironment(),cwd=ROOT,secrets=[],allowFailure=false}={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(file,args,{env,cwd,windowsHide:true,stdio:['pipe','pipe','pipe']});let out='',err='';
  const timer=setTimeout(()=>{child.kill();reject(Error('PROCESS_TIMEOUT'));},180000);
  child.on('error',()=>{clearTimeout(timer);reject(Error('PROCESS_START_FAILED'));});
  child.stdout.on('data',data=>out+=data);child.stderr.on('data',data=>err+=data);
  child.stdin.on('error',()=>{});child.stdin.end(input);
  child.on('close',code=>{clearTimeout(timer);const result={code,stdout:out,stderr:sanitize(err,secrets)};
   if(code!==0&&!allowFailure)reject(Error('PROCESS_FAILED: '+sanitize(err,secrets)));else resolve(result);});
 });
}
export async function createAdapter(gate){
 requireGate(gate);verifyInputs();requireTransportReadiness();const m=readPinnedManifest();
 const dockerEnv=dockerEnvironment();
 async function rawDocker(args,input='',allowFailure=false,contextOnly=false){return executeProcess(DOCKER,contextOnly?args:engineArguments(args),{env:dockerEnv,input,allowFailure});}
 async function inspect(args,contextOnly=false){return parseMetadata((await rawDocker(args,'',false,contextOnly)).stdout);}
 async function docker(args,input='',allowFailure=false){
  await prepareTransportTarget(m,gate,inspect);
  return rawDocker(args,input,allowFailure);
 }
 const parseMetadata=text=>{try{return JSON.parse(text)[0];}catch{throw Error('DOCKER_METADATA_PARSE_FAILED');}};
 await prepareTransportTarget(m,gate,inspect);
 const c=await inspect(['inspect',m.ContainerId]);
 const n=await inspect(['network','inspect',m.NetworkId]);
 const v=await inspect(['volume','inspect',m.VolumeName]);
 const password=assertIdentity(m,c,n,v);
 const version=(await docker(['exec',m.ContainerId,'postgres','--version'])).stdout;
 if(!/^postgres \(PostgreSQL\) 18\.6\b/.test(version))throw Error('POSTGRES_VERSION_MISMATCH');
 const engineRecords=JSON.parse(fs.readFileSync(path.join(WORKSPACE,'prisma-engines-windows/verified-engine-manifest.json'),'utf8').replace(/^\uFEFF/,''));
 for(const item of engineRecords){if(item.Revision!=='9b628578b3b7cae625e8c927178f15a170e74a9c')throw Error('ENGINE_REVISION_MISMATCH');
  const file=path.join(WORKSPACE,'node_modules/@prisma/engines',item.Filename);
  if(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==item.SHA256)throw Error('ENGINE_HASH_MISMATCH');}
 for(const [name,version] of [['prisma','6.10.1'],['@prisma/client','6.10.1'],['typescript','5.8.3'],['vitest','4.1.11']]){
  if(JSON.parse(fs.readFileSync(path.join(WORKSPACE,'node_modules',name,'package.json'),'utf8')).version!==version)throw Error('TOOLCHAIN_VERSION_MISMATCH');}
 const relay=await startLoopbackRelay(m,gate);
 const interruptions=installInterruptionHandlers(process,()=>relay.close());
 const created=new Set();
 async function createDatabase(name){interruptions.assertRunning();assertDatabase(name);if(created.has(name))throw Error('DATABASE_ALREADY_CREATED_BY_RUN');
  // createdb fails on collision. Never adopt/delete a pre-existing database.
  await docker(['exec',m.ContainerId,'createdb','--username=q03_owner','--maintenance-db=q03_disposable',name]);created.add(name);}
 async function sql(name,input,allowFailure=false){interruptions.assertRunning();assertDatabase(name);if(!created.has(name))throw Error('DATABASE_NOT_CREATED_BY_THIS_EXECUTION');
  return docker(['exec','-i',m.ContainerId,'psql','--no-psqlrc','--quiet','--tuples-only','--no-align','--set=ON_ERROR_STOP=1',
   '--username=q03_owner',`--dbname=${name}`],input,allowFailure);}
 async function prepareProject(track,includeNew){
  const destination=path.join(ROOT,'execution',track);if(fs.existsSync(destination))throw Error('EXECUTION_DIRECTORY_COLLISION');
  fs.mkdirSync(path.join(destination,'prisma/migrations'),{recursive:true});
  fs.copyFileSync(path.join(ROOT,'inputs/prisma/schema.prisma'),path.join(destination,'prisma/schema.prisma'));
  fs.copyFileSync(path.join(ROOT,'inputs/prisma/migrations/migration_lock.toml'),path.join(destination,'prisma/migrations/migration_lock.toml'));
  for(const name of fs.readdirSync(path.join(ROOT,'inputs/prisma/migrations')).sort()){
   if(!/^\d{14}_/.test(name)||(!includeNew&&NEW_MIGRATIONS.includes(name)))continue;
   fs.cpSync(path.join(ROOT,'inputs/prisma/migrations',name),path.join(destination,'prisma/migrations',name),{recursive:true});}
  return destination;
 }
 function addNewMigrations(project){for(const name of NEW_MIGRATIONS)fs.cpSync(path.join(ROOT,'inputs/prisma/migrations',name),path.join(project,'prisma/migrations',name),{recursive:true,errorOnExist:true,force:false});}
 async function prisma(name,project,args,allowFailure=false,input=''){interruptions.assertRunning();assertDatabase(name);if(!created.has(name))throw Error('DATABASE_NOT_CREATED_BY_THIS_EXECUTION');relay.assertHealthy();
  if(![['validate'],['generate'],['migrate','deploy'],['migrate','status'],['db','execute','--stdin']].some(allowed=>JSON.stringify(allowed)===JSON.stringify(args)))throw Error('PRISMA_COMMAND_NOT_ALLOWLISTED');
  const url=new URL('postgresql://127.0.0.1');url.port=String(relay.port);url.username='q03_owner';url.password=password;url.pathname='/'+name;
  url.searchParams.set('schema','public');url.searchParams.set('connection_limit','2');url.searchParams.set('connect_timeout','10');
  const p=await executeProcess(NODE,['--require',path.join(ROOT,'tool-network-guard.cjs'),path.join(WORKSPACE,'node_modules/prisma/build/index.js'),...args,'--schema',path.join(project,'prisma/schema.prisma')],
   {env:cleanEnvironment({DATABASE_URL:url.href}),cwd:project,secrets:[password,url.href],allowFailure,input});
  if(fs.existsSync(path.join(ROOT,'tool-network-attempts.jsonl')))throw Error('UNAPPROVED_TOOL_NETWORK_ATTEMPT');relay.assertHealthy();return p;
 }
 async function probe(name,project){assertDatabase(name);
  // Future SQL only: identity assertion on the newly created empty disposable DB.
  // No application tables, fixtures, migration commands or connection strings here.
  const input=`DO $q03_identity$ BEGIN
   IF current_database() <> '${name}' OR current_user <> 'q03_owner'
     OR current_setting('server_version_num')::integer NOT BETWEEN 180000 AND 189999
   THEN RAISE EXCEPTION 'Q03 disposable server identity mismatch'; END IF;
   IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind IN ('r','p'))
   THEN RAISE EXCEPTION 'Q03 target must be empty'; END IF;
  END $q03_identity$;`;
  await prisma(name,project,['db','execute','--stdin'],false,input);
 }
 async function compatibility(name,project){
  await prisma(name,project,['validate']);
  const schemaFile=path.join(project,'prisma/schema.prisma');const text=fs.readFileSync(schemaFile,'utf8');
  if(!text.includes('provider = "prisma-client-js"'))throw Error('GENERATOR_NOT_REVIEWED');
  // Only a derived disposable copy changes generator output; snapshots/repository stay immutable.
  fs.writeFileSync(schemaFile,text.replace('provider = "prisma-client-js"','provider = "prisma-client-js"\n  output = "../generated-client"'));
  await prisma(name,project,['generate']);
  const probe=path.join(project,'compatibility.ts');
  fs.writeFileSync(probe,'import { PrismaClient, HrOutboxStatus, HrEmailDispatchPhase } from "./generated-client";\nconst state: HrOutboxStatus = "HELD"; const phase: HrEmailDispatchPhase = "RESERVED";\ndeclare const db: PrismaClient; const query = db.hrEmailOutbox.findMany({where:{status:state,dispatchPhase:phase}});\nvoid query;\n');
  await executeProcess(NODE,[path.join(WORKSPACE,'node_modules/typescript/bin/tsc'),'--noEmit','--incremental','false','--strict','--skipLibCheck','false','--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext',probe],{cwd:project});
 }
 return {m,created,createDatabase,prepareProject,addNewMigrations,prisma,compatibility,probe,
  database(name){return{sql:async text=>(await sql(name,text)).stdout};},rawSQL:sql,
  async close(){try{await relay.close();}finally{interruptions.remove();}},
  // No automatic database/container/volume deletion. Preserve evidence on failure.
  cleanupPlan(){return{createdDatabases:[...created],containerId:m.ContainerId,action:'Separate exact-name cleanup authorization required; never drop databases not created by this execution.'};}};
}
