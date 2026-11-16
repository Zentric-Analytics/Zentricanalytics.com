import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { describe, it } from "./offline-test-api.mjs";
const schema=fs.readFileSync(new URL('../prisma/schema.prisma',import.meta.url),'utf8');
const contract=JSON.parse(fs.readFileSync(new URL('./fixtures/schema-contract-alignment.json',import.meta.url),'utf8'));
const model=(name:string)=>{const m=new RegExp('^model '+name+' \\{\\r?\\n([\\s\\S]*?)^\\}','m').exec(schema);assert.ok(m,'missing model '+name);return m[1];};
describe('Prisma representation preserves reviewed migration contracts',()=>{
 for(const row of contract.records){
  if(row.kind==='indexNaming')it(`${row.model}: retain index ${row.name}`,()=>{const lines=model(row.model).split('\n');const fields='['+row.fields.join(', ')+']';assert.ok(lines.some((l:string)=>l.includes(fields)&&l.includes('map: "'+row.name+'"')&&l.includes(row.unique?'@@unique':'@@index')));});
  if(row.kind==='foreignKeyRepresentation')it(`${row.model}: retain FK ${row.name}`,()=>{const line=model(row.model).split('\n').find((l:string)=>l.includes('map: "'+row.name+'"'));assert.ok(line);assert.ok(line.includes('fields: ['+row.fields.join(', ')+']'));assert.ok(line.includes('onDelete: '+row.onDelete));assert.ok(line.includes('onUpdate: '+row.onUpdate));});
  if(row.kind==='sqlOnlyForeignKey')it(`preserve SQL-only integrity boundary ${row.name}`,()=>{assert.ok(row.source.length);assert.ok(row.definition.startsWith('FOREIGN KEY'));assert.equal(row.decision,'PRESERVE_DATABASE_CONSTRAINT; not automatically expressible as an existing Prisma relation');});
  if(row.source?.length)it(`migration provenance for ${row.name}`,()=>{assert.ok(row.source.some((p:string)=>{const sql=fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');return [...sql.matchAll(/"([^"]+)"/g)].some(m=>m[1]===row.name||m[1].slice(0,63)===row.name);}));});
 }
 it('keeps both database timestamp defaults and Prisma update semantics',()=>{for(const name of ['Offer','EmploymentAgreement'])assert.match(model(name),/updatedAt\s+DateTime\s+@default\(now\(\)\)\s+@updatedAt/);});
 it('models nullable legacy payroll creator without permitting a fictitious non-null guarantee',()=>assert.match(model('HrPayrollPaymentBatch'),/createdById\s+String\?/));
 it('requires recruitment offer creator, matching the historical NOT NULL contract',()=>assert.match(model('HrRecruitmentOfferVersion'),/createdById\s+String\s*\r?\n/));
 it('retains the recruitment soft-delete lookup index',()=>assert.ok(model('JobApplication').includes('@@index([deletedAt], map: "JobApplication_deletedAt_idx")')));
 it('does not modify any reviewed historical migration bytes',()=>{const manifest=JSON.parse(fs.readFileSync(new URL('../tools/q03-migration-validation/harness/input-manifest.json',import.meta.url),'utf8'));let count=0;for(const item of manifest.Files){const p=item.Path.replaceAll('\\','/');if(!/\/migrations\/\d/.test(p))continue;const bytes=fs.readFileSync(new URL('../'+p.slice('inputs/'.length),import.meta.url));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),item.SHA256,p);count++;}assert.equal(count,68);});
});
