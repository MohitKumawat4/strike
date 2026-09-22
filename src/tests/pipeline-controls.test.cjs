/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS loader hooks isolate external services in this offline test harness. */
/* Offline integration checks. AI, Gmail and WhatsApp are mocked; no messages are sent. */
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const Module = require('module');
const root = process.cwd();
const ts = require('typescript');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...args) { return resolve.call(this, request.startsWith('@/') ? path.join(root, 'src', request.slice(2)) : request, parent, ...args); };
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
let gmailMock, gmailSdkMock;
let aiCalls = 0, sends = [], gmailCalls = 0, routeDb, signedIn = true;
const load = Module._load;
Module._load = function(request, ...args) {
  if (request === '@/database/supabase/server') return { createSupabaseAdminClient: () => routeDb, createSupabaseServerClient: async () => ({ ...routeDb, auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'user-1' } : null }, error: null }) } }) };
  if (request === '@/common/logging/layer-logger') return { logLayerError: async () => {} };
  if (request === '@/modules/ai/prompts/triage') return { triageEmailWithAi: async () => { aiCalls++; return { result: { category: 'important', importance: .9, confidence: .9, reason: 'Test', summary_text: 'AI summary', extracted_items: [] }, model: 'test', promptVersion: 'test' }; } };
  if (request === '@/modules/ai/prompts/summary') return { summarizeEmailWithAi: async () => { aiCalls++; return { result: { summary_text: 'AI summary', extracted_items: [] }, model: 'test', promptVersion: 'test' }; } };
  if (request === '@/modules/whatsapp') return { sendStrikeEmailAlert: async (args) => { sends.push(args); } };
  if (request === '@/modules/whatsapp/templates') return { sendGreetings24hTemplate: async () => {} };
  if (request === '@/common/crypto/encryption') return { decryptToken: () => 'mock' };
  if (request === '@/modules/email/providers/gmail/gmail.client') return { createGmailGateway: () => { gmailCalls++; return gmailMock; }, getGoogleOAuthClient: () => ({setCredentials() {}}) };
  if (request === 'googleapis') return { google: { gmail: () => { gmailCalls++; if(gmailSdkMock) return gmailSdkMock; throw new Error('Paused ingestion must not call Gmail'); } } };
  return load.call(this, request, ...args);
};
function database(prefs = {}, message = {}) {
  const rows = { user_settings: [{ user_id:'user-1', notification_preferences: prefs, importance_threshold: .7, whatsapp_destination: '+1234567890' }], email_messages: [{ id:'message-1', user_id:'user-1', account_id:'account-1', provider_message_id:'gmail-1', sender:{raw:'Jamie <jamie@example.com>'}, recipients:[], subject:'Contract', body_text:'Please review the contract.\nOn Friday Jamie wrote:\nOld reply', received_at:new Date().toISOString(), processing_status:'RECEIVED', has_attachments:true, ...message }], ai_results:[], summaries:[], processing_jobs:[] };
  const db = { rows, from(table) {
    rows[table] ||= [];
    let action = 'select', values, filters = [], onlyOne = false, conflict;
    const q = {
      or() { return q; }, throwOnError() { return q; }, select() { return q; }, eq(k,v) { if(k === 'email_messages.user_id') { filters.push(r => rows.email_messages.some(m => m.id === r.message_id && m.user_id === v)); return q; } if(k === "notification_preferences" && typeof v === "string") v=JSON.parse(v); filters.push(r => JSON.stringify(r[k]) === JSON.stringify(v)); return q; },
      neq(k,v) { filters.push(r => r[k] !== v); return q; }, in(k,v) { filters.push(r => v.includes(r[k])); return q; },
      gte(k,v) { filters.push(r => r[k] >= v); return q; }, order() { return q; }, limit() { return q; },
      maybeSingle() { onlyOne = true; return q; }, single() { onlyOne = true; return q; },
      update(v) { action='update'; values=v; return q; }, upsert(v, opts) { action='upsert'; values=v; conflict=opts; return q; }, insert(v) { action='insert'; values=v; return q; },
      then(done, fail) { return Promise.resolve().then(() => {
        let selected = rows[table].filter(r => filters.every(f => f(r)));
        if (action === 'update') selected.forEach(r => Object.assign(r, values));
        if (action === 'upsert' || action === 'insert') {
          const keys = (conflict?.onConflict || 'message_id').split(',');
          const old = rows[table].find(r => keys.every(key => r[key] === values[key]));
          if (old) { if (!conflict?.ignoreDuplicates) Object.assign(old, values); selected=[old]; }
          else { const row={id: `row-${rows[table].length}`, ...values}; rows[table].push(row); selected=[row]; }
        }
        return { data: onlyOne ? selected[0] || null : selected, error:null };
      }).then(done, fail); },
    }; return q;
  }}; return db;
}
(async () => {
 const controls=require('../common/pipeline-controls.ts');
 const {saveUserSettings}=require('../database/user-settings.ts');
 const stages=require('../modules/processing/stages/index.ts');
 const db=database({pipeline:{...controls.DEFAULT_PIPELINE,use_ai:false,send_whatsapp:false}});
 const before=JSON.stringify(db.rows.email_messages);
 assert.equal((await stages.executeTriageStage(db,db.rows.email_messages[0])).nextStage,'delivery');
 assert.equal((await stages.executeDeliveryStage(db,db.rows.email_messages[0])).metadata.reason,'disabled');
 assert.equal(aiCalls,0);assert.equal(sends.length,0);
 assert.equal(JSON.stringify(db.rows.email_messages),before,'Stage handlers cannot mutate preceding outputs');
 const active=database({pipeline:controls.DEFAULT_PIPELINE});
 const triage=await stages.executeTriageStage(active,active.rows.email_messages[0]);
 assert.equal(triage.ai.category,'important');assert.equal(triage.nextStage,'delivery');assert.equal(active.rows.ai_results.length,0,'Outputs await transactional completion');
 const historical=database({}, {received_at:'2020-01-01T00:00:00Z'});
 assert.equal((await stages.executeTriageStage(historical,historical.rows.email_messages[0])).metadata.reason,'historical_ai_not_run');assert.equal(aiCalls,1);
 const notificationOff=database({pipeline:controls.DEFAULT_PIPELINE,notify_on_important:false});
 assert.equal((await stages.executeDeliveryStage(notificationOff,notificationOff.rows.email_messages[0])).metadata.reason,'disabled');
 const ready=database({pipeline:{...controls.DEFAULT_PIPELINE,use_ai:false}});
 const delivery=await stages.executeDeliveryStage(ready,ready.rows.email_messages[0]);
 assert.equal(delivery.messageStatus,'DELIVERY_PENDING');assert.ok(delivery.delivery.payload.rawPreviewText);assert.equal(sends.length,0,'Delivery stage only prepares outbox');
 const prefs=database({pipeline:{...controls.DEFAULT_PIPELINE,send_whatsapp:false},window_status:'OPEN'});
 assert.equal((await saveUserSettings(prefs,{user_id:'user-1',notification_preferences:{pipeline:controls.DEFAULT_PIPELINE}})).error,null);
 assert.ok(prefs.rows.user_settings[0].notification_preferences.deliver_after);assert.equal(prefs.rows.user_settings[0].notification_preferences.window_status,'OPEN');
 const {createClient}=require('@supabase/supabase-js');let updateUrl;
 const httpDb=createClient('https://example.supabase.co','test-key',{global:{fetch:async(url,init)=>{
  if(init.method==='PATCH'){updateUrl=new URL(url);return new Response(JSON.stringify([{user_id:'user-1'}]),{headers:{'Content-Type':'application/json'}});}
  return new Response(JSON.stringify({notification_preferences:{disable_processing:true}}),{headers:{'Content-Type':'application/json'}});
 }}});
 await saveUserSettings(httpDb,{user_id:'user-1',notification_preferences:{pipeline:controls.DEFAULT_PIPELINE}});
 assert.equal(JSON.parse(updateUrl.searchParams.get('notification_preferences').slice(3)).disable_processing,true);
 const {normalizeGmailMessage}=require('../modules/email/ingestion/coordinator.ts');
 assert.equal(normalizeGmailMessage({id:'1',internalDate:'1000',payload:{headers:[{name:'Subject',value:'A &amp; B'}]}}).subject,'A & B');
 gmailSdkMock={users:{messages:{get:async()=>{throw {response:{status:404}};}}}};
 const gateway=require(path.join(root,'src/modules/email/providers/gmail/gmail.client.ts')).createGmailGateway({});
 assert.equal((await gateway.getMessage('removed')).data,null);
 gmailSdkMock.users.messages.get=async()=>{throw {response:{status:403}};};await assert.rejects(()=>gateway.getMessage('forbidden'));
 const {isCronAuthorized,verifyPubSubRequest}=require('../common/security/integration-auth.ts');
 const savedSecret=process.env.CRON_SECRET;delete process.env.CRON_SECRET;
 assert.equal(isCronAuthorized(new Request('http://localhost')),false);process.env.CRON_SECRET='test-secret';
 assert.equal(isCronAuthorized(new Request('http://localhost',{headers:{authorization:'Bearer test-secret'}})),true);
 if(savedSecret)process.env.CRON_SECRET=savedSecret;else delete process.env.CRON_SECRET;
 assert.equal(await verifyPubSubRequest(new Request('http://localhost')),false);
 console.log('Application regression tests passed: settings HTTP serialization, resume cutoff, stage isolation, bypass reasons, outbox preparation, historical AI bypass, Gmail classification, fail-closed authentication.');
})().catch(error=>{console.error(error);process.exitCode=1;});
