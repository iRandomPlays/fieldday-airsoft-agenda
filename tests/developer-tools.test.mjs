import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isDeveloper,authorizeDeveloper,developerDiagnostics} from '../shared/developer-tools.mjs';
const user=(email='vincentstijfs@live.nl',emailVerified=true,claims={sub:'dev',email,email_verified:emailVerified})=>({uid:'dev',email,emailVerified,getIdTokenResult:async force=>{assert.equal(force,true);return {claims};}});
test('Developmentmenu alleen voor het geverifieerde developeraccount',async()=>{
  const dev=user();assert.equal(isDeveloper(dev),true);await authorizeDeveloper(dev,()=>dev);
  const caps=user('VincentStijfs@Live.nl');await authorizeDeveloper(caps,()=>caps);
  for(const actor of [null,user('other@example.com'),user('vincentstijfs@live.nl',false),{email:'vincentstijfs@live.nl',emailVerified:true}]){assert.equal(isDeveloper(actor),false);await assert.rejects(authorizeDeveloper(actor,()=>actor));}
});
test('Developeracties weigeren vervalste claims, accountwissels en mislukte authenticatie',async()=>{
  for(const claims of [{sub:'dev',email:'other@example.com',email_verified:true},{sub:'dev',email:'vincentstijfs@live.nl',email_verified:false},{sub:'other',email:'vincentstijfs@live.nl',email_verified:true},{}]){const actor=user(undefined,true,claims);await assert.rejects(authorizeDeveloper(actor,()=>actor));}
  const actor=user();await assert.rejects(authorizeDeveloper(actor,()=>user()));
  await assert.rejects(authorizeDeveloper({...actor,getIdTokenResult:async()=>{throw Error('offline');}},()=>actor));
});
test('Diagnostiek bevat importfouten, maar geen profiel-, token- of groepsgegevens',()=>{
  const source={name:'Airborne',status:'warning',found:4,errors:['fetch failed'],secret:'private'};
  const report=developerDiagnostics({generatedAt:'now',events:[{}],sources:[source],runs:[{at:'now',status:'warning',sources:[source],errors:['fetch failed']}],profile:{nabvNumber:'123456'},token:'private',groups:[{id:'private'}]},{version:'1.2.3',platform:'Android',online:true,email:'private'});
  assert.equal(report.agenda.events,1);assert.equal(report.import.sources[0].errors[0],'fetch failed');assert.ok(!JSON.stringify(report).includes('private'));assert.ok(!JSON.stringify(report).includes('123456'));
  assert.equal(developerDiagnostics({},{}).import,null);
});


test('Profielmenu en acties volgen login, verificatie, accountwissel en logout',async()=>{
  const {readFileSync}=await import('node:fs');const {createContext,runInContext}=await import('node:vm');
  const callbacks={},body={innerHTML:'',replaceChildren(){this.innerHTML='';}},dialog={open:false,querySelectorAll:()=>[],showModal(){this.open=true;},close(){this.open=false;},addEventListener(){}};
  const auth={currentUser:null};let authChanged,copied='',refreshes=0;
  const context=createContext({isDeveloper,authorizeDeveloper,developerDiagnostics,
    document:{body:{append(){}},createElement:()=>dialog,addEventListener:(name,fn)=>callbacks[name]=fn,querySelector:s=>s==='#social-body'?body:null},
    navigator:{userAgent:'FielddayAndroid'},location:{hash:'',hostname:'appassets.androidplatform.net'},window:{addEventListener(){}},
    fetch:async()=>({json:async()=>({enabled:true,firebase:{projectId:'test',apiKey:'test'}})}),
    initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),setPersistence:async()=>{},indexedDBLocalPersistence:{},
    onAuthStateChanged:(_,fn)=>{authChanged=fn;},onSnapshot:()=>()=>{},doc:()=>({}),collection:()=>({}),
    firestoreService:()=>async()=>({firstName:'Developer',lastName:'Test'}),
    prompt:(_,payload)=>{copied=JSON.parse(payload).text;},URLSearchParams,Date,console
  });
  const source=readFileSync('android/social-client.mjs','utf8').replace(/^import .*;\r?\n/gm,'').replace('export async function mountSocial','async function mountSocial');
  runInContext(source+'\nthis.mountSocial=mountSocial;',context);
  const api=await context.mountSocial({esc:s=>String(s??''),notice:()=>{},getEvents:async()=>[],getEvent:()=>null,profileChanged:()=>{},getDeveloperData:()=>({data:{events:[],runs:[{status:'warning',errors:['fetch failed'],sources:[]}]},app:{version:'1.2.3'}}),refreshAgenda:async()=>{refreshes++;}});
  const login=async actor=>{auth.currentUser=actor;await authChanged(actor);};
  const click=async action=>{callbacks.click({target:{closest:()=>({dataset:{social:action}})},preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));};
  assert.equal(api.developerCard(),'');await click('developer');assert.equal(dialog.open,false);
  await login(user('other@example.com'));assert.equal(api.developerCard(),'');await click('developer-refresh');assert.equal(refreshes,0);
  await login(user('vincentstijfs@live.nl',false));assert.equal(api.developerCard(),'');await click('developer-copy');assert.equal(copied,'');
  await login(user());assert.match(api.developerCard(),/Developmentmenu/);await click('developer');assert.equal(dialog.open,true);assert.match(body.innerHTML,/fetch failed/);
  await click('developer-refresh');assert.equal(refreshes,1);await click('developer-copy');assert.equal(JSON.parse(copied).import.status,'warning');
  await login(user('other@example.com'));assert.equal(dialog.open,false);assert.equal(api.developerCard(),'');await click('developer');assert.equal(dialog.open,false);
  await login(null);assert.equal(api.developerCard(),'');
});

test('Bronfout toont geen agendabanner; echte netwerkfouten blijven zichtbaar',async()=>{
  const {readFileSync}=await import('node:fs');const {createContext,runInContext}=await import('node:vm');const messages=[];
  const context=createContext({loading:false,tab:'agenda',data:{events:[]},lastFetch:0,DATA_URL:'https://example.com/data',Date,AbortSignal,
    fetch:async()=>({ok:true,json:async()=>({events:[{id:'event'}],runs:[{status:'warning',errors:['fetch failed']}]})}),validateData:d=>d,persist:()=>{},notice:(message,error)=>messages.push({message,error}),render:()=>{},social:null});
  const source=readFileSync('android/app/src/main/assets/app.js','utf8');const refresh=source.slice(source.indexOf('async function refresh('),source.indexOf('function showFilters('));runInContext(refresh,context);
  await runInContext('refresh()',context);assert.deepEqual(messages,[{message:'',error:undefined}]);assert.equal(context.data.runs[0].status,'warning');
  context.fetch=async()=>{throw Error('offline');};messages.length=0;await runInContext('refresh()',context);assert.equal(messages[0].error,true);assert.match(messages[0].message,/Geen verbinding/);
});
