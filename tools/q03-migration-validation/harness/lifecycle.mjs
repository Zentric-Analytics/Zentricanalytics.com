import {sanitize} from './config.mjs';
export async function bounded(promise,ms=2000){
 let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('CLEANUP_TIMEOUT')),ms);})]);}finally{clearTimeout(timer);}
}
export function lifecycle({listener,timeout=2000}={}){
 const sockets=new Set(),children=new Set();let closing;
 return Object.freeze({
  socket(s){if(closing)throw Error('LIFECYCLE_CLOSING');sockets.add(s);return s;},
  child(c){if(closing)throw Error('LIFECYCLE_CLOSING');children.add(c);return c;},
  close(){return closing??= (async()=>{
   const errors=[];
   for(const s of sockets){try{s.destroy();}catch{errors.push('SOCKET_CLOSE_FAILED');}}
   const operations=[...children].map(async c=>{
    await c.stop();if(await c.verifyStopped()!==true)throw Error('ORPHANED_FORWARDER');
   });
   if(listener)operations.push(Promise.resolve().then(()=>listener.close()));
   const results=await Promise.allSettled(operations.map(p=>bounded(p,timeout)));
   for(const r of results)if(r.status==='rejected')errors.push('LIFECYCLE_TERMINATION_UNPROVEN');
   if(errors.length)throw Error([...new Set(errors)].join(';'));
  })();}
 });
}
export async function runFinalized({execute,writeEvidence,close,secrets=[]}){
 let primary;const secondary=[];let value;
 try{value=await execute();}catch(e){primary=e;}
 try{await writeEvidence();}catch(e){secondary.push({stage:'evidence',error:sanitize(e.message,secrets)});}
 finally{try{await close();}catch(e){secondary.push({stage:'cleanup',error:sanitize(e.message,secrets)});}}
 if(primary||secondary.length){
  // Original cause stays in memory; CLI reports only sanitized fields.
  const error=new Error(primary?sanitize(primary.message,secrets):secondary[0].error,{cause:primary});
  error.primary=primary?sanitize(primary.message,secrets):null;error.secondary=Object.freeze(secondary.map(Object.freeze));throw error;
 }
 return value;
}
export function installInterruptionHandlers(emitter,close){
 let interrupted=false;const handler=()=>{interrupted=true;Promise.resolve().then(close).catch(()=>{});};
 emitter.on('SIGINT',handler);emitter.on('SIGTERM',handler);
 return Object.freeze({assertRunning(){if(interrupted)throw Error('EXECUTION_INTERRUPTED');},
  remove(){emitter.removeListener('SIGINT',handler);emitter.removeListener('SIGTERM',handler);}});
}
