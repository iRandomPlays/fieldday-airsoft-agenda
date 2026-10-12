const VERSION="c17743d5ac58a33646d65cb3e3877650627d631f4c489d89f3a2b6eebac878ba",ASSETS=[{"path":"app.css","sha256":"1ffa96d16eec9243d3d0bd38dfcd150289ae5a9795a291cb4f1473d34d2c963d"},{"path":"app.js","sha256":"e93648f156c6bc513927558edf60e3881b0e48f8138d52e80bf77bd564ca2ab1"},{"path":"event-extras.mjs","sha256":"2411dea3b4be388c3c331158b3e3c61f9c514dff0cf5ec999e01dd631e30e5a2"},{"path":"field-cover.png","sha256":"8bd9fb8ad9652e541fa749a0e67cea441638b0adfcb4fdaa79f4545ae7553abc"},{"path":"firebase-config.json","sha256":"475b0700fc172d6f81776d18779cd8bf24060c6d1a8b5892098e7e3a28d6cdee"},{"path":"font-OFL.txt","sha256":"186d750eb496a4c17a76385f82be6aea2ac1cf2de074a811d63786cf374ea73f"},{"path":"icons/apple-touch-icon.png","sha256":"f078ca5d32572a3972491575aab769e33e5068e3df3f4048f3aeae508c979f15"},{"path":"icons/icon-192.png","sha256":"8ab1f1e3a931f157a745e0cd946e3ae5ee25c92c9f4c8307dc13497ab2156f1d"},{"path":"icons/icon-512.png","sha256":"7bebeb29368c0bd0607c0095f0a37891e954bfd1f5696ab748a593e67b9ac807"},{"path":"index.html","sha256":"37eb5ac12cb24aab6c1888291e0411781446f2c4de7a58867b9eea75d077c55d"},{"path":"leaflet-LICENSE.txt","sha256":"bbc959aaef7488b38942e7f05cfd1244351f8bce54261951ea17dd7cf60f894b"},{"path":"leaflet.css","sha256":"337bfca5cabd03b39815b2700febe2b3b7edf55921c59cd49f88ecb328212303"},{"path":"leaflet.js","sha256":"db49d009c841f5ca34a888c96511ae936fd9f5533e90d8b2c4d57596f4e5641a"},{"path":"manifest.webmanifest","sha256":"a3c0253e16b609e6a1e116b8215b2de4f2778f8aad48622d9d04c98551247335"},{"path":"model.mjs","sha256":"fef19b58b3ff826a4fecd47f23ffe5fc5936ca3bed021c229363c1218e492414"},{"path":"platform.mjs","sha256":"33d0e175a6e9496459a305366929d1116025ff9ec9c301ac3a1b6fa0cff7f3a1"},{"path":"seed.json","sha256":"ec9eefae341c38bb1313d8db9bf342933c0ef5a7ce9c2ca97573c0864cc55ee5"},{"path":"social.mjs","sha256":"3f2ad8d83d67c3ce6d2c84dec6384e118c01befb7d02b289ee70775d122ddd4b"},{"path":"web-start.mjs","sha256":"30a3567b179eecb309822aeabec1bb46fc49c265f943b0778d9d2876553442e2"},{"path":"web-update.mjs","sha256":"c4daf124138b280a8adee5cfba50493694b8ea19eb5afe8a9594fed1fac1b25a"},{"path":"wordmark.ttf","sha256":"e74b750df582c608f35db467b711b2b60d2217618e85e60b72b42dfd00446cab"}];
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
