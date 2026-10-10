import {load} from 'cheerio';
import {createHash,randomUUID} from 'node:crypto';
import {validDate} from './parser.mjs';

const PAGE='https://unit13.eu/nl/airsoft-open-evenementen/';
const API='https://widget-api.briqbookings.com/Widget/V1/';
const FILTERS=[{property:'activiteit',values:['airsoft']},{property:'type-event',values:['open-event']}];
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const price=n=>n!=null&&Number.isFinite(Number(n))&&Number(n)>=0?Number(n):null;
const link=s=>{try{const u=new URL(s);return u.protocol==='https:'?u.href:null;}catch{return null;}};

export function unit13OpenItems(payload){
 if(!Array.isArray(payload?.responseData))throw Error('Unit 13: onbekend formaat van openbare evenementen.');
 const items=payload.responseData.filter(p=>/airsoft/i.test(p.displayName||'')&&/open|skirm|big\s*game|thema/i.test(p.displayName||'')&&!/priv[eé]|schietbaan|target|junior|laser/i.test(p.displayName||''));
 for(const p of items)if(!p.itemKey||!['Deal','Product'].includes(p.itemType))throw Error('Unit 13: evenementidentiteit ontbreekt.');
 if(!items.length)throw Error('Unit 13: geen openbare airsoftevenementen herkend.');return [...new Map(items.map(p=>[p.itemType+':'+p.itemKey,p])).values()];
}

export function unit13Events(item,payload,startDate,endDate){
 if(!Array.isArray(payload?.responseData?.availableDates))throw Error('Unit 13: onbekend formaat van beschikbare datums.');
 const desc=load(item.description||'');desc('script,style').remove();const events=new Map();
 for(const day of payload.responseData.availableDates){
  if(!validDate(day.date)||day.date<startDate||day.date>endDate)throw Error('Unit 13: ongeldige datum buiten de aangevraagde kalender.');
  const key=item.itemType+':'+item.itemKey+':'+day.date;
  const widget=`ws|is|OrderItemSingle|and|o|is|true|and|oi|is|${item.itemType}||${item.itemKey}`;
  events.set(key,{id:createHash('sha256').update('unit13:'+key).digest('hex').slice(0,20),sourceId:'unit13',organizer:'Unit 13',title:clean(item.displayName),location:'Nuth',country:'NL',address:'Thermiekstraat 12, 6361 HB Nuth',terrain:'Indoor CQB',date:day.date,sourceUrl:PAGE+'#bw='+Buffer.from(widget).toString('base64').replace(/=+$/,''),image:link(item.imageLocation)||'./icon.svg',price:price(day.salePrice)??price(item.prices?.person?.price),pricePrefix:day.isStartingFromPrice?'Vanaf ':'',description:clean(desc.root().text()),dateEvidence:'Deze datum wordt als beschikbaar gepubliceerd door het openbare Unit 13-boekingssysteem.',detailNote:'Prijs voor deze datum uit het boekingssysteem. Huurkit en extra opties kunnen apart worden berekend. Kies bij Unit 13 een beschikbare starttijd; de import maakt geen reservering.'});
 }
 return [...events.values()];
}

export async function collectUnit13(getHtml,request=null,today=null){
 const html=await getHtml(PAGE),$=load(html);
 if($('.bw-widget[data-domain="unit13"]').length!==1)throw Error('Unit 13: het openbare boekingssysteem is veranderd.');
 const session=randomUUID().replaceAll('-','').toUpperCase();
 const post=request||async function(path,RequestData){
  // These two POST endpoints only read catalogue/availability. Never create or place a booking.
  if(!['OrderItems','Booking/Dates'].includes(path))throw Error('Unit 13: onbekend uitleesverzoek.');
  const r=await fetch(API+path,{method:'POST',signal:AbortSignal.timeout(25000),headers:{'Content-Type':'application/json','User-Agent':'FielddayAgenda/0.3 (+https://github.com/iRandomPlays/fieldday-airsoft-agenda)'},body:JSON.stringify({BusinessUnitDomain:'unit13',Culture:'nl-NL',SessionId:session,RequestData})});
  if(!r.ok)throw Error('Unit 13-boekingsagenda antwoordt met HTTP '+r.status);return r.json();
 };
 const startDate=today||new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam'}).format(new Date());
 if(!validDate(startDate))throw Error('Unit 13: ongeldige begindatum.');
 const until=new Date(startDate+'T12:00:00Z');until.setUTCFullYear(until.getUTCFullYear()+1);const endDate=until.toISOString().slice(0,10);
 const items=unit13OpenItems(await post('OrderItems',{customFilters:{items:FILTERS,isInclusive:true},areSegmentsInclusive:false})),events=[];
 for(const item of items){const data=await post('Booking/Dates',{AvailabilityStartDate:startDate,AvailabilityEndDate:endDate,OrderItem:{type:item.itemType,key:item.itemKey}});events.push(...unit13Events(item,data,startDate,endDate));}
 if(!events.length)throw Error('Unit 13: geen beschikbare speeldatums; bestaande gegevens blijven ter controle bewaard.');
 return {events,errors:[]};
}
