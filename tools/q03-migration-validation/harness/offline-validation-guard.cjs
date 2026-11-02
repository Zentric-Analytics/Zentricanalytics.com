function deny(){throw Error('OFFLINE_VALIDATION_FORBIDDEN_API');}
for(const [name,keys]of [['node:http',['request','get']],['node:https',['request','get']],['node:net',['connect','createConnection']],['node:tls',['connect']],['node:child_process',['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork']]]){const m=require(name);for(const key of keys)m[key]=deny;}
require('node:net').Socket.prototype.connect=deny;globalThis.fetch=deny;
require('node:net').Server.prototype.listen=deny;
for(const key of ['connect','createSocket']){const name=key==='connect'?'node:http2':'node:dgram';require(name)[key]=deny;}
for(const key of ['lookup','resolve','resolve4','resolve6','reverse'])require('node:dns')[key]=deny;
require('node:module').syncBuiltinESMExports();
