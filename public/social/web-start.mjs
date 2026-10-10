import {fetchWebRelease,ensureWebRelease} from './web-update.mjs';
const BUILD='70f3b4a4e2503dcc6eb82f14635717643f7ba2609524f596da53a8c8cce4a9f3';
if(/FielddayAndroid/.test(navigator.userAgent)){
 await import('./app.js');
}else{
 const gate=document.getElementById('web-update'),message=document.getElementById('web-update-message'),retry=document.getElementById('web-update-retry');
 try{document.body.classList.toggle('dark',JSON.parse(localStorage.getItem('fieldday-theme'))==='dark');}catch{}
 let loaded=false,checking=false;
 const block=(text,failed=false)=>{gate.hidden=false;message.textContent=text;retry.hidden=!failed;};
 const verify=async()=>{if(checking)return;checking=true;block('Controleren op de nieuwste Fieldday-versie…');
  try{const release=await fetchWebRelease();block('Fieldday voorbereiden…');await ensureWebRelease(navigator.serviceWorker,release.version);
   if(release.version!==BUILD){block('Nieuwe versie gevonden. Fieldday wordt bijgewerkt…');location.reload();return;}
   if(!loaded){await import('./app.js');loaded=true;}gate.hidden=true;
  }catch{block('Fieldday kan de nieuwste versie niet ophalen. Controleer je internetverbinding en probeer opnieuw. Open deze link in Safari als je vanuit WhatsApp komt.',true);}
  finally{checking=false;}
 };
 retry.addEventListener('click',()=>location.reload());
 navigator.serviceWorker?.addEventListener('controllerchange',()=>{if(loaded){block('Fieldday wordt bijgewerkt…');location.reload();}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)verify();});
 window.addEventListener('online',()=>{if(!gate.hidden)verify();});
 await verify();
}
