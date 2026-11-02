import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
export const ROOT=path.dirname(fileURLToPath(import.meta.url));
export const WORKSPACE=path.dirname(ROOT);
export const RUN='q03-20261030-1960147fab';
export const PREFIX='q03_1960147fab';
export const DOCKER='C:/Users/worki/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
export const NODE='C:/Users/worki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe';
export const DATABASES=Object.freeze({A:`${PREFIX}_track_a`,B:`${PREFIX}_track_b`,F:`${PREFIX}_failure`});
export const NEW_MIGRATIONS=Object.freeze(['20261029000100_email_queue_held_enum','20261029000200_email_queue_safety_contract']);
export function manifest(){return JSON.parse(fs.readFileSync(path.join(WORKSPACE,'resource-manifest.json'),'utf8').replace(/^\uFEFF/,''));}
export function verifyInputs(){
 const bytes=fs.readFileSync(path.join(ROOT,'input-manifest.json'));
 if(crypto.createHash('sha256').update(bytes).digest('hex')!=='96e8c1dbb306679f0fa8c1757ece3d2abf27f8afd138e908de919c1cdb0d2e28')throw Error('INPUT_MANIFEST_CHANGED');
 const input=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
 if(input.RunId!==RUN||input.RepositoryHead!=='df6bb5ed872be23c0411d792fb610b59f06588b7'||input.Files.length!==72||new Set(input.Files.map(x=>x.Path)).size!==72)throw Error('INPUT_RUN_MISMATCH');
 for(const item of input.Files){const file=path.resolve(ROOT,item.Path);if(!file.startsWith(path.join(ROOT,'inputs')+path.sep))throw Error('UNSAFE_INPUT_PATH');
  if(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==item.SHA256)throw Error('INPUT_HASH_MISMATCH');}
 return input.Files.length;
}
export function assertIdentity(m,c,n,v){
 if(m.RunId!==RUN||m.ContainerId!=='f877a874e84d45edbf1f3c5039d203b2080c1855369800ccd98a96544565f49f'
  ||c.Id!==m.ContainerId||c.Image!==m.ImageId||!c.State.Running||c.Config.Labels?.['zentric.q03.run']!==RUN
  ||n.Id!==m.NetworkId||n.Labels?.['zentric.q03.run']!==RUN||!n.Internal
  ||Object.keys(n.Containers??{}).length!==1||!n.Containers?.[m.ContainerId]
  ||v.Name!==m.VolumeName||v.Labels?.['zentric.q03.run']!==RUN
  ||Object.keys(c.HostConfig.PortBindings??{}).length!==0||Object.keys(c.NetworkSettings.Networks).length!==1
  ||!c.NetworkSettings.Networks[m.NetworkName]||c.Mounts.length!==1||c.Mounts[0].Name!==m.VolumeName
  ||c.Mounts[0].Type!=='volume'||c.Mounts[0].Destination!=='/var/lib/postgresql')throw Error('RESOURCE_IDENTITY_OR_ISOLATION_MISMATCH');
 const env=new Map(c.Config.Env.map(s=>{const i=s.indexOf('=');return[s.slice(0,i),s.slice(i+1)];}));
 for(const key of ['DATABASE_URL','DIRECT_URL','RESEND_API_KEY','EMAIL_WORKER_SECRET','AWS_SECRET_ACCESS_KEY'])if(env.has(key))throw Error('UNEXPECTED_LIVE_CONFIGURATION');
 if(env.get('POSTGRES_DB')!=='q03_disposable'||env.get('POSTGRES_USER')!=='q03_owner'||!env.get('POSTGRES_PASSWORD'))throw Error('DISPOSABLE_CREDENTIAL_CONFIGURATION_MISMATCH');
 return env.get('POSTGRES_PASSWORD'); // memory only, never serialize/echo
}
export function assertDatabase(name){if(!Object.values(DATABASES).includes(name))throw Error('DATABASE_NOT_ALLOWLISTED');return name;}
const gates=new WeakSet();
export function executionGate(argv){if(argv.length!==3||argv[0]!=='--execute'||argv[1]!=='--authorize-run'||argv[2]!==RUN)throw Error('Q03B_EXPLICIT_AUTHORIZATION_REQUIRED');const gate=Object.freeze({run:RUN});gates.add(gate);return gate;}
export function requireGate(gate){if(!gates.has(gate))throw Error('EXECUTION_GATE_REQUIRED');}
export function cleanEnvironment(extra={}){
 const result={};for(const key of ['SystemRoot','WINDIR'])if(process.env[key])result[key]=process.env[key];
 Object.assign(result,{PATH:path.dirname(NODE),HOME:path.join(WORKSPACE,'home'),USERPROFILE:path.join(WORKSPACE,'home'),
  TEMP:path.join(WORKSPACE,'tmp'),TMP:path.join(WORKSPACE,'tmp'),LOCALAPPDATA:path.join(WORKSPACE,'home/AppData/Local'),
  APPDATA:path.join(WORKSPACE,'home/AppData/Roaming'),CHECKPOINT_DISABLE:'1',DO_NOT_TRACK:'1',PRISMA_HIDE_UPDATE_MESSAGE:'1',
  PRISMA_SKIP_POSTINSTALL_GENERATE:'1',NODE_DISABLE_COMPILE_CACHE:'1',PRISMA_SCHEMA_ENGINE_BINARY:path.join(WORKSPACE,'node_modules/@prisma/engines/schema-engine-windows.exe'),
  PRISMA_QUERY_ENGINE_LIBRARY:path.join(WORKSPACE,'node_modules/@prisma/engines/query_engine-windows.dll.node')},extra);
 return result;
}
export function sanitize(text,secrets=[]){let safe=String(text).replace(/postgres(?:ql)?:\/\/[^\s"']+/gi,'[REDACTED_DATABASE_URL]');for(const secret of secrets)if(secret)safe=safe.split(secret).join('[REDACTED]');return safe;}
export const TEST_SCOPE=Object.freeze({database:['CHECK/FK/unique/trigger execution','CAS transaction examples','migration replay and rollback'],
 runtime:['current policy/RBAC','credential validity and supersession','worker fencing/claim implementation','provider outcomes','exactly-once delivery'],
 authorization:'CLI flags are a safeguard, not owner approval. Q03-A3 does not authorize execution.'});
