export async function fetchWebRelease(fetchImpl=fetch,base=new URL('./',location.href)){
 const r=await fetchImpl(new URL('web-release.json?check='+Date.now(),base),{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('Updatecontrole niet bereikbaar');const release=await r.json();
 if(release.schemaVersion!==1||!/^\d+\.\d+\.\d+$/.test(release.appVersion)||!/^[a-f0-9]{64}$/.test(release.version))throw Error('Onbekende webversie');return release;
}
export function workerVersion(worker,Channel=MessageChannel){
 if(!worker)return Promise.resolve(null);
 return new Promise(resolve=>{const channel=new Channel();let timer;const finish=value=>{clearTimeout(timer);channel.port1.close();channel.port2.close();resolve(value);};timer=setTimeout(()=>finish(null),1000);channel.port1.onmessage=e=>finish(typeof e.data?.version==='string'?e.data.version:null);try{worker.postMessage({type:'FIELDDAY_VERSION'},[channel.port2]);}catch{finish(null);}});
}
export async function ensureWebRelease(sw,expected,{version=workerVersion,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),attempts=120}={}){
 if(!sw)throw Error('Open Fieldday in Safari of een actuele browser om de webapp te gebruiken.');
 const registration=await sw.register('./sw.js',{scope:'./',updateViaCache:'none'});await registration.update();
 let previous,previousVersion;
 for(let i=0;i<attempts;i++){const controller=sw.controller;if(controller!==previous||previousVersion!==null){previous=controller;previousVersion=await version(controller);}if(previousVersion===expected)return registration;await wait(200);}
 throw Error('De nieuwste webversie kon niet volledig worden opgehaald. Probeer opnieuw.');
}
