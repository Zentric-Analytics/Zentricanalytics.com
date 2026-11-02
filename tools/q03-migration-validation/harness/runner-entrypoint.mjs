import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
if(process.argv[2]?.startsWith('a8-')){
 const deadline=setTimeout(()=>process.exit(124),35000);
 try{await (await import('./connectivity-proof.mjs')).runA8Connectivity(process.argv[2]);clearTimeout(deadline);process.exit(0);}
 catch(error){clearTimeout(deadline);console.log(JSON.stringify({kind:'failure',reason:/^A8_[A-Z_]+$/.test(error.message)?error.message:'A8_INTERNAL_FAILURE'}));process.exit(1);}
}
const require=createRequire('/opt/project/package.json');
const root='/opt/project/node_modules';
const engines='/opt/engines';
const clean={PATH:'/opt/node/bin:/usr/bin:/bin',HOME:'/tmp',TMPDIR:'/tmp',CHECKPOINT_DISABLE:'1',DO_NOT_TRACK:'1',PRISMA_HIDE_UPDATE_MESSAGE:'1',PRISMA_SKIP_POSTINSTALL_GENERATE:'1',PRISMA_SCHEMA_ENGINE_BINARY:engines+'/schema-engine',PRISMA_QUERY_ENGINE_LIBRARY:engines+'/libquery_engine.so.node'};
const timer=setTimeout(()=>process.exit(124),25000);
function run(file,args){return new Promise((resolve,reject)=>{const c=spawn(file,args,{env:clean,cwd:'/opt/project',stdio:['ignore','pipe','pipe']});let out='';const t=setTimeout(()=>{c.kill();reject(Error('OFFLINE_TOOL_TIMEOUT'));},10000);c.stdout.on('data',d=>{out+=d;if(out.length>65536){c.kill();reject(Error('OUTPUT_LIMIT'));}});c.stderr.resume();c.on('error',()=>{clearTimeout(t);reject(Error('OFFLINE_TOOL_START_FAILED'));});c.on('close',code=>{clearTimeout(t);if(code!==0)reject(Error('OFFLINE_TOOL_CHECK_FAILED'));else resolve(out.trim());});});}
try{
 const mode=process.argv[2];
 if(mode==='versions'){
  if(process.version!=='v22.23.3')throw Error('NODE_VERSION_MISMATCH');
  for(const [name,hash] of [['schema-engine','348b9e6f5c531d13a2cdb1e130b90306b8fe8d30cda879fbf22d21ea787f6244'],['libquery_engine.so.node','aef387b0b42412126048b637c502bd30ac32f696da402d39985f83ac95899544']])if(crypto.createHash('sha256').update(fs.readFileSync(engines+'/'+name)).digest('hex')!==hash)throw Error('LINUX_ENGINE_HASH_MISMATCH');
  for(const [name,version] of [['prisma','6.10.1'],['@prisma/client','6.10.1'],['typescript','5.8.3'],['vitest','4.1.11']])if(require(name+'/package.json').version!==version)throw Error('PACKAGE_VERSION_MISMATCH');
  const rollup=require('@rollup/rollup-linux-x64-gnu');if(typeof rollup.parse!=='function')throw Error('ROLLUP_NATIVE_LOAD_FAILED');
  const esbuild=await run(root+'/@esbuild/linux-x64/bin/esbuild',['--version']);if(esbuild!=='0.25.12')throw Error('ESBUILD_NATIVE_VERSION_MISMATCH');
  const query=require(engines+'/libquery_engine.so.node');if(typeof query.QueryEngine!=='function')throw Error('QUERY_LIBRARY_LOAD_FAILED');
  const schemaVersion=await run(engines+'/schema-engine',['--version']);if(!schemaVersion.includes('9b628578b3b7cae625e8c927178f15a170e74a9c'))throw Error('ENGINE_REVISION_MISMATCH');
  const prisma=await run('/opt/node/bin/node',[root+'/prisma/build/index.js','--version']);
  if(!prisma.includes('6.10.1')||!prisma.includes('debian-openssl-3.0.x'))throw Error('PRISMA_PLATFORM_MISMATCH');
  console.log(JSON.stringify({node:process.version,schemaVersion,queryLibraryLoaded:true,clientPackageVersion:require("@prisma/client/package.json").version,rollupLoaded:true,esbuild,prisma,typescript:await run('/opt/node/bin/node',[root+'/typescript/bin/tsc','--version']),vitest:await run('/opt/node/bin/node',[root+'/vitest/vitest.mjs','--version']),psql:await run('/usr/bin/psql',['--version']),databaseConnected:false}));
 }else if(mode==='lifecycle'){
  const child=spawn('/opt/node/bin/node',['-e','setInterval(()=>{},1000)'],{env:clean,stdio:'ignore'});
  console.log(JSON.stringify({mode,childPid:child.pid}));await new Promise(r=>setTimeout(r,20000));
  // Intentionally leave this synthetic child: namespace shutdown must contain it.
 }else throw Error('MODE_NOT_AUTHORIZED');
 clearTimeout(timer);
 // Parent exit exercises init/PID namespace teardown, including synthetic descendants.
 process.exit(0);
}catch{clearTimeout(timer);console.error('OFFLINE_RUNNER_CHECK_FAILED');process.exit(1);}
