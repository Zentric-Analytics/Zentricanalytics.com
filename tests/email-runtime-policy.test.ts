import assert from 'node:assert/strict';
import {describe,it} from './offline-test-api.mjs';
import {evaluateRuntimeEmailPolicy as decide} from '../src/lib/email-runtime-policy.mjs';
const staging={RENDER:'true',IS_PULL_REQUEST:'false',RENDER_SERVICE_ID:'srv-d8s6ovvavr4c73fctksg',RENDER_SERVICE_TYPE:'web',RENDER_GIT_REPO_SLUG:'Zentric-Analytics/Zentricanalytics.com',RENDER_GIT_BRANCH:'dev',APP_ENV:'staging',APPLICATION_BASE_URL:'https://staging.zentricanalytics.com',STAGING_EMAIL_RECIPIENT_ALLOWLIST:'["tester@example.invalid"]'};
const production={...staging,RENDER_SERVICE_ID:'srv-d8s89fbeo5us73e7ljk0',RENDER_GIT_BRANCH:'main',APP_ENV:'production',APPLICATION_BASE_URL:'https://www.zentricanalytics.com'};
describe('server runtime email policy',()=>{
 it('permits only approved staging recipients',()=>{assert.equal(decide(staging,'tester@example.invalid').decision,'ALLOW');assert.equal(decide(staging,'other@example.invalid').decision,'HOLD');});
 it('production permits valid external business recipients independently of staging configuration',()=>assert.equal(decide({...production,STAGING_EMAIL_RECIPIENT_ALLOWLIST:'broken'},'candidate@gmail.com').decision,'ALLOW'));
 for(const key of ['RENDER','IS_PULL_REQUEST','RENDER_SERVICE_ID','RENDER_SERVICE_TYPE','RENDER_GIT_REPO_SLUG','RENDER_GIT_BRANCH','APP_ENV','APPLICATION_BASE_URL'])it('missing '+key+' fails closed',()=>assert.equal(decide({...production,[key]:undefined},'tester@example.invalid').decision,'CONFIGURATION_BLOCKED'));
 for(const [key,value]of [['RENDER_SERVICE_ID','srv-unknown'],['RENDER_SERVICE_TYPE','cron'],['RENDER_GIT_BRANCH','dev'],['APP_ENV','staging'],['IS_PULL_REQUEST','true'],['IS_PULL_REQUEST',''],['APPLICATION_BASE_URL','https://staging.zentricanalytics.com']])it('production conflict '+key+' never becomes staging',()=>assert.equal(decide({...production,[key]:value},'tester@example.invalid').decision,'CONFIGURATION_BLOCKED'));
 it('invalid recipients are not policy holds',()=>assert.equal(decide(staging,'invalid').decision,'INVALID_RECIPIENT'));
 for(const list of ['', '[]','{}','[null]','["invalid"]'])it('unusable staging list '+list+' blocks',()=>assert.equal(decide({...staging,STAGING_EMAIL_RECIPIENT_ALLOWLIST:list},'tester@example.invalid').decision,'CONFIGURATION_BLOCKED'));
 it('local/test never grants provider authority',()=>{for(const NODE_ENV of ['test','development'])assert.equal(decide({NODE_ENV,EMAIL_PROVIDER:'resend'},'tester@example.invalid').decision,'SIMULATED');});
 it('local labels cannot bypass a recognized protected service',()=>assert.equal(decide({NODE_ENV:'test',RENDER_SERVICE_ID:production.RENDER_SERVICE_ID},'tester@example.invalid').decision,'CONFIGURATION_BLOCKED'));
 it('request-like metadata is not used as identity',()=>assert.equal(decide({NODE_ENV:'production',host:production.APPLICATION_BASE_URL},'tester@example.invalid').decision,'CONFIGURATION_BLOCKED'));
 it('does not mutate configuration and returns immutable deterministic decisions',()=>{const env=Object.freeze({...staging});const a=decide(env,'tester@example.invalid');assert.deepEqual(a,decide(env,'tester@example.invalid'));assert.ok(Object.isFrozen(a));});
});
