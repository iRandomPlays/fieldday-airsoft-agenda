import {load} from 'cheerio';
import {createHash} from 'node:crypto';
import {validDate} from './parser.mjs';

const months=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const plain=s=>clean(load(String(s??'')).root().text());
const stable=(source,key)=>createHash('sha256').update(source+':'+key).digest('hex').slice(0,20);
const link=(s,base)=>{if(!s)return null;try{const u=new URL(s,base);return u.protocol==='https:'?u.href:null;}catch{return null;}};
const date=(year,month,day)=>{const d=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;return validDate(d)?d:null;};
const euro=s=>{const m=plain(s).match(/€\s*(\d+(?:[.,]\d{2})?)/);return m?Number(m[1].replace(',','.')):null;};
const nextDay=s=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);};

export function parseAirsoften(html){
 const $=load(html),base='https://airsoften.be/skirmkalender/',out=new Map();
 const heading=$('h1,h2').map((_,e)=>clean($(e).text())).get().filter(t=>/^(Skirmkalender|Kalender)\s+20\d{2}$/i.test(t));
 const years=[...new Set(heading.flatMap(t=>t.match(/20\d{2}/g)||[]))];
 if(years.length!==1)throw Error('Airsoften.be: kalenderjaar ontbreekt of is tegenstrijdig.');
 const year=years[0],intro=$('p').map((_,e)=>clean($(e).text())).get().find(t=>/eigen uitrusting/i.test(t))||'';
 const price=euro(intro),rental=euro(intro.split(/huren/i)[1]||'');
 const image=link($('img[alt="fort"]').attr('data-src')||$('img[alt="fort"]').attr('src'),base)||'./icon.svg';
 $('table').each((_,table)=>{
  const headers=$(table).find('th').map((_,e)=>clean($(e).text())).get();
  $(table).find('tr').each((_,row)=>{const cells=$(row).find('td');if(cells.length<2)return;
   const month=months.indexOf(clean(cells.eq(0).text()).toLowerCase())+1;if(!month)return;
   for(let col=1;col<cells.length;col++){
    const field=headers[col];if(!field||!/(Fort Barchon|Wilderness)/i.test(field))continue;
    const days=clean(cells.eq(col).text());if(!days||days==='/')continue;
    if(!/^\d{1,2}(?:\s*(?:&|,|en)\s*\d{1,2})*$/.test(days))throw Error('Airsoften.be: onbekende datumreeks '+days);
    for(const day of days.match(/\d+/g)){const d=date(year,month,day);if(!d)throw Error('Airsoften.be: ongeldige kalenderdatum.');
     const key=field+':'+d;out.set(key,{id:stable('airsoften-be',key),sourceId:'airsoften-be',organizer:'Airsoften.be',title:'Open skirm '+field,location:field,country:'BE',date:d,sourceUrl:base,image,price,rental,dateEvidence:`${day} ${months[month-1]} ${year} uit de officiële jaarkalender.`,detailNote:'Prijs voor eigen uitrusting en huurprijs uit de skirmkalender. Controleer actuele tijden en reservering bij de organisator.'});
    }
   }
  });
 });
 if(!out.size)throw Error('Airsoften.be: geen kalenderdagen herkend.');return [...out.values()];
}

export function parseAntwerp(payload){
 if(!Array.isArray(payload?.events))throw Error('Antwerp Airsoft: onbekend agendaformaat.');
 const out=new Map();for(const e of payload.events){if(!e.id||!e.title||e.hide_from_listings||e.status&&e.status!=='publish')continue;
  const start=String(e.start_date||''),end=String(e.end_date||'');if(!validDate(start.slice(0,10))||!validDate(end.slice(0,10)))throw Error('Antwerp Airsoft: ongeldige datum.');
  const desc=load(e.description||''),title=plain(e.title),location=plain(e.venue?.city||e.venue?.venue)||(/peer|limburg/i.test(title)?'Peer':/antwerpen/i.test(title)?'Antwerpen':'Locatie niet vermeld');
  const prices=(e.cost_details?.values||[]).map(v=>Number(String(v).replace(',','.'))).filter(v=>Number.isFinite(v)&&v>=0);
  const sourceUrl=link(e.url,'https://antwerpairsoft.be');if(!sourceUrl)throw Error('Antwerp Airsoft: evenementlink ontbreekt.');
  out.set(String(e.id),{id:stable('antwerp-airsoft',String(e.id)),sourceId:'antwerp-airsoft',organizer:'Antwerp Airsoft',title,location,country:'BE',address:clean(e.venue?.address),date:start.slice(0,10),endDate:end.slice(0,10)!==start.slice(0,10)?end.slice(0,10):null,start:e.all_day?null:start.slice(11,16),end:e.all_day?null:end.slice(11,16),sourceUrl,image:link(e.image?.url||desc('img').first().attr('src'),'https://antwerpairsoft.be')||'./icon.svg',price:prices.length?Math.min(...prices):euro(e.cost),pricePrefix:prices.length>1?'Vanaf ':'',description:plain(e.description),cancelled:e.event_status==='cancelled'||e.event_status==='canceled',dateEvidence:'Lokale datum en tijd zoals gepubliceerd in de openbare Antwerp Airsoft-agenda.',detailNote:'Tickets en beschikbaarheid bij de organisator controleren. De website vermeldt deze tijden; er wordt geen tijdzoneverschuiving toegepast.'});
 }return [...out.values()];
}

export async function collectAntwerp(getHtml){
 let page='https://antwerpairsoft.be/wp-json/tribe/events/v1/events?per_page=50';const seen=new Set(),events=new Map(),received=new Set();let expected=null;
 while(page){if(seen.has(page)||seen.size>=40)throw Error('Antwerp Airsoft: onvolledige of herhalende paginering.');
  const u=new URL(page);if(u.origin!=='https://antwerpairsoft.be'||!u.pathname.startsWith('/wp-json/tribe/events/v1/events'))throw Error('Antwerp Airsoft: onverwachte volgende pagina.');seen.add(page);
  const payload=JSON.parse(await getHtml(page));if(expected===null&&Number.isInteger(payload.total))expected=payload.total;
  for(const e of parseAntwerp(payload))events.set(e.id,e);for(const e of payload.events)received.add(String(e.id));
  page=payload.next_rest_url||null;
  if(!page&&expected!==null&&received.size<expected)throw Error('Antwerp Airsoft: niet alle agenda-items ontvangen.');
 }
 if(!events.size)throw Error('Antwerp Airsoft: geen evenementen herkend.');return {events:[...events.values()],errors:[]};
}

export function parseAirborne(html){
 const $=load(html),base='https://www.airborne-events.be',out=new Map(),years=new Map();let field='';
 $('h1,h2,h3,p,a[data-wnd_product_item_data]').each((_,el)=>{
  const node=$(el),t=clean(node.text());if(/^blackwood$/i.test(t))field='Blackwood';else if(/^fort cognel[ée]e$/i.test(t))field='Fort Cognelée';
  if(/^Tijden:/i.test(t)&&field){const y=[...new Set(t.match(/\b20\d{2}\b/g)||[])];years.set(field,y.length===1?y[0]:null);}
  const raw=node.attr('data-wnd_product_item_data');if(!raw)return;const p=JSON.parse(raw),title=clean(p.name);
  const m=title.toLowerCase().match(new RegExp('(\\d{1,2})\\s+('+months.join('|')+')(?:\\s+(20\\d{2}))?'));if(!m)return;
  const location=clean(p.category),year=m[3]||years.get(location),d=year?date(year,months.indexOf(m[2])+1,m[1]):null;
  const sourceUrl=link(p.detail_url,base);if(!sourceUrl||!p.id)return;
  out.set(String(p.id),{id:stable('airborne-events',String(p.id)),sourceId:'airborne-events',organizer:'Airborne Events',title,location,country:'BE',date:d,sourceUrl,image:link(p.image?.at(-1),base)||'./icon.svg',dateEvidence:year?`Datum uit producttitel; jaartal ${year} uit de bijbehorende terreinagenda.`:'Jaartal niet eenduidig vermeld; datum blijft ter controle.',detailNote:'Entree wordt bepaald uit ticketvarianten, niet uit eten, huur of accessoires.'});
 });return [...out.values()];
}

export function airborneDetails(html,event){
 const $=load(html),root=$('[data-wnd_product_data]').first();if(!root.length)throw Error('Ticketgegevens ontbreken.');
 const product=JSON.parse(root.attr('data-wnd_product_data')),labels=new Map();
 $('select option').each((_,e)=>labels.set($(e).attr('value'),clean($(e).text())));
 const ticketVariants=(product.variants||[]).filter(v=>{const label=(v.option_ids||[]).map(id=>labels.get(String(id))||'').join(' ');return /skirm|ticket|losse dag|entree|inkom/i.test(label)&&!/huur|brood|hamburger|bbq|eten|overnacht/i.test(label);});
 const prices=ticketVariants.map(v=>Number(v.price)).filter(v=>Number.isFinite(v)&&v>=0);
 const desc=root.find('.b-e-d-desc').length?root.find('.b-e-d-desc').text():root.text();
 const result={price:prices.length?Math.min(...prices):null,pricePrefix:prices.length>1?'Vanaf ':'',soldOut:ticketVariants.length?ticketVariants.every(v=>v.out_of_stock===true):product.out_of_stock===true,description:clean(desc),detailNote:'Entree uit de ticketvarianten. Eten, huur en overnachting zijn niet inbegrepen. Controleer de gekozen dag- of avondvariant en tijden bij de organisator.'};
 const explicit=clean(desc).toLowerCase().match(new RegExp('(\\d{1,2})\\s+('+months.join('|')+')\\s+(20\\d{2})'));
 if(explicit){const d=date(explicit[3],months.indexOf(explicit[2])+1,explicit[1]);if(d){result.date=d;result.dateEvidence='Volledige datum in de evenementbeschrijving van Airborne Events.';}}
 const night=clean(desc).match(/start game\s*(\d{2}:\d{2})\s*tot\s*(\d{2}:\d{2})/i);
 if(night){result.start=night[1];result.end=night[2];const d=result.date||event.date;if(d&&night[2]<=night[1])result.endDate=nextDay(d);}
 return result;
}

export async function collectAirborne(source,getHtml){
 const events=parseAirborne(await getHtml(source.url));if(!events.length)throw Error('Airborne Events: geen gedateerde ticketproducten herkend.');
 const errors=[];let cursor=0;await Promise.all(Array.from({length:Math.min(3,events.length)},async()=>{while(cursor<events.length){const e=events[cursor++];try{Object.assign(e,airborneDetails(await getHtml(e.sourceUrl),e));}catch(err){errors.push(e.title+': '+err.message);}}}));return {events,errors};
}
