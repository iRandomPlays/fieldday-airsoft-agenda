import {load} from 'cheerio';
import {createHash} from 'node:crypto';
import {validDate} from './parser.mjs';

export const DUTCH_SOURCES=[
  {id:'balls-and-arrows',name:'Balls and Arrows',url:'https://ballsandarrows.nl/airsoft/open-skirm-aanmelden'},
  {id:'gladiator-sports',name:'Gladiator Sports',url:'https://www.gladiator.nl/open-skirm'},
  {id:'copperhead-tactical',name:'Copperhead Tactical',url:'https://copperheadtactical.eu/reserveren/'},
  {id:'delta-airsoft',name:'Delta Airsoft Events',url:'https://www.deltaairsoft.nl/reserveer'}
];
export const DELTA_PRODUCTS='https://webshop.one.com/api/v1/cluster/deltaairsoft.nl/domain/deltaairsoft.nl/shopfront/products';
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const key=(source,value)=>createHash('sha256').update(source+':'+value).digest('hex').slice(0,20);
const https=(value,base)=>{try{const u=new URL(value,base);return u.protocol==='https:'?u.href:null;}catch{return null;}};
const number=value=>value!==null&&value!==undefined&&String(value).trim()!==''&&Number.isFinite(Number(String(value).replace(',','.')))?Number(String(value).replace(',','.')):null;
const dateDMY=s=>{const m=String(s).match(/\b(\d{1,2})-(\d{1,2})-(20\d{2})\b/),d=m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:null;return validDate(d)?d:null;};
const baseEvent=(source,value)=>({id:key(source.id,value),sourceId:source.id,organizer:source.name,country:'NL'});
const source=id=>DUTCH_SOURCES.find(s=>s.id===id);

export function parseBalls(html){
  const $=load(html),s=source('balls-and-arrows'),out=new Map();
  $('input.chosen-skirm[name="skirm"]').each((_,el)=>{
    const input=$(el),value=input.attr('value'),inputId=input.attr('id');
    const label=$('label').filter((_,l)=>$(l).attr('for')===inputId).first();
    const labelText=clean(label.text()),date=dateDMY(labelText);
    if(!value||!date||!labelText)throw Error('Balls and Arrows: onleesbare evenementdatum.');
    const row=input.parent().parent(),status=clean(label.parent().find('span').text());
    out.set(value,{...baseEvent(s,value),title:labelText.replace(/^\d{1,2}-\d{1,2}-20\d{2}\s*-\s*/,''),date,
      location:'Lelystad',terrain:'Woodland',sourceUrl:s.url,image:'./icon.svg',price:number(input.attr('entree')),
      soldOut:/uitverkocht|geen plaatsen|volgeboekt/i.test(status)||input.is(':disabled'),
      description:clean(row.find('[class^="descr_skirm"]').text()),
      dateEvidence:'Volledige datum uit het openbare SkirmInControl-aanmeldformulier van Balls and Arrows.',
      detailNote:'Entree met eigen uitrusting. Huursets, eten en eventuele betaalkosten komen erbij. Controleer speeltijden bij de organisator.'});
  });
  return [...out.values()];
}

export function parseDelta(payload){
  if(!Array.isArray(payload?.products)||!Number.isInteger(payload.totalCount)||payload.totalCount!==payload.products.length)
    throw Error('Delta: onvolledige of onbekende productlijst; vorige gegevens blijven bewaard.');
  const s=source('delta-airsoft'),out=new Map();
  for(const p of payload.products){
    if(p.archived||!p.id||typeof p.name!=='string'||!/skirm|airsoft/i.test(p.name))continue;
    const date=dateDMY(p.name);if(!date)throw Error('Delta: evenement zonder leesbare volledige datum.');
    const times=p.name.match(/\b([0-2]\d:[0-5]\d)\s*[-–]\s*([0-2]\d:[0-5]\d)\b/);
    const variants=Array.isArray(p.variants)?p.variants:[],prices=variants.map(v=>number(v.price)).filter(n=>n!==null&&n>=0);
    const inStock=variants.filter(v=>v.unlimited===true||Number(v.quantity)>0);
    out.set(p.id,{...baseEvent(s,p.id),title:clean(p.name),date,location:'Waalwijk',terrain:'Indoor CQB',
      sourceUrl:p.url?s.url+'#!/products/'+encodeURIComponent(p.url):s.url,image:https(p.images?.[0]?.url)||'./icon.svg',
      start:times?.[1]||null,end:times?.[2]||null,price:prices.length?Math.min(...prices):null,pricePrefix:'Vanaf ',
      soldOut:variants.length>0&&inStock.length===0,dateEvidence:'Volledige datum in de actuele productnaam van de openbare Delta-webshop; oude URL-slugs worden niet als datum gebruikt.',
      detailNote:'Ticketprijs vanaf; huuruitrusting kan apart worden aangeboden. Controleer de gekozen hal en ticketvariant.'});
  }
  return [...out.values()];
}

const months=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
export function copperDates(title,contextYear=null){
  const t=clean(title).toLowerCase(),m=t.match(new RegExp('(\\d{1,2})(?:\\s*[&–-]\\s*(\\d{1,2}))?\\s+('+months.join('|')+')(?:\\s+(20\\d{2}))?'));
  if(!m)return {date:null,endDate:null};
  const year=m[4]||contextYear,month=String(months.indexOf(m[3])+1).padStart(2,'0');
  const make=day=>{const d=year?`${year}-${month}-${day.padStart(2,'0')}`:null;return validDate(d)?d:null;};
  return {date:make(m[1]),endDate:m[2]?make(m[2]):null};
}
export function parseCopper(html,contextYear=null){
  const $=load(html),s=source('copperhead-tactical'),out=new Map();
  $('.products .product').each((_,el)=>{
    const row=$(el),a=row.find('.product-title a, .woocommerce-loop-product__link').first();
    const title=clean(row.find('.product-title,.woocommerce-loop-product__title').first().text()),link=https(a.attr('href'),s.url);
    if(!title||!link||new URL(link).hostname!=='copperheadtactical.eu')return;
    const dates=copperDates(title,contextYear);if(!dates.date&&!/\d{1,2}\s+(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)/i.test(title))return;
    const prices=row.find('.price bdi').map((_,a)=>number($(a).text().replace(/[^\d,.]/g,''))).get().filter(n=>n!==null);
    out.set(link,{...baseEvent(s,link),title,...dates,sourceUrl:link,location:'Assen',terrain:'Outdoor',
      image:https(row.find('img').first().attr('data-orig-src')||row.find('img').first().attr('src'),s.url)||'./icon.svg',
      price:prices.length?Math.min(...prices):null,pricePrefix:prices.length>1?'Vanaf ':'',soldOut:row.hasClass('outofstock'),
      dateEvidence:dates.date?`Datum uit de Copperhead-productnaam${/20\d{2}/.test(title)?'.':`; jaartal ${contextYear} uit de andere gedateerde evenementen op dezelfde agenda.`}`:'Jaartal ontbreekt of is niet eenduidig; controle vereist.'});
  });
  return [...out.values()];
}
export function copperDetails(html){
  const $=load(html),description=clean($('.woocommerce-product-details__short-description').first().text());
  const time=label=>description.match(new RegExp(label+'\\s*:?\\s*([0-2]\\d:[0-5]\\d)','i'))?.[1]||null;
  return {start:time('poort open'),end:time('gameplay end'),description,detailNote:'Begintijd is de opening van de poort. Bekijk briefing, speeltijden en eventuele overnachting op de originele evenementpagina.'};
}
export function parseGladiator(info,product,now=new Date()){
  const $=load(info),p=load(product),s=source('gladiator-sports');$('script,style,nav,footer,header').remove();
  if(!/elke laatste zondag van de maand/i.test(clean($('body').text()))||!/open airsoft skirm/i.test(p('h1').text()))throw Error('Gladiator: terugkerende skirm niet meer bevestigd door de bron.');
  const basePrice=number(p('#product_price').attr('value'));
  const insurance=p('select').filter((_,el)=>/ongevallenverzekering/i.test(p(el).parent().parent().text())).find('option').filter((_,el)=>/verplicht/i.test(p(el).text())).first();
  const surcharge=number(insurance.attr('data-price'));
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const start=new Date(today+'T12:00:00Z'),limit=new Date(start);limit.setUTCDate(limit.getUTCDate()+90);const out=[];
  for(let offset=0;offset<4;offset++){
    const last=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+offset+1,0,12));last.setUTCDate(last.getUTCDate()-last.getUTCDay());
    if(last<start||last>limit)continue;const date=last.toISOString().slice(0,10);
    out.push({...baseEvent(s,date),title:'Gladiator Sports – Open skirm',date,location:'Almere',terrain:'Woodland',sourceUrl:s.url,image:'./icon.svg',
      price:basePrice!==null&&surcharge!==null?basePrice+surcharge:null,recurring:true,
      dateEvidence:'Berekend uit de gepubliceerde herhaling: elke laatste zondag van de maand (maximaal 90 dagen vooruit). Geen afzonderlijk gedateerd ticket.',
      detailNote:'Terugkerende skirm volgens de organisator. Bevestig datum, tijden en beschikbaarheid vóór boeken. Entree inclusief verplichte verzekering indien vermeld; extra opties komen erbij.'});
  }
  return out;
}

export async function collectDutch(source,getHtml,now=new Date()){
  let events,errors=[];
  if(source.id==='balls-and-arrows'){
    const page=load(await getHtml(source.url)),frame=page('iframe').map((_,el)=>https(page(el).attr('src'),source.url)).get().find(u=>u&&new URL(u).hostname==='forms.skirmincontrol.nl');
    if(!frame)throw Error('Balls and Arrows: aanmeldkalender niet gevonden.');events=parseBalls(await getHtml(frame));
  }else if(source.id==='delta-airsoft')events=parseDelta(JSON.parse(await getHtml(DELTA_PRODUCTS)));
  else if(source.id==='gladiator-sports'){
    const info=await getHtml(source.url),$=load(info),product=$('a[href]').map((_,el)=>https($(el).attr('href'),source.url)).get().find(u=>u&&new URL(u).pathname==='/webshop/product/88973');
    if(!product)throw Error('Gladiator: skirmticket niet gevonden.');events=parseGladiator(info,await getHtml(product),now);
  }else if(source.id==='copperhead-tactical'){
    const pages=[],visited=new Set();let next=source.url;
    while(next){if(visited.has(next)||visited.size>=20)throw Error('Copperhead: onvolledige paginering.');visited.add(next);const html=await getHtml(next);pages.push(html);const $=load(html),value=$('.woocommerce-pagination a.next').attr('href');next=value?https(value,source.url):null;if(value&&(!next||new URL(next).hostname!=='copperheadtactical.eu'))throw Error('Copperhead: onbekende vervolgpagina.');}
    const titles=pages.flatMap(h=>{const $=load(h);return $('.product-title,.woocommerce-loop-product__title').map((_,el)=>$(el).text()).get();});
    const years=[...new Set(titles.flatMap(t=>t.match(/\b20\d{2}\b/g)||[]))],year=years.length===1?years[0]:null;
    events=[...new Map(pages.flatMap(h=>parseCopper(h,year)).map(e=>[e.id,e])).values()];
    let cursor=0;await Promise.all(Array.from({length:Math.min(3,events.length)},async()=>{while(cursor<events.length){const event=events[cursor++];try{Object.assign(event,copperDetails(await getHtml(event.sourceUrl)));}catch(e){errors.push(`${event.title}: ${e.message}`);}}}));
  }else throw Error('Onbekende Nederlandse bron.');
  if(!events?.length)throw Error('Geen evenementen herkend; bestaande gegevens blijven bewaard.');
  return {events,errors};
}
