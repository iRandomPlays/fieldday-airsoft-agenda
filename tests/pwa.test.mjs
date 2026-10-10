import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,readdir,unlink,rmdir} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {platformInfo,IOS_INSTALL_HELP} from '../android/app/src/main/assets/platform.mjs';
import {fetchWebRelease,ensureWebRelease,workerVersion} from '../android/app/src/main/assets/web-update.mjs';
import {buildCalendars} from '../tools/build-calendars.mjs';
const release=JSON.parse(await readFile('public/social/web-release.json','utf8'));
test('Platformdetectie herkent iPhone, iPad, beginscherm en Android zonder verwarring',()=>{
 assert.equal(platformInfo({userAgent:'iPhone',standalone:false},()=>({matches:false})).ios,true);
 assert.equal(platformInfo({userAgent:'Macintosh',maxTouchPoints:5}).ios,true);
 assert.equal(platformInfo({userAgent:'Macintosh',maxTouchPoints:0}).ios,false);
 assert.equal(platformInfo({userAgent:'iPad',standalone:true}).standalone,true);
 assert.equal(platformInfo({userAgent:'Android FielddayAndroid/1.0'}).native,true);
 assert.equal(platformInfo({userAgent:'Android'},()=>({matches:true})).standalone,true);
 assert.match(IOS_INSTALL_HELP,/Zet op beginscherm/);assert.match(IOS_INSTALL_HELP,/Safari/);
});
test('Webupdates vereisen een geldige verse release en wachten op de bijbehorende worker',async()=>{
 const expected='a'.repeat(64);assert.equal((await fetchWebRelease(async(url,options)=>{assert.match(url.href,/web-release.json\?check=/);assert.equal(options.cache,'no-store');return {ok:true,json:async()=>({...release,version:expected})};},new URL('https://example.com/social/'))).version,expected);
 for(const fetchImpl of [async()=>({ok:false}),async()=>({ok:true,json:async()=>({...release,version:'bad'})}),async()=>{throw Error('offline');}])await assert.rejects(fetchWebRelease(fetchImpl,new URL('https://example.com/social/')));
 let updates=0,reads=0;const registration={update:async()=>updates++},sw={controller:{},register:async(url,options)=>{assert.equal(url,'./sw.js');assert.equal(options.updateViaCache,'none');return registration;}};
 await ensureWebRelease(sw,expected,{version:async()=>++reads===1?'old':expected,wait:async()=>{}});assert.equal(updates,1);assert.equal(reads,2);
 await assert.rejects(ensureWebRelease(sw,expected,{version:async()=>null,wait:async()=>{},attempts:2}));await assert.rejects(ensureWebRelease(null,expected));
 const worker={postMessage:(message,ports)=>{assert.equal(message.type,'FIELDDAY_VERSION');ports[0].postMessage({version:expected});}};assert.equal(await workerVersion(worker),expected);
});
async function workerHarness({corrupt=false}={}){
 const handlers={},stores=new Map(),deleted=[],requested=[];let activated=false,claimed=false;
 const caches={open:async name=>{if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return {put:async(key,response)=>store.set(key,response),match:async key=>store.get(key)};},keys:async()=>[...stores.keys()],delete:async key=>{deleted.push(key);return stores.delete(key);}};
 const self={location:new URL('https://example.com/social/sw.js'),addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>activated=true,clients:{claim:async()=>claimed=true}};
 const fetch=async request=>{const url=new URL(request.url);requested.push(url);const name=url.pathname.slice('/social/'.length);return new Response(corrupt?Buffer.from('wrong'):await readFile('public/social/'+name));};
 runInNewContext(await readFile('public/social/sw.js','utf8'),{self,caches,fetch,crypto:webcrypto,URL,Request,Response,Map,Promise,Array,Uint8Array,Error});
 const fire=async(name,event={})=>{let pending;handlers[name]({...event,waitUntil:p=>pending=p});await pending;};
 return {handlers,stores,deleted,requested,fire,get activated(){return activated;},get claimed(){return claimed;}};
}
test('Een complete gecontroleerde release wordt geïnstalleerd zonder privégegevens te cachen',async()=>{
 const h=await workerHarness();await h.fire('install');assert.equal(h.activated,true);assert.ok(h.requested.length>10);assert.ok(h.requested.every(u=>u.origin==='https://example.com'&&u.searchParams.get('build')===release.version));
 h.stores.set('fieldday-pwa-old',new Map());h.stores.set('fieldday-v3-1',new Map());h.stores.set('another-project',new Map());await h.fire('activate');assert.equal(h.claimed,true);assert.ok(h.deleted.includes('fieldday-pwa-old'));assert.ok(h.stores.has('fieldday-v3-1'));assert.ok(h.stores.has('another-project'));
 let response;h.handlers.fetch({request:{method:'GET',url:'https://example.com/social/app.js',mode:'cors'},respondWith:p=>response=p});assert.equal((await response).status,200);
 for(const url of ['https://firestore.googleapis.com/private','https://example.com/social/web-release.json?check=1','https://example.com/data/events.json','https://api.open-meteo.com/v1/forecast']){let intercepted=false;h.handlers.fetch({request:{method:'GET',url,mode:'cors'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);}
 let version;h.handlers.message({data:{type:'FIELDDAY_VERSION'},ports:[{postMessage:data=>version=data.version}]});assert.equal(version,release.version);
});
test('Onvolledige of gewijzigde bestanden blokkeren de nieuwe webrelease',async()=>{
 const h=await workerHarness({corrupt:true});await assert.rejects(h.fire('install'));assert.equal(h.activated,false);assert.ok(h.deleted.includes('fieldday-pwa-'+release.version));
});
test('iPhone-manifest, beginschermicoon en bootstrap verwijzen naar dezelfde release',async()=>{
 const manifest=JSON.parse(await readFile('public/social/manifest.webmanifest','utf8')),html=await readFile('public/social/index.html','utf8'),boot=await readFile('public/social/web-start.mjs','utf8');
 assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.icons.length,2);assert.match(html,/apple-touch-icon/);assert.match(html,/src="web-start.mjs"/);assert.ok(boot.includes(release.version));assert.ok(!boot.includes('__FIELDDAY_BUILD__'));
 const bytes=await readFile('public/social/icons/apple-touch-icon.png');assert.equal(bytes.readUInt32BE(16),180);assert.equal(bytes.readUInt32BE(20),180);
 const worker=await readFile('public/social/sw.js','utf8');const assets=JSON.parse(worker.match(/ASSETS=(\[.*?\]);/)[1]);for(const asset of assets)assert.equal(createHash('sha256').update(await readFile('public/social/'+asset.path)).digest('hex'),asset.sha256);
});
test('Apple-agendabestanden bevatten uitsluitend openbare actieve evenementen',async()=>{
 const output=await mkdtemp(path.join(tmpdir(),'fieldday-calendar-test-'));
 try{const events=[{id:'good',title:'Skirm',date:'2026-10-18',location:'Nuth',start:'09:00',end:'16:00',nabvNumber:'private'},{id:'cancelled',title:'No',date:'2026-10-18',cancelled:true},{id:'../escape',title:'No',date:'2026-10-18'}];
  assert.equal(await buildCalendars(events,output,new Date('2026-10-10T12:00Z')),1);const text=await readFile(output+'/good.ics','utf8');assert.match(text,/BEGIN:VEVENT/);assert.ok(!text.includes('private'));assert.match(text,/DTSTART:20261018T070000Z/);assert.deepEqual(await readdir(output),['good.ics']);
  await buildCalendars([],output);assert.deepEqual(await readdir(output),[]);
 }finally{for(const name of await readdir(output))await unlink(path.join(output,name));await rmdir(output);}
});

test('iPhone-uitnodigingen en installatiehulp tonen geen Android-downloads of intents',async()=>{
 const source=(await readFile('android/social-client.mjs','utf8')).replace(/^import .*;\r?\n/gm,'').replace('export async function mountSocial','async function mountSocial');
 for(const standalone of [false,true]){
  const handlers={},body={innerHTML:'',replaceChildren(){this.innerHTML='';}},dialog={open:false,querySelectorAll:()=>[],showModal(){this.open=true;},close(){this.open=false;},addEventListener(){}};let banner,authChanged;
  const context={platformInfo:()=>({ios:true,native:false,android:false,standalone}),IOS_INSTALL_HELP,
   document:{body:{append(){}},createElement:name=>name==='dialog'?dialog:{},addEventListener:(name,fn)=>handlers[name]=fn,querySelector:s=>s==='#social-body'?body:s==='header.brand'?{after:node=>banner=node}:null},
   navigator:{userAgent:'iPhone'},location:{hash:'#invite='+'a'.repeat(64),hostname:'example.com'},window:{addEventListener(){}},
   fetch:async()=>({json:async()=>({enabled:true,firebase:{projectId:'test',apiKey:'test'}})}),initializeApp:()=>({}),getAuth:()=>({}),getFirestore:()=>({}),setPersistence:async()=>{},indexedDBLocalPersistence:{},onAuthStateChanged:(_,fn)=>authChanged=fn,
   doc:()=>({}),collection:()=>({}),onSnapshot:(_,fn)=>{fn({exists:()=>true,data:()=>({eventId:'event',organizerName:'Groepsorganisator',status:'active'})});return ()=>{};},firestoreService:()=>()=>{},URLSearchParams,
   invitationLinks:()=>({app:'https://example.com/invite',intent:'intent://android',download:'https://example.com/Fieldday.apk'}),console};
  runInNewContext(source+'\nthis.mountSocial=mountSocial;',context);
  await context.mountSocial({esc:s=>String(s??''),notice:()=>{},getEvent:()=>({title:'Skirm',date:'2026-10-18',location:'Nuth'}),profileChanged:()=>{}});await authChanged(null);
  assert.ok(!body.innerHTML.includes('Fieldday.apk'));assert.ok(!body.innerHTML.includes('intent://'));assert.ok(!body.innerHTML.includes('Android-telefoon'));
  if(!standalone){assert.match(banner.innerHTML,/voor iPhone/);assert.match(body.innerHTML,/Installeren op iPhone/);handlers.click({target:{closest:()=>({dataset:{social:'install'}})},preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));assert.match(body.innerHTML,/Zet op beginscherm/);assert.ok(!body.innerHTML.includes('Android-app downloaden'));}
  else{assert.equal(banner,undefined);assert.ok(!body.innerHTML.includes('Installeren op iPhone'));}
 }
});
