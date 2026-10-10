const VERSION="70f3b4a4e2503dcc6eb82f14635717643f7ba2609524f596da53a8c8cce4a9f3",ASSETS=[{"path":"app.css","sha256":"a7144f5377c28c21da06dc7d60b1e7ab84b07d6c269b6d776371cfd979fb9a17"},{"path":"app.js","sha256":"c24ca9c28e277c05c107916f796d035156738064fc99ed3bdf9241fdb10c1be0"},{"path":"event-extras.mjs","sha256":"2411dea3b4be388c3c331158b3e3c61f9c514dff0cf5ec999e01dd631e30e5a2"},{"path":"field-cover.png","sha256":"8bd9fb8ad9652e541fa749a0e67cea441638b0adfcb4fdaa79f4545ae7553abc"},{"path":"firebase-config.json","sha256":"475b0700fc172d6f81776d18779cd8bf24060c6d1a8b5892098e7e3a28d6cdee"},{"path":"font-OFL.txt","sha256":"186d750eb496a4c17a76385f82be6aea2ac1cf2de074a811d63786cf374ea73f"},{"path":"icons/apple-touch-icon.png","sha256":"f078ca5d32572a3972491575aab769e33e5068e3df3f4048f3aeae508c979f15"},{"path":"icons/icon-192.png","sha256":"8ab1f1e3a931f157a745e0cd946e3ae5ee25c92c9f4c8307dc13497ab2156f1d"},{"path":"icons/icon-512.png","sha256":"7bebeb29368c0bd0607c0095f0a37891e954bfd1f5696ab748a593e67b9ac807"},{"path":"index.html","sha256":"fbc2cf767e4dff4ba1fddc5cebf88e37e77771a1da849de8cd2301314d3cbf4e"},{"path":"leaflet-LICENSE.txt","sha256":"bbc959aaef7488b38942e7f05cfd1244351f8bce54261951ea17dd7cf60f894b"},{"path":"leaflet.css","sha256":"337bfca5cabd03b39815b2700febe2b3b7edf55921c59cd49f88ecb328212303"},{"path":"leaflet.js","sha256":"db49d009c841f5ca34a888c96511ae936fd9f5533e90d8b2c4d57596f4e5641a"},{"path":"manifest.webmanifest","sha256":"a3c0253e16b609e6a1e116b8215b2de4f2778f8aad48622d9d04c98551247335"},{"path":"model.mjs","sha256":"4149c952a6eea89147ec2825bc9c4af0ed3a4cbbfcde5b298c9577537944e0c5"},{"path":"platform.mjs","sha256":"33d0e175a6e9496459a305366929d1116025ff9ec9c301ac3a1b6fa0cff7f3a1"},{"path":"seed.json","sha256":"ec9eefae341c38bb1313d8db9bf342933c0ef5a7ce9c2ca97573c0864cc55ee5"},{"path":"social.mjs","sha256":"1330d1d919fe30a4f36d966670ca8c8db5c7983ce6a9a77e1481e73f2c0f0d34"},{"path":"web-start.mjs","sha256":"8dc02d0264fbf53f087f1b2adc1fae637b38d39784fe4950151e67be0d879f06"},{"path":"web-update.mjs","sha256":"c4daf124138b280a8adee5cfba50493694b8ea19eb5afe8a9594fed1fac1b25a"},{"path":"wordmark.ttf","sha256":"e74b750df582c608f35db467b711b2b60d2217618e85e60b72b42dfd00446cab"}];
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
