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
let aiCalls = 0, sends = [], gmailCalls = 0, routeDb, signedIn = true;
const load = Module._load;
Module._load = function(request, ...args) {
  if (request === '@/database/supabase/server') return { createSupabaseServerClient: async () => ({ ...routeDb, auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'user-1' } : null }, error: null }) } }) };
  if (request === '@/common/logging/layer-logger') return { logLayerError: async () => {} };
  if (request === '@/modules/ai/prompts/triage') return { triageEmailWithAi: async () => { aiCalls++; return { result: { category: 'important', importance: .9, confidence: .9, reason: 'Test', summary_text: 'AI summary', extracted_items: [] }, model: 'test', promptVersion: 'test' }; } };
  if (request === '@/modules/ai/prompts/summary') return { summarizeEmailWithAi: async () => { aiCalls++; return { result: { summary_text: 'AI summary', extracted_items: [] }, model: 'test', promptVersion: 'test' }; } };
  if (request === '@/modules/whatsapp') return { sendStrikeEmailAlert: async (args) => { sends.push(args); } };
  if (request === '@/modules/whatsapp/templates') return { sendGreetings24hTemplate: async () => {} };
  if (request === '@/common/crypto/encryption') return { decryptToken: () => 'mock' };
  if (request === '@/modules/email/providers/gmail/gmail.client') return { getGoogleOAuthClient: () => ({setCredentials() {}}) };
  if (request === 'googleapis') return { google: { gmail: () => { gmailCalls++; throw new Error('Paused ingestion must not call Gmail'); } } };
  return load.call(this, request, ...args);
};
function database(prefs = {}, message = {}) {
  const rows = { user_settings: [{ user_id:'user-1', notification_preferences: prefs, importance_threshold: .7, whatsapp_destination: '+1234567890' }], email_messages: [{ id:'message-1', user_id:'user-1', account_id:'account-1', provider_message_id:'gmail-1', sender:{raw:'Jamie <jamie@example.com>'}, recipients:[], subject:'Contract', body_text:'Please review the contract.\nOn Friday Jamie wrote:\nOld reply', received_at:new Date().toISOString(), processing_status:'RECEIVED', has_attachments:true, ...message }], ai_results:[], summaries:[], processing_jobs:[] };
  const db = { rows, from(table) {
    rows[table] ||= [];
    let action = 'select', values, filters = [], onlyOne = false, conflict;
    const q = {
      select() { return q; }, eq(k,v) { filters.push(r => JSON.stringify(r[k]) === JSON.stringify(v)); return q; },
      neq(k,v) { filters.push(r => r[k] !== v); return q; }, in(k,v) { filters.push(r => v.includes(r[k])); return q; },
      gte(k,v) { filters.push(r => r[k] >= v); return q; }, order() { return q; }, limit() { return q; },
      maybeSingle() { onlyOne = true; return q; }, single() { onlyOne = true; return q; },
      update(v) { action='update'; values=v; return q; }, upsert(v, opts) { action='upsert'; values=v; conflict=opts; return q; }, insert(v) { action='insert'; values=v; return q; },
      then(done, fail) { return Promise.resolve().then(() => {
        let selected = rows[table].filter(r => filters.every(f => f(r)));
        if (action === 'update') selected.forEach(r => Object.assign(r, values));
        if (action === 'upsert' || action === 'insert') {
          const key = conflict?.onConflict || 'message_id';
          const old = rows[table].find(r => r[key] === values[key]);
          if (old) { if (!conflict?.ignoreDuplicates) Object.assign(old, values); selected=[old]; }
          else { rows[table].push({...values}); selected=[values]; }
        }
        return { data: onlyOne ? selected[0] || null : selected, error:null };
      }).then(done, fail); },
    }; return q;
  }}; return db;
}
(async () => {
  const controls = require('../common/pipeline-controls.ts');
  const { formatEmailPreview } = require('../modules/email/email-preview.ts');
  const stages = require('../modules/processing/stages/index.ts');
  const { saveUserSettings } = require('../database/user-settings.ts');
  const { performInitialSync } = require('../modules/email/ingestion/initial-sync.ts');
  const { processHistorySync } = require('../modules/email/ingestion/history-sync.ts');
  assert.deepEqual(controls.getPipelineControls({}), controls.DEFAULT_PIPELINE);
  assert.deepEqual(controls.getPipelineControls({disable_processing:true}), {receive_emails:true,filter_unwanted:false,use_ai:false,send_whatsapp:false});
  const active = {pipeline:{...controls.DEFAULT_PIPELINE,use_ai:false}, last_inbound_at:new Date().toISOString()};
  for (const stage of [stages.executeTriageStage, stages.executeSummaryStage]) {
    const db=database(active); const result=await stage(db, db.rows.email_messages[0]); assert.equal(result.nextStage,'delivery');
  }
  assert.equal(aiCalls,0,'AI-off bypasses both model entry points');
  const db=database(active); const result=await stages.executeDeliveryStage(db, db.rows.email_messages[0]);
  assert.equal(result.messageStatus,'DELIVERED'); assert.equal(sends.length,1); assert.match(sends[0].rawPreviewText,/Email preview · No AI used/); assert.ok(!sends[0].rawPreviewText.includes('Old reply')); assert.match(sends[0].rawPreviewText,/Open in Gmail/); assert.equal(db.rows.ai_results.length,0); assert.equal(db.rows.summaries.length,0);
  await stages.executeDeliveryStage(db, db.rows.email_messages[0]); assert.equal(sends.length,1,'No redelivery');
  const concurrent=database(active); await Promise.all([stages.executeDeliveryStage(concurrent,{...concurrent.rows.email_messages[0]}),stages.executeDeliveryStage(concurrent,{...concurrent.rows.email_messages[0]})]); assert.equal(sends.length,2,'Concurrent delivery sends once');
  const blocked=database({pipeline:{...controls.DEFAULT_PIPELINE,send_whatsapp:false}}); await stages.executeDeliveryStage(blocked,blocked.rows.email_messages[0]); assert.equal(sends.length,2);
  const old=database({...active,deliver_after:new Date(Date.now()+1000).toISOString()}); await stages.executeDeliveryStage(old,old.rows.email_messages[0]); assert.equal(sends.length,2,'Resuming must not flush old messages');
  const noise=database(active,{subject:'Automatic Reply: away',sender:{raw:'mailer-daemon@example.com'}}); assert.equal((await stages.executePreFilterStage(noise,noise.rows.email_messages[0])).nextStage,null);
  const bypass=database({pipeline:{...controls.DEFAULT_PIPELINE,filter_unwanted:false,use_ai:false}},{subject:'Automatic Reply: away'}); assert.equal((await stages.executePreFilterStage(bypass,bypass.rows.email_messages[0])).nextStage,'delivery');
  const normal=database({}); assert.equal((await stages.executeTriageStage(normal,normal.rows.email_messages[0])).nextStage,'delivery'); assert.equal(aiCalls,1,'Default AI behavior preserved');
  const paused=database({pipeline:{...controls.DEFAULT_PIPELINE,receive_emails:false}});
  const params={accountId:'account-1',userId:'user-1',encryptedRefreshToken:'mock',startHistoryId:'1'};
  assert.equal((await performInitialSync(paused,params)).syncedCount,0); assert.equal((await processHistorySync(paused,params)).syncedCount,0); assert.equal(gmailCalls,0);
  const prefs=database({...active,window_status:'OPEN',last_template_sent_at:'keep'});
  assert.equal((await saveUserSettings(prefs,{user_id:'user-1',notification_preferences:{notify_on_failure:false}})).error,null);
  assert.equal(prefs.rows.user_settings[0].notification_preferences.pipeline.use_ai,false); assert.equal(prefs.rows.user_settings[0].notification_preferences.last_template_sent_at,'keep');
  const resume=controls.updatedPipelinePreferences({pipeline:{...controls.DEFAULT_PIPELINE,receive_emails:false,send_whatsapp:false}},controls.DEFAULT_PIPELINE,'2026-09-11T12:00:00Z'); assert.equal(resume.receive_after,resume.deliver_after);
  const preview=formatEmailPreview({provider_message_id:'abc',body_html:'<style>bad css</style><script>bad script</script><p>Hello &amp; welcome</p><blockquote>old reply</blockquote>',subject:'<test>'}); assert.ok(preview.includes('Hello & welcome')); assert.ok(!preview.includes('bad script')); assert.ok(!preview.includes('old reply'));
  assert.ok(formatEmailPreview({provider_message_id:'abc',body_text:'Long sentence. '.repeat(1000)}).length<2400);
  assert.match(formatEmailPreview({provider_message_id:'abc'}),/No readable text/);
  const concurrentPrefs=database(active);
  await Promise.all([saveUserSettings(concurrentPrefs,{user_id:'user-1',notification_preferences:{notify_on_failure:false}}),saveUserSettings(concurrentPrefs,{user_id:'user-1',notification_preferences:{pipeline:{...controls.DEFAULT_PIPELINE,send_whatsapp:false}}})]);
  assert.equal(concurrentPrefs.rows.user_settings[0].notification_preferences.notify_on_failure,false); assert.equal(concurrentPrefs.rows.user_settings[0].notification_preferences.pipeline.send_whatsapp,false);
  const closed=database({pipeline:{...controls.DEFAULT_PIPELINE,use_ai:false}}); assert.equal((await stages.executeDeliveryStage(closed,closed.rows.email_messages[0])).messageStatus,'DELIVERY_PENDING'); assert.equal(sends.length,2);
  const failing={from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:null,error:new Error('offline')})})};
  assert.equal((await stages.executeTriageStage(failing,normal.rows.email_messages[0])).success,false); assert.equal(aiCalls,1,'Settings failure must not consume AI quota');
  routeDb=database(active); const {PUT}=require('../app/api/settings/pipeline/route.ts');
  const request=(body)=>new Request('http://localhost/api/settings/pipeline',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  signedIn=false; assert.equal((await PUT(request(controls.DEFAULT_PIPELINE))).status,401);
  signedIn=true; assert.equal((await PUT(request({...controls.DEFAULT_PIPELINE,user_id:'another-user'}))).status,400);
  assert.equal((await PUT(request({...controls.DEFAULT_PIPELINE,use_ai:'false'}))).status,400);
  assert.equal((await PUT(request({...controls.DEFAULT_PIPELINE,use_ai:false}))).status,200); assert.equal(routeDb.rows.user_settings[0].notification_preferences.pipeline.use_ai,false);
  console.log('Pipeline tests passed: AI bypass/defaults, filters, ingestion pause, delivery pause/resume, duplicate protection, preference preservation, and preview formatting.');
})().catch(error => { console.error(error); process.exitCode=1; });
