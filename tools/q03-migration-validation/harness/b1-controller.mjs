import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
import {B1,digest,reviewedInputs,requireB1Arguments,authorization,rejectOverrides,credential,sanitize} from './b1-contract.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const EXTERNAL='C:/Users/worki/Documents/Codex/2026-10-25/ar/outputs/q03-20261030-1960147fab';
const OUTPUT=EXTERNAL+'/b1-20261102';
const DOCKER='C:/Users/worki/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const owned=new Set();
const modes=new Set(['verify','track-a']);
export function assertTarget(c,n,v,image){
 if(c.Id!==B1.container||c.Image!==B1.databaseImage||!c.State.Running||c.State.Paused||c.State.Restarting||c.State.Dead||c.Config.Labels?.['zentric.q03.run']!==B1.run||c.Config.Labels?.['zentric.q03.disposable']!=='true'||c.HostConfig.RestartPolicy.Name!=='no'||Object.keys(c.HostConfig.PortBindings??{}).length||c.HostConfig.PublishAllPorts||Object.keys(c.NetworkSettings.Networks).length!==1||c.NetworkSettings.Networks[B1.networkName]?.NetworkID!==B1.network||c.Mounts.length!==1||c.Mounts[0].Name!==B1.volume||c.Mounts[0].Type!=='volume'||c.Mounts[0].Destination!=='/var/lib/postgresql'||n.Id!==B1.network||!n.Internal||n.Labels?.['zentric.q03.run']!==B1.run||n.Labels?.['zentric.q03.disposable']!=='true'||Object.keys(n.Containers??{}).length!==1||!n.Containers[B1.container]||v.Name!==B1.volume||v.Driver!=='local'||v.Labels?.['zentric.q03.run']!==B1.run||v.Labels?.['zentric.q03.disposable']!=='true'||image.Id!==B1.image||image.Os!=='linux'||image.Architecture!=='amd64'||image.Config.User!=='65532:65532'||image.Config.Labels?.['zentric.q03.run']!==B1.run||image.Config.Labels?.['zentric.q03.role']!=='offline-runner')throw Error('B1_RESOURCE_IDENTITY_REJECTED');return true;
}
export function assertRunner(r,id,mode,nonce){
 if(!/^[a-f0-9]{64}$/.test(id)||r.Id!==id||!modes.has(mode)||!/^[a-f0-9]{24}$/.test(nonce)||r.Image!==B1.image||r.Config.Labels?.['zentric.q03.run']!==B1.run||r.Config.Labels?.['zentric.q03.unit']!==B1.unit||r.Config.Labels?.['zentric.q03.nonce']!==nonce||r.Config.User!=='65532:65532'||JSON.stringify(r.Config.Entrypoint)!==JSON.stringify(['/opt/node/bin/node'])||JSON.stringify(r.Config.Cmd)!==JSON.stringify(['/opt/b1/b1-runner.mjs',mode])||r.HostConfig.NetworkMode!==(mode==='verify'?'none':'container:'+B1.container)||r.HostConfig.Privileged||!['','private'].includes(r.HostConfig.PidMode??'')||!r.HostConfig.ReadonlyRootfs||!r.HostConfig.Init||r.HostConfig.RestartPolicy.Name!=='no'||r.HostConfig.Memory!==1073741824||r.HostConfig.NanoCpus!==2000000000||r.HostConfig.PidsLimit!==128||JSON.stringify(r.HostConfig.CapDrop)!==JSON.stringify(['ALL'])||!r.HostConfig.SecurityOpt?.some(x=>x==='no-new-privileges'||x==='no-new-privileges:true')||r.HostConfig.CapAdd?.length||r.HostConfig.Devices?.length||r.HostConfig.DeviceRequests?.length||r.HostConfig.PublishAllPorts||Object.keys(r.HostConfig.PortBindings??{}).length)throw Error('B1_RUNNER_ISOLATION_REJECTED');
 const expected=new Map([['/opt/b1',HERE],['/opt/b1-inputs',HERE+'/inputs'],['/opt/b1-auth',OUTPUT+'/auth']]);
 if(r.Mounts.length!==3||new Set(r.Mounts.map(m=>m.Destination)).size!==3)throw Error('B1_RUNNER_MOUNT_REJECTED');
 for(const m of r.Mounts)if(m.Type!=='bind'||m.RW||!expected.has(m.Destination)||m.Source.replaceAll('\\','/').toLowerCase()!==expected.get(m.Destination).replaceAll('\\','/').toLowerCase())throw Error('B1_RUNNER_MOUNT_REJECTED');
 for(const p of ['/tmp','/work','/var/lib/postgresql'])if(!Object.hasOwn(r.HostConfig.Tmpfs??{},p))throw Error('B1_TMPFS_REQUIRED');
 if(Object.keys(r.HostConfig.Tmpfs).length!==3)throw Error('B1_UNEXPECTED_TMPFS');
 if(r.Config.Env?.some(x=>/^(DATABASE_URL|DIRECT_URL|PGPASSWORD|POSTGRES_PASSWORD|RESEND_API_KEY|EMAIL_WORKER_SECRET)=/.test(x)))throw Error('B1_DOCKER_SECRET_ENV_REJECTED');return true;
}
async function docker(args,{input='',timeout=30000}={}){return new Promise((resolve,reject)=>{
 const env={SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,PATH:path.dirname(DOCKER),USERPROFILE:'C:/Users/worki',HOME:'C:/Users/worki'};
 const c=spawn(DOCKER,['--host',B1.endpoint,...args],{env,windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='',expired=false;
 const timer=setTimeout(()=>{expired=true;c.kill();},timeout);
 c.stdout.on('data',b=>{stdout+=b;if(stdout.length>16000000){expired=true;c.kill();}});c.stderr.on('data',b=>{stderr+=b;if(stderr.length>4000000){expired=true;c.kill();}});
 c.stdin.on('error',()=>{});c.stdin.end(input);c.on('error',()=>{clearTimeout(timer);reject(Error('B1_DOCKER_COMMAND_START_FAILED'));});c.on('close',code=>{clearTimeout(timer);if(expired)reject(Error('B1_DOCKER_TIMEOUT_OR_OUTPUT_LIMIT'));else resolve({code,stdout,stderr});});
});}
async function json(args){const r=await docker(args);if(r.code!==0)throw Error('B1_DOCKER_INSPECTION_FAILED');return JSON.parse(r.stdout);}
export function verifyHostInputs(){
 const base=fs.realpathSync(HERE+'/inputs');
 return reviewedInputs(fs.readFileSync(HERE+'/input-manifest.json'),p=>{const f=path.join(HERE,p);if(!fs.realpathSync(f).startsWith(base+path.sep)||fs.lstatSync(f).isSymbolicLink())throw Error('B1_INPUT_SYMLINK_REJECTED');return fs.readFileSync(f);});
}
async function target(){
 const c=(await json(['inspect',B1.container]))[0],n=(await json(['network','inspect',B1.network]))[0],v=(await json(['volume','inspect',B1.volume]))[0],image=(await json(['image','inspect',B1.image]))[0];assertTarget(c,n,v,image);
 return {c,n,v,image}; // Includes private Env in memory only. Never serialize this object.
}
export async function superviseB1(driver,{timeout=360000,signal}={}){
 let id,primary,cleanupError,output;let timer,abort;
 const interruption=new Promise((_,reject)=>{abort=()=>reject(Error('B1_INTERRUPTED'));signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();});interruption.catch(()=>{});
 try{if(signal?.aborted)throw Error('B1_INTERRUPTED');id=await driver.create();if(!/^[a-f0-9]{64}$/.test(id))throw Error('B1_CREATED_ID_INVALID');await driver.guard(id);
  if(signal?.aborted)throw Error('B1_INTERRUPTED');output=await Promise.race([driver.start(id),interruption,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('B1_RUNNER_DEADLINE')),timeout);})]);
 }catch(e){primary=e;if(!id&&/^[a-f0-9]{64}$/.test(e.createdId??''))id=e.createdId;}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);
  if(id&&/^[a-f0-9]{64}$/.test(id))try{
   let r=await driver.guard(id);if(r.State.Running){try{await driver.stop(id);}catch{/* Reinspect exact ownership before bounded forced termination. */}r=await driver.guard(id);if(r.State.Running){await driver.kill(id);r=await driver.guard(id);}}
   if(r.State.Running||r.State.Pid!==0)throw Error('B1_TERMINATION_UNPROVEN');
   await driver.evidence(id,{primary:primary?.message??null,terminationVerified:true,exit:r.State.ExitCode});await driver.remove(id);if(await driver.exists(id))throw Error('B1_REMOVAL_UNPROVEN');
  }catch(e){cleanupError=e;}
 }
 if(cleanupError)throw Error('B1_CLEANUP_FAILED');if(primary)throw primary;return output;
}
async function runner(mode,nonce,signal){
 if(!modes.has(mode))throw Error('B1_MODE_REJECTED');let password='',lastOutput='',lastError='',imageEnv;
 const guard=async id=>{if(!owned.has(id))throw Error('B1_RUNNER_NOT_OWNED');const r=(await json(['inspect',id]))[0];assertRunner(r,id,mode,nonce);if(JSON.stringify(r.Config.Env)!==JSON.stringify(imageEnv))throw Error('B1_RUNNER_IMAGE_ENV_CHANGED');return r;};
 const driver={
  async create(){verifyHostInputs();const original=await target();imageEnv=original.image.Config.Env;const args=['create','--pull','never','--interactive','--name',B1.run+'-b1-'+mode+'-'+nonce,'--label','zentric.q03.run='+B1.run,'--label','zentric.q03.unit='+B1.unit,'--label','zentric.q03.nonce='+nonce,'--network',mode==='verify'?'none':'container:'+B1.container,'--read-only','--user','65532:65532','--cap-drop','ALL','--security-opt','no-new-privileges','--init','--restart','no','--memory','1g','--cpus','2','--pids-limit','128','--tmpfs','/tmp:rw,noexec,nosuid,size=128m,mode=1777','--tmpfs','/work:rw,exec,nosuid,size=512m,mode=1777','--tmpfs','/var/lib/postgresql:rw,noexec,nosuid,size=1m','--mount',`type=bind,source=${HERE},target=/opt/b1,readonly`,'--mount',`type=bind,source=${HERE}/inputs,target=/opt/b1-inputs,readonly`,'--mount',`type=bind,source=${OUTPUT}/auth,target=/opt/b1-auth,readonly`,'--entrypoint','/opt/node/bin/node',B1.image,'/opt/b1/b1-runner.mjs',mode];const r=await docker(args);if(r.code!==0)throw Error('B1_CREATE_FAILED');const id=r.stdout.trim();if(!/^[a-f0-9]{64}$/.test(id))throw Error('B1_CREATED_ID_INVALID');owned.add(id);try{fs.writeFileSync(OUTPUT+'/'+mode+'-'+id+'-id.txt',id,{flag:'wx'});}catch{const e=Error('B1_ID_EVIDENCE_WRITE_FAILED');e.createdId=id;throw e;}return id;},
  guard,
  async start(id){await guard(id);let input='';
   if(mode==='track-a'){
    const a=authorization(JSON.parse(fs.readFileSync(OUTPUT+'/auth/authorization.json')));for(const f of a.sourceHashes)if(digest(fs.readFileSync(HERE+'/'+f.file))!==f.sha256)throw Error('B1_SOURCE_CHANGED');
    const t=await target(),entries=t.c.Config.Env;
    if(!Array.isArray(entries)||entries.filter(x=>x.startsWith('POSTGRES_PASSWORD=')).length!==1||!entries.includes('POSTGRES_USER='+B1.role)||!entries.includes('POSTGRES_DB='+B1.baseline)||entries.some(x=>/^(DATABASE_URL|DIRECT_URL|RESEND_API_KEY|EMAIL_WORKER_SECRET)=/.test(x)))throw Error('B1_DISPOSABLE_SECRET_CONFIG_REJECTED');
    password=entries.find(x=>x.startsWith('POSTGRES_PASSWORD=')).slice(18);const e=credential({run:B1.run,database:B1.baseline,username:B1.role,password});input=JSON.stringify(e)+'\n';
   }
   const result=await docker(['start','--attach','--interactive',id],{input,timeout:330000});lastOutput=sanitize(result.stdout,password);lastError=sanitize(result.stderr,password);return {code:result.code,stdout:lastOutput,stderr:lastError};
  },
  async stop(id){await guard(id);const r=await docker(['stop','--time','10',id]);if(r.code!==0)throw Error('B1_STOP_FAILED');},
  async kill(id){await guard(id);const r=await docker(['kill',id]);if(r.code!==0)throw Error('B1_KILL_FAILED');},
  async evidence(id,record){if(!lastOutput){const r=await docker(['logs',id]);lastOutput=sanitize(r.stdout,password);lastError=sanitize(r.stderr,password);}fs.writeFileSync(OUTPUT+'/'+mode+'-result.json',JSON.stringify({id,...record,stdout:lastOutput,stderr:lastError},null,2),{flag:'wx'});password='';},
  async remove(id){const r=await guard(id);if(r.State.Running||r.State.Pid!==0)throw Error('B1_TERMINATION_UNPROVEN');const d=await docker(['rm',id]);if(d.code!==0)throw Error('B1_REMOVE_FAILED');},
  async exists(id){if(!owned.has(id))throw Error('B1_RUNNER_NOT_OWNED');const r=await docker(['ps','-a','--no-trunc','--format','{{.ID}}']);if(r.code!==0)throw Error('B1_REMOVAL_CHECK_FAILED');return r.stdout.split(/\r?\n/).includes(id);}
 };return superviseB1(driver,{signal});
}
export async function main(args){
 requireB1Arguments(args);rejectOverrides(process.env);verifyHostInputs();if(fs.existsSync(OUTPUT+'/execution-started.json'))throw Error('B1_EXECUTION_ALREADY_STARTED_NO_RETRY');
 const offline=JSON.parse(fs.readFileSync(OUTPUT+'/offline-gate.json'));const files=['b1-contract.mjs','b1-runner.mjs','b1-controller.mjs','config.mjs','evidence-rules.mjs'];const sourceHashes=files.map(file=>({file,sha256:digest(fs.readFileSync(HERE+'/'+file))}));
 if(offline.passed!==true||offline.fingerprint!==digest(JSON.stringify(sourceHashes)))throw Error('B1_OFFLINE_GATE_NOT_PASSED');
 fs.mkdirSync(OUTPUT+'/auth',{recursive:true});const nonce=crypto.randomBytes(12).toString('hex');const abort=new AbortController(),interrupt=()=>abort.abort();process.on('SIGINT',interrupt);process.on('SIGTERM',interrupt);
 try{
 const preflight=await runner('verify',nonce,abort.signal);if(preflight.code!==0)throw Error('B1_RUNTIME_PREFLIGHT_FAILED');const record=JSON.parse(preflight.stdout.trim());if(record.kind!=='gate1-runtime'||record.passed!==true||record.revision!==B1.revision)throw Error('B1_RUNTIME_PREFLIGHT_INVALID');
 const gate=JSON.stringify({passed:true,manifest:B1.manifest,sourceHashes,runtime:record,offline});fs.writeFileSync(OUTPUT+'/auth/gate1.json',gate,{flag:'wx'});
 const auth=authorization({unit:B1.unit,run:B1.run,scope:'TRACK_A_ONLY',database:B1.database,image:B1.image,container:B1.container,sourceHashes,gate1SHA256:digest(gate),expiresAt:new Date(Date.now()+1800000).toISOString(),nonce});fs.writeFileSync(OUTPUT+'/auth/authorization.json',JSON.stringify(auth),{flag:'wx'});
 // Durable host marker is never removed automatically; prevents blind resumption after crash.
 fs.writeFileSync(OUTPUT+'/execution-started.json',JSON.stringify({unit:B1.unit,nonce,database:B1.database,at:new Date().toISOString()}),{flag:'wx'});
 const result=await runner('track-a',nonce,abort.signal);console.log(JSON.stringify({unit:B1.unit,gate1:'PASS',exit:result.code,evidence:OUTPUT}));if(result.code!==0)process.exitCode=2;
 }finally{process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])main(process.argv.slice(2)).catch(()=>{console.error('B1_STOPPED_NO_RETRY_SEE_SANITIZED_EVIDENCE');process.exitCode=1;});
