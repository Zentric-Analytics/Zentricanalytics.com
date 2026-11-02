import assert from 'node:assert/strict';
import {id,literal} from './fixtures.mjs';
// Future disposable PostgreSQL only. Three independent sessions plus bounded observers.
// The controller owns an advisory gate; leader owns the queue row and waits on
// that gate; follower must be observed blocked by leader BEFORE gate release.
export function overlapQueries(name,leaderSQL,followerSQL,{interrupt=false}={}){
 if(!/^[a-z_]{1,32}$/.test(name))throw Error('INVALID_RACE_NAME');
 const tag=id(name),controller=tag+'_controller',leader=tag+'_leader',follower=tag+'_follower';
 const key=1960147000+[...name].reduce((a,c)=>a+c.charCodeAt(0),0);
 const settings=app=>`SET application_name=${literal(app)}; SET statement_timeout='20s'; SET lock_timeout='12s'; SET idle_in_transaction_session_timeout='15s';`;
 const active=(app)=>`(SELECT pid FROM pg_stat_activity WHERE application_name=${literal(app)} AND datname=current_database())`;
 const visible=`SELECT EXISTS (SELECT 1 FROM pg_locks WHERE pid=${active(controller)} AND locktype='advisory' AND granted);`;
 const chain=`${active(controller)}=ANY(pg_blocking_pids(${active(leader)})) AND ${active(leader)}=ANY(pg_blocking_pids(${active(follower)}))`;
 const control=`${settings(controller)} SELECT pg_advisory_lock(${key});
 DO $q03_overlap$ DECLARE deadline timestamptz:=clock_timestamp()+interval '8 seconds'; BEGIN
 LOOP PERFORM pg_stat_clear_snapshot(); IF (${chain}) IS TRUE THEN EXIT; END IF;
 IF clock_timestamp()>deadline THEN RAISE EXCEPTION 'Q03_OVERLAP_NOT_OBSERVED'; END IF;
 PERFORM pg_sleep(0.02); END LOOP; END $q03_overlap$;
 SELECT json_build_object('q03Overlap',true,'controller',${active(controller)},'leader',${active(leader)},'follower',${active(follower)},'chain',(${chain}));
 ${interrupt?`SELECT pg_cancel_backend(${active(leader)});`:''}
 SELECT pg_advisory_unlock(${key});`;
 return Object.freeze({visible,leaderVisible:`SELECT COALESCE(${active(controller)}=ANY(pg_blocking_pids(${active(leader)})),false);`,control,leader:`${settings(leader)} BEGIN; ${leaderSQL} SELECT pg_advisory_lock(${key}); SELECT pg_advisory_unlock(${key}); COMMIT;`,follower:`${settings(follower)} BEGIN; ${followerSQL} COMMIT;`,interrupt});
}
export function assertOverlap(proof){
 assert.equal(proof?.q03Overlap,true,'MISSING_OVERLAP_EVIDENCE');assert.equal(proof.chain,true,'NO_BLOCKING_CHAIN');
 const pids=[proof.controller,proof.leader,proof.follower];assert.ok(pids.every(x=>Number.isSafeInteger(x)&&x>0),'INVALID_SESSION_IDENTITIES');assert.equal(new Set(pids).size,3,'SESSIONS_NOT_INDEPENDENT');
}
export function jsonLine(text,key){const lines=String(text).split(/\r?\n/).filter(x=>x.trim().startsWith('{')).map(x=>JSON.parse(x));const found=lines.filter(x=>Object.hasOwn(x,key));assert.equal(found.length,1,'MISSING_OR_DUPLICATE_'+key);return found[0];}
export async function runOverlap(db,queries,{pollLimit=100,delay=()=>new Promise(r=>setTimeout(r,20))}={}){
 const tasks=[];const controller=db.sql(queries.control);tasks.push(controller);controller.catch(()=>{});
 try{
  let visible=false;
  for(let i=0;i<pollLimit;i++){if((await db.sql(queries.visible)).trim()==='t'){visible=true;break;}await delay();}
  assert.equal(visible,true,'CONTROLLER_LOCK_NOT_OBSERVED');
  const leader=db.sql(queries.leader);tasks.push(leader);leader.catch(()=>{});
  let leaderBlocked=false;
  for(let i=0;i<pollLimit;i++){if((await db.sql(queries.leaderVisible)).trim()==='t'){leaderBlocked=true;break;}await delay();}
  assert.equal(leaderBlocked,true,'LEADER_LOCK_NOT_OBSERVED');
  const follower=db.sql(queries.follower);tasks.push(follower);
  const result=await Promise.allSettled(tasks);
  for(const index of [0,2])if(result[index].status==='rejected')throw result[index].reason;
  const proof=jsonLine(result[0].value,'q03Overlap');assertOverlap(proof);
  if(queries.interrupt){assert.equal(result[1].status,'rejected','LEADER_NOT_INTERRUPTED');assert.match(result[1].reason.message,/canceling statement due to user request/,'WRONG_INTERRUPTION');}
  else if(result[1].status==='rejected')throw result[1].reason;
  return Object.freeze({proof,leader:queries.interrupt?null:jsonLine(result[1].value,'affected').affected,follower:jsonLine(result[2].value,'affected').affected});
 }finally{await Promise.allSettled(tasks);}
}
