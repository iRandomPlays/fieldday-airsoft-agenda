import {createHash} from 'node:crypto';
import {load} from 'cheerio';
export const RULE_HOSTS=new Set(['www.airsoftevenementlimburg.nl','3division.eu','www.3division.eu','www.area077.nl','www.airsoftevents.be','airsoftevents.be','www.rushbattlearena.nl','rushbattlearena.nl','airsoften.be','www.airsoften.be','belgianairsoft.com','www.belgianairsoft.com','antwerpairsoft.be','www.antwerpairsoft.be','www.airborne-events.be','airborne-events.be','unit13.eu','www.unit13.eu','ballsandarrows.nl','www.ballsandarrows.nl','www.gladiator.nl','gladiator.nl','copperheadtactical.eu','www.copperheadtactical.eu','www.deltaairsoft.nl','deltaairsoft.nl']);
export function officialUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&RULE_HOSTS.has(u.hostname);}catch{return false;}}
const fold=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
export function matchedProfiles(organizer,event){
 let sourcePath='';try{sourcePath=new URL(event.sourceUrl).pathname.replace(/\/$/,'');}catch{}
 return organizer.profiles.filter(p=>(p.match.locations||[]).some(s=>fold(s)===fold(event.location))||(p.match.titleIncludes||[]).some(s=>fold(event.title).includes(fold(s)))||(p.match.sourcePaths||[]).some(s=>s.replace(/\/$/,'')===sourcePath));
}
export function validateRules(data,sourceIds){
 if(data?.schemaVersion!==1||!Array.isArray(data.organizers)||data.organizers.length>100)throw Error('Ongeldig regelsformaat.');
 const ids=new Set();
 const string=(v,max=1800)=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[<>]/.test(v);
 for(const o of data.organizers){
  if(!string(o.id,80)||ids.has(o.id)||sourceIds&&!sourceIds.includes(o.id)||!string(o.name,100)||!['verified','partial','unavailable'].includes(o.coverage)||!/^\d{4}-\d{2}-\d{2}$/.test(o.reviewedAt)||!Array.isArray(o.summary)||o.summary.length>8||!o.summary.every(s=>string(s))||!Array.isArray(o.sources)||o.sources.length>8||!Array.isArray(o.profiles)||o.profiles.length>10)throw Error('Ongeldige organisator: '+o.id);
  ids.add(o.id);const sources=new Set();
  for(const s of o.sources){if(!string(s.id,50)||sources.has(s.id)||!string(s.title,250)||!officialUrl(s.url)||!['html','pdf','spa-assets'].includes(s.type))throw Error('Ongeldige regelbron bij '+o.id);sources.add(s.id);}
  for(const p of o.profiles){if(!string(p.label,100)||!Array.isArray(p.summary)||!p.summary.every(s=>string(s))||!Array.isArray(p.sourceIds)||!p.sourceIds.every(id=>sources.has(id))||!p.match||!Object.entries(p.match).every(([k,v])=>['locations','titleIncludes','sourcePaths'].includes(k)&&Array.isArray(v)&&v.length<=10&&v.every(s=>string(s,250))))throw Error('Ongeldig terreinprofiel bij '+o.id);}
 }
 if(sourceIds&&sourceIds.some(id=>!ids.has(id)))throw Error('Niet iedere agenda-organisator heeft een regelsvermelding.');
 return data;
}
export function fingerprint(source,body){
 const raw=Buffer.isBuffer(body)?body:Buffer.from(body);let content;
 if(source.type==='pdf'){
  if(!raw.subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('PDF-bron leverde geen PDF.');
  content=raw;
 }else{
  const $=load(raw.toString('utf8'));
  if(source.type==='spa-assets'){
   const scripts=$('script[src]').map((_,el)=>$(el).attr('src')).get().filter(src=>/main[-.].*\.js/.test(src));
   if(!scripts.length)throw Error('Geen herkenbare applicatiebundel gevonden.');
   content=scripts.sort().join('\n');
  }else{
   $('script,style,noscript,header,footer,nav,form,[role=navigation]').remove();
   content=($('main').first().text()||$('[role=main]').first().text()||$('article').first().text()||$('body').text()).replace(/\s+/g,' ').trim();
   if(content.length<100||/Deze pagina is \(nog\) niet beschikbaar/i.test(content))throw Error('Geen bruikbare regeltekst gevonden.');
  }
 }
 return createHash('sha256').update(content).digest('hex');
}
export async function fetchRule(source,{fetcher=fetch}={}){
 let url=source.url;
 for(let redirects=0;redirects<4;redirects++){
  if(!officialUrl(url))throw Error('Bron of redirect staat niet op de lijst officiële websites.');
  const response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(18000),headers:{'User-Agent':'FielddayRules/1.0 (+https://github.com/iRandomPlays/fieldday-airsoft-agenda)'}});
  if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');if(!location)throw Error('Redirect zonder bestemming.');url=new URL(location,url).href;await response.body?.cancel();continue;}
  if(!response.ok)throw Error('Bron antwoordt met HTTP '+response.status);
  if(Number(response.headers.get('content-length')||0)>4*1024*1024)throw Error('Regelbron is te groot.');
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{while(true){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4*1024*1024){await reader.cancel();throw Error('Regelbron is te groot.');}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
  return {url,fingerprint:fingerprint(source,Buffer.concat(chunks))};
 }
 throw Error('Te veel redirects.');
}
export async function checkRules(data,{fetchSource=fetchRule,now=()=>new Date().toISOString(),recordReview=false}={}){
 const output=structuredClone(data);output.generatedAt=now();
 const cache=new Map();
 const queue=output.organizers.flatMap(o=>o.sources.map(s=>({o,s})));let cursor=0;
 await Promise.all(Array.from({length:3},async()=>{while(cursor<queue.length){
  const{o,s}=queue[cursor++];s.checkedAt=now();
  try{
   if(!cache.has(s.url))cache.set(s.url,fetchSource(s));
   const result=await cache.get(s.url);s.resolvedUrl=result.url;s.currentFingerprint=result.fingerprint;
   if(recordReview)s.reviewedFingerprint=result.fingerprint;
   s.checkStatus=s.reviewedFingerprint===result.fingerprint?'ok':s.reviewedFingerprint?'changed':'unreviewed';
   delete s.checkError;
  }catch(error){s.checkStatus='unreachable';s.checkError=String(error.message).slice(0,180);}
 }}));
 for(const o of output.organizers)o.needsReview=o.sources.some(s=>s.checkStatus!=='ok');
 return output;
}
