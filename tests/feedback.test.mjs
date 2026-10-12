import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createContext,runInContext} from 'node:vm';import {webcrypto} from 'node:crypto';
import {feedbackInput,FEEDBACK_CATEGORIES,FEEDBACK_STATUSES} from '../shared/feedback.mjs';import {isDeveloper,authorizeDeveloper,developerDiagnostics} from '../shared/developer-tools.mjs';
const controllerSource=readFileSync('android/feedback-client.mjs','utf8').replace(/^import .*;\r?\n/gm,'').replace('export function createFeedbackController','function createFeedbackController');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const flush=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
test('Feedback valideert begrensde tekst en contacttoestemming staat standaard uit',()=>{
 assert.deepEqual(feedbackInput({category:'idea',subject:' Idee ',message:' Bericht '}),{category:'idea',subject:'Idee',message:'Bericht',allowContact:false});
 for(const value of [{category:'bad',subject:'x',message:'y'},{category:'bug',subject:' ',message:'x'},{category:'bug',subject:'x',message:'x'.repeat(3001)}])assert.throws(()=>feedbackInput(value));
});
test('Werkelijke sociale UI: login behoudt tekst, netwerkfout behoudt formulier en retry gebruikt dezelfde verzendcode',async()=>{
 const handlers={},body={innerHTML:'',replaceChildren(){this.innerHTML='';}},err={textContent:''},controls=[{disabled:false,isConnected:true},{disabled:false,isConnected:true}];
 const dialog={open:false,querySelectorAll:()=>controls,showModal(){this.open=true;},close(){this.open=false;},addEventListener(){}};
 const auth={currentUser:null};let authChanged,calls=[],fail=true,release;
 const user={uid:'member',email:'member@example.test',emailVerified:true,getIdTokenResult:async()=>({claims:{sub:'member',email:'member@example.test',email_verified:true}})};
 const fakeService={send:async(id,input)=>{calls.push({id,...input});if(fail)throw {code:'unavailable'};if(release)await release;return id;}};
 class FormData {constructor(form){this.rows=Object.entries(form.values||{});}[Symbol.iterator](){return this.rows[Symbol.iterator]();}}
 const context=createContext({feedbackInput,FEEDBACK_CATEGORIES,FEEDBACK_STATUSES,feedbackService:()=>fakeService,authorizeDeveloper,isDeveloper,developerDiagnostics,crypto:webcrypto,FormData,
  platformInfo:()=>({native:true,label:'Android'}),IOS_INSTALL_HELP:'',document:{body:{append(){}},createElement:()=>dialog,querySelector:s=>s==='#social-body'?body:s==='#social-error'?err:null,addEventListener:(name,fn)=>(handlers[name]??=[]).push(fn)},
  window:{addEventListener(){}},navigator:{userAgent:'FielddayAndroid'},location:{hash:'',hostname:'appassets.androidplatform.net'},URLSearchParams,
  fetch:async()=>({json:async()=>({enabled:true,firebase:{projectId:'test',apiKey:'test'}})}),initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),setPersistence:async()=>{},indexedDBLocalPersistence:{},
  onAuthStateChanged:(_,fn)=>{authChanged=fn;},onSnapshot:()=>()=>{},doc:()=>({}),collection:()=>({}),
  firestoreService:()=>async()=>({firstName:'Member',lastName:'Test'}),signInWithEmailAndPassword:async()=>{auth.currentUser=user;await authChanged(user);},console});
 runInContext(controllerSource,context);let source=readFileSync('android/social-client.mjs','utf8').replace(/^import .*;\r?\n/gm,'').replace('export async function mountSocial','async function mountSocial');runInContext(source+'\nthis.mountSocial=mountSocial;',context);
 await context.mountSocial({esc:escape,notice:()=>{},getEvents:async()=>[],getEvent:()=>null,profileChanged:()=>{},getDeveloperData:()=>({app:{version:'1.2.7',platform:'Android'}}),refreshAgenda:async()=>{}});
 const click=async action=>{for(const fn of handlers.click)fn({target:{closest:()=>({dataset:{social:action}})},preventDefault(){}});await flush();};
 const submit=async(form,wait=true)=>{for(const fn of handlers.submit)fn({target:form,preventDefault(){}});if(wait)await flush();};
 await click('feedback');assert.match(body.innerHTML,/Feedback geven/);assert.doesNotMatch(body.innerHTML,/name="contact" checked/);
 const draft={category:'idea',subject:'Mijn idee',message:'Meer speeldagen\n<private>',contact:'on'};
 await submit({id:'social-feedback',values:draft});assert.match(body.innerHTML,/Welkom terug/);assert.equal(calls.length,0);
 await submit({id:'social-auth',dataset:{mode:'login'},values:{email:user.email,password:'example'}});
 assert.match(body.innerHTML,/Mijn idee/);assert.match(body.innerHTML,/&lt;private&gt;/);assert.match(body.innerHTML,/name="contact" checked/);
 await submit({id:'social-feedback',values:draft});assert.match(body.innerHTML,/Mijn idee/);assert.match(err.textContent,/Geen verbinding/);assert.equal(calls.length,1);
 fail=false;release=new Promise(resolve=>{context.releaseSend=resolve;});
 await submit({id:'social-feedback',values:draft},false);await flush();assert.ok(controls.every(c=>c.disabled));await submit({id:'social-feedback',values:draft},false);await flush();assert.equal(calls.length,2);
 context.releaseSend();await flush();assert.equal(calls[0].id,calls[1].id);assert.match(body.innerHTML,/melding is ontvangen/);assert.ok(controls.every(c=>!c.disabled));
});
test('Developerfeedback toont filters en status, ontsmet tekst en verbergt private resultaten na accountwissel',async()=>{
 let user={uid:'dev',email:'vincentstijfs@live.nl',emailVerified:true,getIdTokenResult:async()=>({claims:{sub:'dev',email:'vincentstijfs@live.nl',email_verified:true}})},html='',status='',deleted=false,pending;
 const controls={'#feedback-status':{value:'new'},'#feedback-category':{value:'idea'},'#feedback-detail-status':{value:'done'}};
 const row={id:'a'.repeat(64),subject:'<script>',message:'<img src=x>\nTest',category:'idea',status:'new',createdAt:{toDate:()=>new Date('2026-10-12')},appVersion:'1.2.7',platform:'Web',allowContact:false,contactEmail:''};let filters;
 const context=createContext({feedbackInput,FEEDBACK_CATEGORIES,FEEDBACK_STATUSES,authorizeDeveloper,crypto:webcrypto,document:{querySelector:s=>controls[s]},feedbackService:()=>({list:async value=>{filters=value;if(pending)await pending;return {rows:[row],cursor:null};},countNew:async()=>1,detail:async()=>row,status:async(_,value)=>{status=value;},remove:async()=>{deleted=true;}})});runInContext(controllerSource+'\nthis.create=createFeedbackController;',context);
 const ui=context.create({getUser:()=>user,getAuth:()=>({currentUser:user}),getDb:()=>({}),getApp:()=>({}),esc:escape,open:value=>{html=value;},notice:()=>{},requireAccount:async()=>{}});
 await ui.action('feedback-admin');assert.match(html,/1 nieuwe meldingen/);assert.match(html,/feedback-category/);assert.match(html,/&lt;script&gt;/);
 await ui.action('feedback-filter');assert.equal(filters.category,'idea');assert.equal(filters.status,'new');
 await ui.action('feedback-detail',{dataset:{id:row.id}});assert.match(html,/&lt;img/);assert.match(html,/Geen toestemming/);assert.doesNotMatch(html,/mailto:/);
 await ui.action('feedback-save');assert.equal(status,'done');await ui.action('feedback-delete');assert.equal(deleted,false);await ui.action('feedback-confirm-delete');assert.equal(deleted,true);
 let resolve;pending=new Promise(r=>{resolve=r;});const late=ui.action('feedback-admin');await flush();ui.clearPrivate();user=null;html='hidden';resolve();await late;assert.equal(html,'hidden');await assert.rejects(ui.action('feedback-admin'));
});
