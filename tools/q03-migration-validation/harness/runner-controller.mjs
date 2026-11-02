import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {RUN,ROOT,DOCKER,verifyInputs} from './config.mjs';
import {ENDPOINT,readPinnedManifest,validateEndpoint,dockerEnvironment,engineArguments} from './target-boundary.mjs';
import {executeProcess} from './runtime.mjs';
import {A8_IMAGE,A8_CONTAINER,A8_MODES,issueA8Capability,useA8Capability,assertA8Capability,expireA8Capability,rejectA8Overrides,validateA8Authorization,encodeDisposableCredential,a8SafeOutput} from './connectivity-proof.mjs';
const ID=/^[a-f0-9]{64}$/;
const issuedSpecs=new WeakSet();
export function runnerSpec(mode,imageId){
 if(!['versions','lifecycle'].includes(mode))throw Error('CONNECTIVITY_OR_MIGRATIONS_NOT_AUTHORIZED');
 if(!/^sha256:[a-f0-9]{64}$/.test(imageId))throw Error('RUNNER_IMAGE_NOT_PINNED');
 const spec=Object.freeze({name:`${RUN}-a7-${mode}`,run:RUN,unit:'Q03-A7',imageId,endpoint:ENDPOINT,
  network:'none',pid:'private',user:'65532:65532',readOnly:true,init:true,restart:'no',
  capabilities:Object.freeze(['ALL']),noNewPrivileges:true,publishedPorts:Object.freeze([]),
  tmpfs:Object.freeze(['/tmp','/work','/var/lib/postgresql']),snapshotSource:path.join(ROOT,'inputs'),mode,deadlineSeconds:30});issuedSpecs.add(spec);return spec;
}
export function assertRunnerIdentity(record,id,spec){
 if(!ID.test(id)||record?.Id!==id||record.Image!==spec.imageId
  ||record.Config?.Labels?.['zentric.q03.run']!==RUN||record.Config?.Labels?.['zentric.q03.unit']!==spec.unit
  ||record.HostConfig?.NetworkMode!==spec.network||!record.HostConfig?.ReadonlyRootfs
  ||record.HostConfig?.Privileged||!['','private'].includes(record.HostConfig?.PidMode??'')
  ||record.Config?.User!=='65532:65532'||record.HostConfig?.Init!==true
  ||JSON.stringify(record.Config?.Entrypoint)!==JSON.stringify(['/opt/node/bin/node',spec.entrypoint??'/opt/harness/runner-entrypoint.mjs'])||JSON.stringify(record.Config?.Cmd)!==JSON.stringify([spec.mode])
  ||record.HostConfig?.RestartPolicy?.Name!=='no'||!record.HostConfig?.CapDrop?.includes('ALL')
  ||record.HostConfig?.CapAdd?.length||record.HostConfig?.Devices?.length||record.HostConfig?.DeviceRequests?.length||record.HostConfig?.PublishAllPorts
  ||!record.HostConfig?.SecurityOpt?.some(x=>x==='no-new-privileges'||x==='no-new-privileges:true')
  ||Object.keys(record.HostConfig?.PortBindings??{}).length
  ||record.Mounts?.some(x=>x.Type==='volume'||x.Destination?.includes('docker.sock')||(x.Type==='bind'&&(x.RW||!((x.Destination==='/opt/harness/inputs'&&x.Source.replaceAll('\\','/').toLowerCase()===spec.snapshotSource.replaceAll('\\','/').toLowerCase())||(spec.unit==='Q03-A8'&&x.Destination==='/opt/harness'&&x.Source.replaceAll('\\','/').toLowerCase()===spec.runtimeSource.replaceAll('\\','/').toLowerCase()))))))throw Error('RUNNER_IDENTITY_OR_ISOLATION_MISMATCH');
 const tmpfs=record.HostConfig.Tmpfs??{};
 for(const p of spec.tmpfs)if(!Object.hasOwn(tmpfs,p))throw Error('RUNNER_TMPFS_MISSING');
 if(spec.unit==='Q03-A8'){
  for(const p of ['/opt/harness','/opt/harness/inputs'])if(!record.Mounts?.some(x=>x.Type==='bind'&&x.Destination===p&&!x.RW))throw Error('A8_REQUIRED_SOURCE_MOUNT_MISSING');
  if(record.HostConfig.Memory!==1073741824||record.HostConfig.NanoCpus!==2000000000||record.HostConfig.PidsLimit!==128)throw Error('A8_RESOURCE_LIMIT_MISMATCH');
 }
 return true;
}
export async function superviseRunner(driver,spec,{timeoutMs=45000,cleanupMs=15000,signal}={}){
 if(!issuedSpecs.has(spec))throw Error('RUNNER_SPEC_NOT_ISSUED');
 // Driver API must pin its Docker endpoint and must not accept arbitrary commands.
 let id,primary,exit;const secondary=[];let cleaned=false;
 const timers=new Set();
 const call=(fn,ms=cleanupMs)=>new Promise((resolve,reject)=>{const t=setTimeout(()=>{timers.delete(t);reject(Error('RUNNER_OPERATION_TIMEOUT'));},ms);timers.add(t);Promise.resolve().then(fn).then(v=>{clearTimeout(t);timers.delete(t);resolve(v);},e=>{clearTimeout(t);timers.delete(t);reject(e);});});
 let abort;const interrupted=new Promise((_,reject)=>{abort=()=>reject(Error('RUNNER_INTERRUPTED'));signal?.addEventListener('abort',abort,{once:true});});interrupted.catch(()=>{});
 async function inspect(){const r=await call(()=>driver.inspect(id));assertRunnerIdentity(r,id,spec);return r;}
 try{
  if(signal?.aborted)throw Error('RUNNER_INTERRUPTED');
  id=await call(()=>driver.create(spec));if(!ID.test(id))throw Error('RUNNER_ID_MISSING');
  if(signal?.aborted)throw Error('RUNNER_INTERRUPTED');
  await inspect();await Promise.race([call(()=>driver.start(id),timeoutMs),interrupted]);exit=await Promise.race([call(()=>driver.wait(id),timeoutMs),interrupted]);
  if(exit!==0)throw Error('RUNNER_NONZERO_EXIT');
 }catch(e){primary=e;}
 finally{
  signal?.removeEventListener('abort',abort);
  if(id&&ID.test(id)){
   try{
    let r=await inspect();
    if(r.State?.Running){try{await call(()=>driver.stop(id,10));}catch{await inspect();await call(()=>driver.kill(id));}}
    r=await inspect();if(r.State?.Running){await call(()=>driver.kill(id));r=await inspect();}
    if(r.State?.Running||r.State?.Pid!==0||r.survivingChildren?.length)throw Error('RUNNER_TERMINATION_UNPROVEN');
    await call(()=>driver.wait(id));
    cleaned=true;
   }catch{secondary.push('RUNNER_CLEANUP_FAILED');}
   // Diagnostic write failure never skips termination; it prevents evidence-less removal.
   let evidenceSaved=false;
   try{await call(()=>driver.evidence(Object.freeze({id,run:RUN,exit:exit??null,primary:primary?'RUNNER_EXECUTION_FAILED':null,primaryReason:primary&&/^[A-Z0-9_]+$/.test(primary.message)?primary.message:null,secondary:Object.freeze([...secondary]),terminationVerified:cleaned})));evidenceSaved=true;}
   catch{secondary.push('RUNNER_EVIDENCE_FAILED');}
   if(cleaned&&evidenceSaved){try{await inspect();await call(()=>driver.remove(id));}catch{secondary.push('RUNNER_REMOVAL_FAILED');}}
  }
  for(const timer of timers)clearTimeout(timer);
 }
 if(primary||secondary.length){const e=new Error(primary?'RUNNER_EXECUTION_FAILED':secondary[0],{cause:primary});e.secondary=Object.freeze(secondary);throw e;}
 return Object.freeze({id,exit,terminationVerified:cleaned});
}
export function localOfflineDriver(spec){
 if(!issuedSpecs.has(spec))throw Error('RUNNER_SPEC_NOT_ISSUED');
 const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'runner-artifact-manifest.json'),'utf8'));
 if(manifest.run!==RUN||manifest.imageId!==spec.imageId||manifest.connectivityAuthorized!==false)throw Error('RUNNER_ARTIFACT_NOT_APPROVED');
 if(!Array.isArray(manifest.sourceHashes)||!manifest.sourceHashes.length)throw Error('RUNNER_SOURCE_EVIDENCE_MISSING');
 for(const item of manifest.sourceHashes){if(path.basename(item.File)!==item.File||!(/\.(?:mjs|cjs)$/.test(item.File)||item.File==='runner.Dockerfile'))throw Error('UNSAFE_SOURCE_MANIFEST_PATH');if(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,item.File))).digest('hex').toUpperCase()!==item.SHA256.toUpperCase())throw Error('RUNNER_SOURCE_CHANGED');}
 const m=readPinnedManifest();let output='',ownedId;
 async function docker(args,contextOnly=false){const r=await executeProcess(DOCKER,contextOnly?args:engineArguments(args),{env:dockerEnvironment()});return r.stdout;}
 async function metadata(args){return JSON.parse(await docker(args));}
 async function preflight(){
  verifyInputs();validateEndpoint(JSON.parse(await docker(['context','inspect','desktop-linux'],true))[0]);
  // Deliberately exclude Config.Env: Q03-A7 must not consume the database credential.
  const format='{"Id":{{json .Id}},"Image":{{json .Image}},"Labels":{{json .Config.Labels}},"Running":{{json .State.Running}},"Ports":{{json .HostConfig.PortBindings}},"Mounts":{{json .Mounts}},"Networks":{{json .NetworkSettings.Networks}}}';
  const c=await metadata(['inspect',m.ContainerId,'--format',format]);
  const n=JSON.parse(await docker(['network','inspect',m.NetworkId]))[0],v=JSON.parse(await docker(['volume','inspect',m.VolumeName]))[0];
  if(c.Id!==m.ContainerId||c.Image!==m.ImageId||!c.Running||c.Labels?.['zentric.q03.run']!==RUN||Object.keys(c.Ports??{}).length||Object.keys(c.Networks??{}).length!==1||c.Networks?.[m.NetworkName]?.NetworkID!==m.NetworkId||c.Mounts?.length!==1||c.Mounts[0].Name!==m.VolumeName||c.Mounts[0].Destination!=='/var/lib/postgresql'||n.Id!==m.NetworkId||!n.Internal||n.Labels?.['zentric.q03.run']!==RUN||Object.keys(n.Containers??{}).length!==1||!n.Containers[m.ContainerId]||v.Name!==m.VolumeName||v.Labels?.['zentric.q03.run']!==RUN)throw Error('DATABASE_RESOURCE_METADATA_MISMATCH');
  const image=JSON.parse(await docker(['image','inspect',spec.imageId]))[0];
  if(image.Id!==spec.imageId||image.Os!=='linux'||image.Architecture!=='amd64'||image.Config.Labels?.['zentric.q03.run']!==RUN||image.Config.Labels?.['zentric.q03.role']!=='offline-runner')throw Error('RUNNER_IMAGE_MISMATCH');
 }
 const assertId=id=>{if(!ID.test(id)||id!==ownedId)throw Error('RUNNER_ID_NOT_OWNED');};
 async function guard(id){assertId(id);const record=JSON.parse(await docker(['inspect',id]))[0];assertRunnerIdentity(record,id,spec);return record;}
 return Object.freeze({
  async create(){if(ownedId)throw Error('RUNNER_ALREADY_CREATED');await preflight();const id=(await docker(['create','--pull','never','--name',spec.name,'--label',`zentric.q03.run=${RUN}`,'--label','zentric.q03.unit=Q03-A7','--network','none','--read-only','--user','65532:65532','--cap-drop','ALL','--security-opt','no-new-privileges','--init','--restart','no','--memory','1g','--cpus','2','--pids-limit','128','--tmpfs','/tmp:rw,noexec,nosuid,size=128m,mode=1777','--tmpfs','/work:rw,exec,nosuid,size=256m,mode=1777','--tmpfs','/var/lib/postgresql:rw,noexec,nosuid,size=1m','--mount',`type=bind,source=${path.join(ROOT,'inputs')},target=/opt/harness/inputs,readonly`,spec.imageId,spec.mode])).trim();if(!ID.test(id))throw Error('RUNNER_ID_MISSING');ownedId=id;return id;},
  async inspect(id){return guard(id);},
  async start(id){await guard(id);output=await docker(['start','--attach',id]);},
  async wait(id){await guard(id);const code=Number((await docker(['wait',id])).trim());if(!Number.isInteger(code))throw Error('INVALID_RUNNER_EXIT_CODE');return code;},
  async stop(id,seconds){await guard(id);if(seconds!==10)throw Error('STOP_BOUND_NOT_APPROVED');await docker(['stop','--time','10',id]);},
  async kill(id){await guard(id);await docker(['kill',id]);},
  async evidence(result){const text=JSON.stringify({result,output},null,2);fs.writeFileSync(path.join(ROOT,'a7-evidence',`${spec.mode}-${result.id}-controller.json`),text,{flag:'wx'});fs.writeFileSync(path.join(ROOT,'a7-evidence',spec.mode+'-controller.json'),text);},
  async remove(id){const r=await guard(id);if(r.State.Running||r.State.Pid!==0)throw Error('RUNNER_TERMINATION_UNPROVEN');await docker(['rm',id]);}
 });
}
export async function runLocalOffline(mode){
 const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'runner-artifact-manifest.json'),'utf8'));
 const spec=runnerSpec(mode,manifest.imageId),controller=new AbortController();
 const interrupt=()=>controller.abort();process.on('SIGINT',interrupt);process.on('SIGTERM',interrupt);
 try{return await superviseRunner(localOfflineDriver(spec),spec,{signal:controller.signal});}
 finally{process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);}
}

const a8Scopes=new WeakMap();
export function assertA8Mountpoint(info){if(info?.directory!==true||info.symbolicLink||info.entries!==0)throw Error('A8_READ_ONLY_CHILD_MOUNTPOINT_NOT_PREPARED');}
export function a8RunnerSpec(cap,mode,authorization){
 validateA8Authorization(authorization);useA8Capability(cap,mode);
 const spec=Object.freeze({name:`${RUN}-a8-${mode.slice(3)}-${authorization.sessionPrefix.slice(-6)}`,run:RUN,unit:'Q03-A8',imageId:A8_IMAGE,endpoint:ENDPOINT,network:`container:${A8_CONTAINER}`,pid:'private',user:'65532:65532',readOnly:true,init:true,restart:'no',tmpfs:Object.freeze(['/tmp','/work','/var/lib/postgresql']),snapshotSource:path.join(ROOT,'inputs'),runtimeSource:path.join(ROOT,'a8-runtime'),entrypoint:'/opt/harness/runner-entrypoint.mjs',mode,deadlineSeconds:35});
 issuedSpecs.add(spec);a8Scopes.set(spec,cap);return spec;
}
export function assertA8Target(m,c,n,v){
 if(m.ContainerId!==A8_CONTAINER||m.RunId!==RUN||c.Id!==A8_CONTAINER||c.Image!==m.ImageId||!c.Running||c.Labels?.['zentric.q03.run']!==RUN||c.Labels?.['zentric.q03.disposable']!=='true'||Object.keys(c.Ports??{}).length||Object.keys(c.Networks??{}).length!==1||c.Networks?.[m.NetworkName]?.NetworkID!==m.NetworkId||c.Mounts?.length!==1||c.Mounts[0].Type!=='volume'||c.Mounts[0].Name!==m.VolumeName||c.Mounts[0].Destination!=='/var/lib/postgresql'||n.Id!==m.NetworkId||!n.Internal||n.Labels?.['zentric.q03.run']!==RUN||Object.keys(n.Containers??{}).length!==1||!n.Containers[A8_CONTAINER]||v.Name!==m.VolumeName||v.Labels?.['zentric.q03.run']!==RUN)throw Error('A8_TARGET_IDENTITY_MISMATCH');
}
export function localA8Driver(spec){
 const cap=a8Scopes.get(spec);assertA8Capability(cap);
 if(!issuedSpecs.has(spec)||spec.unit!=='Q03-A8')throw Error('A8_SPEC_NOT_ISSUED');
 rejectA8Overrides(process.env);
 const auth=validateA8Authorization(JSON.parse(fs.readFileSync(path.join(ROOT,'a8-authorization.json'),'utf8')));
 let ownedId,output='',password,startupError='';
 const m=readPinnedManifest();
 async function docker(args,{context=false,input='',secret=false,allowFailure=false}={}){
  return executeProcess(DOCKER,context?args:engineArguments(args),{env:dockerEnvironment(),input,secrets:password?[password]:[],allowFailure});
 }
 function verifySources(){
  const mountpoint=path.join(spec.runtimeSource,'inputs');let stat;try{stat=fs.lstatSync(mountpoint);}catch{throw Error('A8_READ_ONLY_CHILD_MOUNTPOINT_NOT_PREPARED');}assertA8Mountpoint({directory:stat.isDirectory(),symbolicLink:stat.isSymbolicLink(),entries:stat.isDirectory()?fs.readdirSync(mountpoint).length:-1});
  if(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'runner-artifact-manifest.json'))).digest('hex').toUpperCase()!==auth.a7ManifestSHA256)throw Error('A8_A7_MANIFEST_CHANGED');
  if(!auth.gateARecordSHA256||crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'a8-evidence/gate-a.json'))).digest('hex').toUpperCase()!==auth.gateARecordSHA256)throw Error('A8_GATE_A_EVIDENCE_MISSING');
  const gate=JSON.parse(fs.readFileSync(path.join(ROOT,'a8-evidence/gate-a.json'),'utf8'));if(gate.passed!==true||gate.sourceFingerprint!==crypto.createHash('sha256').update(JSON.stringify(auth.sourceHashes)).digest('hex'))throw Error('A8_GATE_A_NOT_PASSED');
  for(const item of auth.sourceHashes){if(path.basename(item.File)!==item.File||!item.File.endsWith('.mjs'))throw Error('A8_UNSAFE_SOURCE_PATH');if(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,item.File))).digest('hex').toUpperCase()!==item.SHA256)throw Error('A8_SOURCE_CHANGED');}
  for(const file of ['config.mjs','target-boundary.mjs','connectivity-proof.mjs','runner-entrypoint.mjs']){const wanted=auth.sourceHashes.find(x=>x.File===file)?.SHA256;if(!wanted||crypto.createHash('sha256').update(fs.readFileSync(path.join(spec.runtimeSource,file))).digest('hex').toUpperCase()!==wanted)throw Error('A8_RUNTIME_COPY_CHANGED');}
  if(!fs.readFileSync(path.join(spec.runtimeSource,'a8-authorization.json')).equals(fs.readFileSync(path.join(ROOT,'a8-authorization.json'))))throw Error('A8_AUTHORIZATION_COPY_CHANGED');
 }
 async function preflight(){
  assertA8Capability(cap);verifySources();verifyInputs();
  validateEndpoint(JSON.parse((await docker(['context','inspect','desktop-linux'],{context:true})).stdout)[0]);
  const format='{"Id":{{json .Id}},"Image":{{json .Image}},"Labels":{{json .Config.Labels}},"Running":{{json .State.Running}},"Ports":{{json .HostConfig.PortBindings}},"Mounts":{{json .Mounts}},"Networks":{{json .NetworkSettings.Networks}}}';
  const c=JSON.parse((await docker(['inspect',A8_CONTAINER,'--format',format])).stdout),n=JSON.parse((await docker(['network','inspect',m.NetworkId])).stdout)[0],v=JSON.parse((await docker(['volume','inspect',m.VolumeName])).stdout)[0];assertA8Target(m,c,n,v);
  const image=JSON.parse((await docker(['image','inspect',A8_IMAGE])).stdout)[0];if(image.Id!==A8_IMAGE||image.Os!=='linux'||image.Architecture!=='amd64')throw Error('A8_PINNED_IMAGE_MISMATCH');
 }
 async function guard(id){if(!ID.test(id)||id!==ownedId)throw Error('A8_RUNNER_ID_NOT_OWNED');const r=JSON.parse((await docker(['inspect',id])).stdout)[0];fs.writeFileSync(path.join(ROOT,'a8-evidence',`configuration-${id}.json`),JSON.stringify({Id:r.Id,Image:r.Image,State:r.State,Config:{Labels:r.Config.Labels,User:r.Config.User,Entrypoint:r.Config.Entrypoint,Cmd:r.Config.Cmd},HostConfig:r.HostConfig,Mounts:r.Mounts},null,2));assertRunnerIdentity(r,id,spec);return r;}
 async function credential(){
  await preflight();
  const result=await docker(['inspect',A8_CONTAINER,'--format','{{json .Config.Env}}']);
  let entries;try{entries=JSON.parse(result.stdout);}catch{throw Error('A8_CREDENTIAL_READ_FAILED');}
  if(!Array.isArray(entries)||entries.filter(x=>x.startsWith('POSTGRES_PASSWORD=')).length!==1||!entries.includes('POSTGRES_DB=q03_disposable')||!entries.includes('POSTGRES_USER=q03_owner'))throw Error('A8_DISPOSABLE_CREDENTIAL_CONFIGURATION_INVALID');
  password=entries.find(x=>x.startsWith('POSTGRES_PASSWORD=')).slice('POSTGRES_PASSWORD='.length);
  return encodeDisposableCredential({run:RUN,username:'q03_owner',database:'q03_disposable',password}).toString('utf8');
 }
 function safeOutput(text){return a8SafeOutput(text,password);}
 return Object.freeze({
  async create(){if(ownedId)throw Error('A8_ALREADY_CREATED');await preflight();const args=['create','--pull','never','--interactive','--name',spec.name,'--label',`zentric.q03.run=${RUN}`,'--label','zentric.q03.unit=Q03-A8','--network',spec.network,'--read-only','--user','65532:65532','--cap-drop','ALL','--security-opt','no-new-privileges','--init','--restart','no','--memory','1g','--cpus','2','--pids-limit','128','--tmpfs','/tmp:rw,noexec,nosuid,size=128m,mode=1777','--tmpfs','/work:rw,exec,nosuid,size=256m,mode=1777','--tmpfs','/var/lib/postgresql:rw,noexec,nosuid,size=1m','--mount',`type=bind,source=${spec.snapshotSource},target=/opt/harness/inputs,readonly`,'--mount',`type=bind,source=${spec.runtimeSource},target=/opt/harness,readonly`,A8_IMAGE,spec.mode];const id=(await docker(args)).stdout.trim();if(!ID.test(id))throw Error('A8_CREATED_ID_MISSING');ownedId=id;fs.writeFileSync(path.join(ROOT,'a8-evidence',`${spec.mode}-${id}-id.txt`),id,{flag:'wx'});return id;},
  async inspect(id){return guard(id);},
  async start(id){try{await guard(id);const input=await credential();const result=await docker(['start','--attach','--interactive',id],{input,allowFailure:true});output=safeOutput(result.stdout);startupError=safeOutput(result.stderr);if(result.code!==0)throw Error('A8_RUNNER_PROCESS_FAILED');}catch(e){if(!startupError)startupError=safeOutput(e.message);throw e;}},
  async wait(id){await guard(id);return Number((await docker(['wait',id])).stdout.trim());},
  async stop(id,seconds){await guard(id);if(seconds!==10)throw Error('A8_STOP_BOUND_INVALID');await docker(['stop','--time','10',id]);},
  async kill(id){await guard(id);await docker(['kill',id]);},
  async logs(id){await guard(id);return safeOutput((await docker(['logs',id])).stdout);},
  async evidence(result){if(!output){try{output=safeOutput((await docker(['logs',ownedId])).stdout);}catch{output='[A8_LOGS_UNAVAILABLE]';}}fs.writeFileSync(path.join(ROOT,'a8-evidence',`${spec.mode}-${result.id}.json`),JSON.stringify({result,output,startupError},null,2),{flag:'wx'});password=undefined;},
  async remove(id){const r=await guard(id);if(r.State.Running||r.State.Pid!==0)throw Error('A8_TERMINATION_UNPROVEN');await docker(['rm',id]);}
 });
}
export async function runA8Suite(argv){
 const cap=issueA8Capability(argv),auth=validateA8Authorization(JSON.parse(fs.readFileSync(path.join(ROOT,'a8-authorization.json'),'utf8')));
 const results=[];let primary,closureFailure;
 try{
  const normal=a8RunnerSpec(cap,'a8-normal',auth);results.push(await superviseRunner(localA8Driver(normal),normal));
  const spec=a8RunnerSpec(cap,'a8-interrupt',auth),driver=localA8Driver(spec),abort=new AbortController();
  const wrapped={...driver,async start(id){const running=driver.start(id);running.catch(()=>{});for(let i=0;i<70;i++){const logs=await driver.logs(id);if(logs.includes('interruptReady')){abort.abort();return running;}if(logs.includes('"kind":"failure"'))throw Error('A8_INTERRUPT_PRECHECK_FAILED');await new Promise(r=>setTimeout(r,100));}abort.abort();throw Error('A8_INTERRUPT_READINESS_MISSING');}};
  try{await superviseRunner(wrapped,spec,{signal:abort.signal});throw Error('A8_EXPECTED_INTERRUPTION_MISSING');}catch(e){if(e.cause?.message!=='RUNNER_INTERRUPTED'||e.secondary?.length)throw e;results.push({mode:'a8-interrupt',expectedInterruption:true});}
 }catch(e){primary=e;}
 finally{
  try{const spec=a8RunnerSpec(cap,'a8-closure',auth);results.push(await superviseRunner(localA8Driver(spec),spec));}catch(e){closureFailure=e;}
  expireA8Capability(cap);
 }
 const result={unit:'Q03-A8',status:primary||closureFailure?'BLOCKED':'PASS',results,primary:primary?'A8_CONNECTIVITY_PROOF_FAILED':null,closureFailure:closureFailure?'A8_CLOSURE_VERIFICATION_FAILED':null};fs.writeFileSync(path.join(ROOT,'a8-evidence/result.json'),JSON.stringify(result,null,2));
 if(primary||closureFailure)throw Error(closureFailure?'A8_CLOSURE_VERIFICATION_FAILED':'A8_CONNECTIVITY_PROOF_FAILED');return result;
}
