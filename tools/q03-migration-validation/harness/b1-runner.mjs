import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {B1,digest,reviewedInputs,authorization,rejectOverrides,credential,sanitize,identity,assertLedger,fixedSQL} from './b1-contract.mjs';
import {CATALOG_SQL,assertSafetyDefinitions} from './evidence-rules.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const emit=x=>console.log(JSON.stringify(x));
export function checkToolchain(){
 if(process.version!=='v22.23.3')throw Error('B1_NODE_VERSION');
 for(const p of ['prisma','@prisma/client'])if(JSON.parse(fs.readFileSync('/opt/project/node_modules/'+p+'/package.json')).version!=='6.10.1')throw Error('B1_PRISMA_VERSION');
 for(const [f,h] of [['schema-engine','348b9e6f5c531d13a2cdb1e130b90306b8fe8d30cda879fbf22d21ea787f6244'],['libquery_engine.so.node','aef387b0b42412126048b637c502bd30ac32f696da402d39985f83ac95899544']])if(digest(fs.readFileSync('/opt/engines/'+f))!==h)throw Error('B1_ENGINE_INTEGRITY');
}
async function command(file,args,input,env,timeout=30000){return new Promise((resolve,reject)=>{
 const c=spawn(file,args,{cwd:'/work',env,stdio:['pipe','pipe','pipe']});let stdout='',stderr='',expired=false;
 const timer=setTimeout(()=>{expired=true;c.kill('SIGTERM');},timeout);
 c.stdout.on('data',b=>{stdout+=b;if(stdout.length>12000000){expired=true;c.kill('SIGTERM');}});c.stderr.on('data',b=>{stderr+=b;if(stderr.length>2000000){expired=true;c.kill('SIGTERM');}});
 c.stdin.on('error',()=>{});c.stdin.end(input);c.on('error',()=>{clearTimeout(timer);reject(Error('B1_CHILD_START_FAILED'));});c.on('close',code=>{clearTimeout(timer);if(expired)reject(Error('B1_CHILD_TIMEOUT_OR_OUTPUT_LIMIT'));else resolve({code,stdout,stderr});});
});}
export async function runB1(mode){
 if(!['verify','track-a'].includes(mode))throw Error('B1_MODE_REJECTED');rejectOverrides(process.env);checkToolchain();
 const manifest=fs.readFileSync(HERE+'/input-manifest.json');
 const read=p=>fs.readFileSync('/opt/b1-inputs/'+p.slice('inputs/'.length));
 const migrations=reviewedInputs(manifest,read);
 if(mode==='verify'){emit({kind:'gate1-runtime',passed:true,node:process.version,prisma:'6.10.1',revision:B1.revision,inputs:72,migrations:migrations.length});return;}
 const auth=authorization(JSON.parse(fs.readFileSync('/opt/b1-auth/authorization.json')));
 for(const f of auth.sourceHashes)if(digest(fs.readFileSync(HERE+'/'+f.file))!==f.sha256)throw Error('B1_RUNTIME_SOURCE_CHANGED');
 const gateBytes=fs.readFileSync('/opt/b1-auth/gate1.json');if(digest(gateBytes)!==auth.gate1SHA256)throw Error('B1_GATE1_CHANGED');const gate=JSON.parse(gateBytes);if(gate.passed!==true||JSON.stringify(gate.sourceHashes)!==JSON.stringify(auth.sourceHashes)||gate.manifest!==B1.manifest)throw Error('B1_GATE1_NOT_PASSED');
 let line='';for await(const b of process.stdin){line+=b;if(line.length>2048)throw Error('B1_CREDENTIAL_INPUT_LIMIT');if(line.includes('\n'))break;}
 const secret=credential(JSON.parse(line));line='';
 const base={PATH:'/opt/node/bin:/usr/bin:/bin',HOME:'/tmp',TMPDIR:'/tmp',PGHOST:'127.0.0.1',PGPORT:'5432',PGUSER:B1.role,PGPASSWORD:secret.password,PGCONNECT_TIMEOUT:'5',PGAPPNAME:'q03b1_'+auth.nonce};
 async function sql(name,db=B1.database){if(![B1.database,B1.baseline].includes(db)||name==='create'&&db!==B1.baseline||db===B1.baseline&&!['identity','create','closure'].includes(name))throw Error('B1_DATABASE_OPERATION_REJECTED');const q=name==='catalog'?CATALOG_SQL:fixedSQL(name);const r=await command('/usr/bin/psql',['--no-psqlrc','--no-password','--quiet','--tuples-only','--no-align','--set=ON_ERROR_STOP=1'],q,{...base,PGDATABASE:db,PGOPTIONS:`-c default_transaction_read_only=${name==='create'?'off':'on'} -c statement_timeout=15000 -c lock_timeout=3000`});if(r.code!==0)throw Error('B1_PSQL_'+name.toUpperCase()+'_FAILED:'+sanitize(r.stderr,secret.password));return r.stdout.trim();}
 const before=JSON.parse(await sql('identity',B1.baseline));identity(before);if(before.collision||before.objects!==0)throw Error('B1_COLLISION_OR_BASELINE_OBJECTS');emit({kind:'server-baseline',...before});
 // Copy only checksum-verified Prisma source; never project package/lifecycle scripts.
 for(const item of JSON.parse(String(manifest)).Files){const p=item.Path.replaceAll('\\','/');if(!p.startsWith('inputs/prisma/'))continue;const bytes=read(p);if(digest(bytes)!==item.SHA256)throw Error('B1_COPY_HASH_CHANGED');const dest='/work/project/'+p.slice('inputs/'.length);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes,{flag:'wx'});}
 await sql('create',B1.baseline);emit({kind:'database-created',database:B1.database});
 const target=JSON.parse(await sql('target'));if(target.database!==B1.database||target.role!==B1.role||target.owner!==B1.role||target.version!==180006||target.objects!==0)throw Error('B1_NEW_DATABASE_IDENTITY');emit({kind:'new-database',...target});
 const url=new URL('postgresql://127.0.0.1:5432/'+B1.database);url.username=B1.role;url.password=secret.password;url.searchParams.set('application_name','q03b1_'+auth.nonce);url.searchParams.set('connect_timeout','5');url.searchParams.set('options','-c statement_timeout=120000 -c lock_timeout=10000');
 const env={PATH:base.PATH,HOME:'/tmp',TMPDIR:'/tmp',DATABASE_URL:url.href,CHECKPOINT_DISABLE:'1',DO_NOT_TRACK:'1',PRISMA_HIDE_UPDATE_MESSAGE:'1',PRISMA_SKIP_POSTINSTALL_GENERATE:'1',PRISMA_SCHEMA_ENGINE_BINARY:'/opt/engines/schema-engine',PRISMA_QUERY_ENGINE_LIBRARY:'/opt/engines/libquery_engine.so.node'};
 const cli=['/opt/project/node_modules/prisma/build/index.js'];
 // Exactly one deploy invocation. Failure never invokes repair, resolve or retry.
 const result=await command('/opt/node/bin/node',[...cli,'migrate','deploy','--schema','/work/project/prisma/schema.prisma'],'',env,240000);
 emit({kind:'prisma-deploy',code:result.code,stdout:sanitize(result.stdout,secret.password),stderr:sanitize(result.stderr,secret.password)});
 const rows=await sql('ledgerExists')==='t'?JSON.parse(await sql('ledger')):[];
 emit({kind:'ledger',rows:JSON.parse(sanitize(JSON.stringify(rows),secret.password))});
 const catalog=JSON.parse(await sql('catalog'));emit({kind:'catalog',catalog});emit({kind:'tables',tables:JSON.parse(await sql('tables'))});
 const held=JSON.parse(await sql('held'));emit({kind:'held-enum',labels:held});
 assertLedger(rows,migrations,result.code===0);
 if(result.code!==0){emit({kind:'result',status:'MIGRATION_FAILED_STOP',finished:rows.filter(x=>x.finished).length,failed:rows.filter(x=>!x.finished).map(x=>x.name),automaticRetry:false});process.exitCode=2;return;}
 assertSafetyDefinitions(catalog,read('inputs/prisma/migrations/20261029000200_email_queue_safety_contract/migration.sql').toString());
 if(!held.includes('HELD')||Date.parse(rows.at(-2).finished)>Date.parse(rows.at(-1).started))throw Error('B1_HELD_COMMIT_ORDER');
 url.searchParams.set('options','-c default_transaction_read_only=on -c statement_timeout=30000');
 const diff=await command('/opt/node/bin/node',[...cli,'migrate','diff','--from-schema-datasource','/work/project/prisma/schema.prisma','--to-schema-datamodel','/work/project/prisma/schema.prisma','--script'],'',{...env,DATABASE_URL:url.href},60000);
 emit({kind:'schema-comparison',code:diff.code,stdout:sanitize(diff.stdout,secret.password),stderr:sanitize(diff.stderr,secret.password),applied:false});
 emit({kind:'result',status:diff.code===0?'REPLAY_COMPLETE_REVIEW_DIFF':'REPLAY_COMPLETE_DIFF_UNVERIFIED',finished:68,sqlProtectionsVerified:true,heldCommitBoundaryVerified:true,clientGenerated:false});
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])runB1(process.argv[2]).catch(()=>{emit({kind:'fatal',reasonCode:'B1_RUNNER_STOPPED_NO_RETRY'});process.exitCode=1;});
