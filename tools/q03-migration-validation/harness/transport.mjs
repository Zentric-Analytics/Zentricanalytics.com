import {requireGate} from './config.mjs';
import {readPinnedManifest,revalidateTarget,assertTarget} from './target-boundary.mjs';
export function requireTransportReadiness(){
 // Caller booleans cannot enable the unverified Bash/cat transport.
 throw Error('RELAY_LIFECYCLE_NOT_CERTIFIED');
}
export async function prepareTransportTarget(candidate,gate,inspect){
 requireGate(gate);const pinned=readPinnedManifest();assertTarget(candidate,pinned);
 if(typeof inspect!=='function')throw Error('INDEPENDENT_RESOURCE_INSPECTION_REQUIRED');
 return revalidateTarget(candidate,inspect,pinned);
}
export async function startLoopbackRelay(candidate,gate){
 requireGate(gate);assertTarget(candidate);requireTransportReadiness();
 // No listener/process implementation: a reviewed replacement is required.
}
