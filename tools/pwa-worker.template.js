const VERSION=__VERSION__,ASSETS=__ASSETS__;
const PREFIX='fieldday-pwa-',CACHE=PREFIX+VERSION,ROOT=new URL('./',self.location);
const allowed=new Map(ASSETS.map(asset=>[new URL(asset.path,ROOT).href,asset.sha256]));
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 try{await Promise.all(ASSETS.map(async asset=>{
  const url=new URL(asset.path,ROOT),request=new Request(url.href+'?build='+VERSION,{cache:'reload',credentials:'omit'}),response=await fetch(request);
  if(!response.ok)throw Error('Onvolledige webapp');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==asset.sha256)throw Error('Webapp-bestand hoort bij een andere versie');await cache.put(url.href,response);
 }));await self.skipWaiting();}catch(error){await caches.delete(CACHE);throw error;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data?.type==='FIELDDAY_VERSION'&&event.ports[0])event.ports[0].postMessage({version:VERSION});});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==ROOT.origin||!url.pathname.startsWith(ROOT.pathname))return;
 const key=request.mode==='navigate'?new URL('index.html',ROOT).href:new URL(url.pathname,ROOT).href;
 if(!allowed.has(key))return;
 event.respondWith(caches.open(CACHE).then(cache=>cache.match(key)).then(response=>response||Response.error()));
});
