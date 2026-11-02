const fs=require('node:fs'),path=require('node:path');
const log=path.join(__dirname,'tool-network-attempts.jsonl');
function deny(kind){return function(){fs.appendFileSync(log,JSON.stringify({blocked:kind})+'\n');throw Error('Unapproved tool network request');};}
for(const name of ['node:http','node:https']){const module=require(name);module.request=deny(name+'.request');module.get=deny(name+'.get');}
globalThis.fetch=deny('fetch');
// Prisma's checked native engines connect only to the injected loopback DATABASE_URL.
// These hooks block Node HTTP downloads; they are not an OS network sandbox for Rust.
