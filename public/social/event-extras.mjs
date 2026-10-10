import {validDate,PLACES,safeLink} from './model.mjs';
const DAY=86400000;
const addDays=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*DAY).toISOString().slice(0,10);
const time=value=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value)?value:null;
const today=now=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
function zonedTime(date,clock,zone){
  const target=Date.parse(date+'T'+clock+':00Z');
  const fmt=new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const local=stamp=>Object.fromEntries(fmt.formatToParts(new Date(stamp)).map(p=>[p.type,p.value]));
  let guess=target;
  for(let i=0;i<4;i++){const p=local(guess);const seen=Date.parse(p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute+':'+p.second+'Z');const correction=target-seen;if(!correction)return guess;guess+=correction;}
  throw Error('Deze begintijd bestaat niet door de overgang naar zomertijd. Pas de tijd in je agenda aan.');
}
export function calendarEvent(e){
  if(!validDate(e.date)||e.endDate&&(!validDate(e.endDate)||e.endDate<e.date))throw Error('Dit evenement heeft geen geldige datum.');
  const endDate=e.endDate||e.date,zone=e.country==='BE'?'Europe/Brussels':'Europe/Amsterdam',startTime=time(e.start),endTime=time(e.end);
  const allDay=!startTime;let start,end,note='';
  if(allDay){start=Date.parse(e.date+'T00:00:00Z');end=Date.parse(addDays(endDate,1)+'T00:00:00Z');note='Begintijd niet vermeld; als hele dag toegevoegd. Controleer de tijden bij de organisator.';}
  else{start=zonedTime(e.date,startTime,zone);
    if(endTime){end=zonedTime(endDate,endTime,zone);if(end<=start&&endDate===e.date)end=zonedTime(addDays(endDate,1),endTime,zone);if(end<=start)throw Error('De eindtijd ligt vóór de begintijd.');}
    else if(endDate!==e.date){end=zonedTime(addDays(endDate,1),'00:00',zone);note='Eindtijd niet eenduidig vermeld; voorlopig tot het einde van de laatste dag. Pas dit zo nodig aan.';}
    else{end=start+3600000;note='Eindtijd niet eenduidig vermeld; voorlopig één uur ingepland. Pas dit aan in je agenda.';}
  }
  const location=[e.address,e.location].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ');
  const description=['Organisator: '+(e.organizer||'Niet vermeld'),e.price!=null?'Entree: '+(e.pricePrefix||'')+new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(e.price):'',e.start?'Begintijd volgens bron: '+e.start:'',e.end?'Eindtijd volgens bron: '+e.end:'',note,safeLink(e.sourceUrl)||'','Toevoegen aan je agenda is geen officiële boeking bij het airsoftveld.'].filter(Boolean).join('\n');
  return {id:e.id,title:e.title,location,description,start,end,allDay,zone,note};
}
const utc=ms=>new Date(ms).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
export function googleCalendarUrl(event){const date=ms=>event.allDay?utc(ms).slice(0,8):utc(ms);const q=new URLSearchParams({action:'TEMPLATE',text:event.title,dates:date(event.start)+'/'+date(event.end),details:event.description,location:event.location,ctz:event.zone});return 'https://calendar.google.com/calendar/render?'+q;}
const icsEscape=value=>String(value??'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
function fold(line){let out='',size=0;for(const c of line){const bytes=new TextEncoder().encode(c).length;if(size+bytes>75){out+='\r\n ';size=1;}out+=c;size+=bytes;}return out;}
export function calendarIcs(event,now=new Date()){
 const stamp=ms=>event.allDay?utc(ms).slice(0,8):utc(ms),type=event.allDay?';VALUE=DATE':'';
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Fieldday//Airsoft agenda//NL','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+icsEscape(event.id)+'@fieldday-airsoft','DTSTAMP:'+utc(now.getTime()),'DTSTART'+type+':'+stamp(event.start),'DTEND'+type+':'+stamp(event.end),'SUMMARY:'+icsEscape(event.title),'LOCATION:'+icsEscape(event.location),'DESCRIPTION:'+icsEscape(event.description),'END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
export function weatherLabel(code){
 if(code===0)return '☀️ Onbewolkt';if([1,2].includes(code))return '🌤️ Licht bewolkt';if(code===3)return '☁️ Bewolkt';if([45,48].includes(code))return '🌫️ Mist';if([51,53,55,56,57].includes(code))return '🌦️ Motregen';if([61,63,65,66,67,80,81,82].includes(code))return '🌧️ Regen';if([71,73,75,77,85,86].includes(code))return '🌨️ Sneeuw';if([95,96,99].includes(code))return '⛈️ Onweer';return 'Weerbeeld niet beschikbaar';
}
export function weatherWindow(e,now=new Date()){
 if(!validDate(e.date))return {state:'invalid'};const day=today(now),end=validDate(e.endDate)&&e.endDate>=e.date?e.endDate:e.date;
 if(end<day)return {state:'past'};if(e.date>addDays(day,15))return {state:'future',availableFrom:addDays(e.date,-15)};
 return {state:'available',from:e.date<day?day:e.date,to:end>addDays(day,15)?addDays(day,15):end,partial:end>addDays(day,15)};
}
export function createWeatherService({fetchImpl=fetch,clock=()=>new Date(),places=PLACES}={}){
 const cache=new Map(),pending=new Map();
 return async e=>{
  const window=weatherWindow(e,clock());if(window.state!=='available')return window;
  const point=places[e.location];if(!point||!Number.isFinite(point.lat)||!Number.isFinite(point.lng))return {state:'unknown-location'};
  const key=point.lat+','+point.lng;let item=cache.get(key),stale=false;
  if(!item||clock().getTime()-item.at>3600000){
   try{if(!pending.has(key)){const request=(async()=>{
     const q=new URLSearchParams({latitude:point.lat,longitude:point.lng,timezone:'Europe/Amsterdam',forecast_days:'16',wind_speed_unit:'kmh',daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max'});
     const r=await fetchImpl('https://api.open-meteo.com/v1/forecast?'+q,{signal:AbortSignal.timeout(12000),credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw Error('Weer niet bereikbaar');const body=await r.json();
     if(!Array.isArray(body.daily?.time))throw Error('Ongeldig weerbericht');const result={at:clock().getTime(),daily:body.daily};cache.set(key,result);return result;
   })();pending.set(key,request);request.finally(()=>pending.delete(key)).catch(()=>{});}
   item=await pending.get(key);
   }catch{if(!item)return {state:'unavailable'};stale=true;}
  }
  const number=(field,i)=>typeof item.daily[field]?.[i]==='number'&&Number.isFinite(item.daily[field][i])?item.daily[field][i]:null;
  const days=item.daily.time.flatMap((date,i)=>date>=window.from&&date<=window.to?[{date,code:number('weather_code',i),min:number('temperature_2m_min',i),max:number('temperature_2m_max',i),rainChance:number('precipitation_probability_max',i),rain:number('precipitation_sum',i),wind:number('wind_speed_10m_max',i)}]:[]);
  return days.length?{state:'ready',days,at:item.at,stale,partial:window.partial}:{state:'unavailable'};
 };
}
