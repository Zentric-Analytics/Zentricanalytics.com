import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {WORKSPACE, RUN, assertIdentity, cleanEnvironment} from './config.mjs';
export const ENDPOINT='npipe:////./pipe/dockerDesktopLinuxEngine';
export const CONTEXT='desktop-linux';
const MANIFEST_HASH='f8f7b652e70d759cb284f361c787b4a95a54fc2787fb5022c99affdbdfd37a66';
const CONTAINER='f877a874e84d45edbf1f3c5039d203b2080c1855369800ccd98a96544565f49f';
export function readPinnedManifest(){
 const bytes=fs.readFileSync(path.join(WORKSPACE,'resource-manifest.json'));
 if(crypto.createHash('sha256').update(bytes).digest('hex')!==MANIFEST_HASH)throw Error('RESOURCE_MANIFEST_CHANGED');
 return Object.freeze(JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,'')));
}
export function validateEndpoint(context){
 if(!context||context.Name!==CONTEXT||context.Endpoints?.docker?.Host!==ENDPOINT||context.Endpoints?.docker?.SkipTLSVerify!==false)
  throw Error('DOCKER_ENDPOINT_NOT_APPROVED');
 return ENDPOINT;
}
export function dockerEnvironment(){return Object.freeze(cleanEnvironment({USERPROFILE:'C:/Users/worki',HOME:'C:/Users/worki'}));}
export function engineArguments(args){return ['--host',ENDPOINT,...args];}
export function assertTarget(candidate,pinned=readPinnedManifest()){
 if(!candidate||!Object.isFrozen(candidate)||Reflect.ownKeys(candidate).some(k=>typeof k!=='string'||!Object.hasOwn(pinned,k))
  ||Object.keys(pinned).some(k=>{const d=Object.getOwnPropertyDescriptor(candidate,k);return !d||!Object.hasOwn(d,'value')||d.value!==pinned[k];})
  ||candidate.RunId!==RUN||candidate.ContainerId!==CONTAINER)throw Error('TRANSPORT_TARGET_NOT_PINNED');
 return pinned;
}
export async function revalidateTarget(candidate,inspect,pinned=readPinnedManifest()){
 assertTarget(candidate,pinned);
 validateEndpoint(await inspect(['context','inspect',CONTEXT],true));
 const c=await inspect(['inspect',CONTAINER]);
 const n=await inspect(['network','inspect',pinned.NetworkId]);
 const v=await inspect(['volume','inspect',pinned.VolumeName]);
 assertIdentity(pinned,c,n,v);
 return Object.freeze({containerId:CONTAINER,endpoint:ENDPOINT,run:RUN});
}
