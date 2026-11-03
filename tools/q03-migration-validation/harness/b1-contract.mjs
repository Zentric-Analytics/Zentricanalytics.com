import crypto from 'node:crypto';
export const B1=Object.freeze({unit:'Q03-B1',run:'q03-20261030-1960147fab',database:'q03_1960147fab_track_a',role:'q03_owner',baseline:'q03_disposable',endpoint:'npipe:////./pipe/dockerDesktopLinuxEngine',container:'f877a874e84d45edbf1f3c5039d203b2080c1855369800ccd98a96544565f49f',network:'780a90881ec49f2567907a6da853c47210f95fb87397640383b88d40b167218c',networkName:'q03-20261030-1960147fab-net',volume:'q03-20261030-1960147fab-data',databaseImage:'sha256:86c951e05bf56c93d95d397747fb8820ac76cc3bedb78f43abd83eedbe3666ae',image:'sha256:efa8f09478536bb9a22ad8646a7b299d3300ecf65417b8bc25e4d57ff6122334',manifest:'96e8c1dbb306679f0fa8c1757ece3d2abf27f8afd138e908de919c1cdb0d2e28',revision:'9b628578b3b7cae625e8c927178f15a170e74a9c'});
export const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export function requireB1Arguments(args){if(!Array.isArray(args)||JSON.stringify(args)!==JSON.stringify(['--execute-q03-b1','--authorize-run',B1.run]))throw Error('B1_EXPLICIT_AUTHORIZATION_REQUIRED');}
export function inputPath(value){if(typeof value!=='string')throw Error('B1_INPUT_PATH_REJECTED');const p=value.replaceAll('\\','/');if(!/^inputs\/(?:prisma\/(?:schema\.prisma|migrations\/migration_lock\.toml|migrations\/\d{14}_[a-z0-9_]+\/migration\.sql)|security\/queue-transition-rules\.(?:mjs|d\.mts))$/.test(p))throw Error('B1_INPUT_PATH_REJECTED');return p;}
export function reviewedInputs(bytes,read){
 if(digest(bytes)!==B1.manifest)throw Error('B1_INPUT_MANIFEST_CHANGED');
 const m=JSON.parse(String(bytes).replace(/^\uFEFF/,''));if(m.RunId!==B1.run||m.Files.length!==72)throw Error('B1_INPUT_COUNT_MISMATCH');
 const seen=new Set();for(const f of m.Files){const p=inputPath(f.Path);if(seen.has(p)||digest(read(p))!==f.SHA256)throw Error('B1_INPUT_HASH_MISMATCH');seen.add(p);}
 const migrations=m.Files.filter(f=>/\/migrations\/\d/.test(inputPath(f.Path))).map(f=>({name:inputPath(f.Path).split('/')[3],checksum:f.SHA256})).sort((a,b)=>a.name.localeCompare(b.name));
 if(migrations.length!==68||migrations.at(-2).name!=='20261029000100_email_queue_held_enum'||migrations.at(-1).name!=='20261029000200_email_queue_safety_contract')throw Error('B1_MIGRATION_ORDER_MISMATCH');
 return Object.freeze(migrations.map(Object.freeze));
}
export function authorization(a,now=Date.now()){
 const keys=['unit','run','scope','database','image','container','sourceHashes','gate1SHA256','expiresAt','nonce'];
 if(!a||Object.getPrototypeOf(a)!==Object.prototype||Object.keys(a).sort().join('|')!==keys.sort().join('|')||a.unit!==B1.unit||a.run!==B1.run||a.scope!=='TRACK_A_ONLY'||a.database!==B1.database||a.image!==B1.image||a.container!==B1.container||!Number.isFinite(Date.parse(a.expiresAt))||Date.parse(a.expiresAt)<=now||Date.parse(a.expiresAt)>now+3600000||!/^[a-f0-9]{24}$/.test(a.nonce)||!/^[a-f0-9]{64}$/.test(a.gate1SHA256)||!Array.isArray(a.sourceHashes)||a.sourceHashes.length!==5)throw Error('B1_AUTHORIZATION_REJECTED');
 const names=new Set();for(const f of a.sourceHashes){if(!f||Object.keys(f).sort().join('|')!=='file|sha256'||!['b1-contract.mjs','b1-runner.mjs','b1-controller.mjs','config.mjs','evidence-rules.mjs'].includes(f.file)||names.has(f.file)||!/^[a-f0-9]{64}$/.test(f.sha256))throw Error('B1_SOURCE_BINDING_REJECTED');names.add(f.file);}return a;
}
export function rejectOverrides(env){for(const key of ['DATABASE_URL','DIRECT_URL','SHADOW_DATABASE_URL','PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGSERVICE','PGSERVICEFILE','DOCKER_HOST','DOCKER_CONTEXT','NODE_OPTIONS','RESEND_API_KEY','EMAIL_WORKER_SECRET'])if(Object.hasOwn(env,key))throw Error('B1_INHERITED_OVERRIDE_REJECTED');}
export function credential(input){if(!input||Object.keys(input).sort().join('|')!=='database|password|run|username'||input.run!==B1.run||input.username!==B1.role||input.database!==B1.baseline||typeof input.password!=='string'||input.password.length<16||input.password.length>512||/[\r\n\0]/.test(input.password))throw Error('B1_CREDENTIAL_ENVELOPE_REJECTED');return input;}
export function sanitize(text,password=''){let s=String(text);for(const p of [password,encodeURIComponent(password)].filter(Boolean))s=s.split(p).join('[REDACTED]');return s.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi,'[REDACTED_DATABASE_URL]');}
export function identity(row){if(row?.database!==B1.baseline||row.role!==B1.role||row.version!==180006||row.readOnly!=='on')throw Error('B1_SERVER_IDENTITY_REJECTED');}
export function assertLedger(rows,migrations,success){
 if(!Array.isArray(rows)||rows.length>68)throw Error('B1_LEDGER_INVALID');
 for(let i=0;i<rows.length;i++){const r=rows[i],m=migrations[i];if(r.name!==m.name||r.checksum!==m.checksum||r.rolledBack!==null||(i<rows.length-1&&!r.finished))throw Error('B1_LEDGER_ORDER_OR_CHECKSUM');}
 if(success&&(rows.length!==68||rows.some(r=>!r.finished)))throw Error('B1_LEDGER_INCOMPLETE');return true;
}
export function fixedSQL(name){
 const queries={
 identity:`SELECT json_build_object('database',current_database(),'role',current_user,'version',current_setting('server_version_num')::int,'readOnly',current_setting('transaction_read_only'),'collision',EXISTS(SELECT 1 FROM pg_database WHERE datname='${B1.database}'),'objects',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')));`,
 create:`CREATE DATABASE "${B1.database}" OWNER "${B1.role}";`,
 target:`SELECT json_build_object('database',current_database(),'role',current_user,'version',current_setting('server_version_num')::int,'owner',(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()),'objects',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')));`,
 ledgerExists:`SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL;`,
 ledger:`SELECT COALESCE(json_agg(row_to_json(x) ORDER BY x.started,x.name),'[]') FROM (SELECT migration_name AS name,checksum,started_at AS started,finished_at AS finished,rolled_back_at AS "rolledBack",applied_steps_count AS steps,logs FROM "_prisma_migrations") x;`,
 held:`SELECT COALESCE(json_agg(e.enumlabel ORDER BY e.enumsortorder),'[]') FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='HrOutboxStatus';`,
 tables:`SELECT COALESCE(json_agg(tablename ORDER BY tablename),'[]') FROM pg_tables WHERE schemaname='public';`,
 closure:`SELECT count(*) FROM pg_stat_activity WHERE application_name LIKE 'q03b1_%' AND pid<>pg_backend_pid();`
 };if(!Object.hasOwn(queries,name))throw Error('B1_SQL_NOT_APPROVED');return queries[name];
}
