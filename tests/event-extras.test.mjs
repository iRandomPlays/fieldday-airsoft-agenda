import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calendarEvent,googleCalendarUrl,calendarIcs,weatherWindow,createWeatherService,weatherLabel} from '../android/app/src/main/assets/event-extras.mjs';
const base={id:'event',title:'Sunday Skirm',date:'2026-10-18',location:'Nuth',organizer:'Unit 13',sourceUrl:'https://example.com/event',start:'09:00',end:'16:00'};
test('Agenda behoudt lokale NL/BE tijden, wintertijd en nachtgames',()=>{
 const normal=calendarEvent(base);assert.equal(new Date(normal.start).toISOString(),'2026-10-18T07:00:00.000Z');assert.equal(new Date(normal.end).toISOString(),'2026-10-18T14:00:00.000Z');
 const winter=calendarEvent({...base,country:'BE',date:'2026-10-25'});assert.equal(winter.zone,'Europe/Brussels');assert.equal(new Date(winter.start).toISOString(),'2026-10-25T08:00:00.000Z');
 const night=calendarEvent({...base,date:'2026-10-24',start:'23:00',end:'04:00'});assert.equal((night.end-night.start)/3600000,6);
 const explicit=calendarEvent({...base,date:'2026-10-24',endDate:'2026-10-25',start:'23:00',end:'04:00'});assert.equal(explicit.end,night.end);
 assert.throws(()=>calendarEvent({...base,date:'2026-03-29',start:'02:30'}),/zomertijd/);
});
test('Geen begintijd geeft een hele dag; meerdaags eindigt exclusief de volgende dag',()=>{
 const e=calendarEvent({...base,date:'2026-10-31',endDate:'2026-11-02',start:null});assert.equal(e.allDay,true);
 assert.match(googleCalendarUrl(e),/dates=20261031%2F20261103/);assert.match(calendarIcs(e),/DTEND;VALUE=DATE:20261103/);assert.match(e.note,/Begintijd niet vermeld/);
 const unknownEnd=calendarEvent({...base,end:'15.30 - 16.00'});assert.equal(unknownEnd.end-unknownEnd.start,3600000);assert.match(unknownEnd.description,/voorlopig één uur/);
 assert.throws(()=>calendarEvent({...base,date:'2026-02-30'}));assert.throws(()=>calendarEvent({...base,endDate:'2026-10-17'}));
});
test('Google Agenda en ICS bevatten titel, adres, bron en veilige tekst met stabiel event-ID',()=>{
 const e=calendarEvent({...base,title:'Één, twee; drie\nBEGIN:VEVENT',address:'Straat 1',price:35});const url=new URL(googleCalendarUrl(e));assert.equal(url.origin,'https://calendar.google.com');assert.equal(url.searchParams.get('text'),e.title);assert.equal(url.searchParams.get('location'),'Straat 1, Nuth');assert.match(url.searchParams.get('details'),/https:\/\/example.com\/event/);
 const ics=calendarIcs(e,new Date('2026-10-10T12:00Z'));assert.match(ics,/UID:event@fieldday-airsoft/);assert.equal(ics.split('\r\n').filter(line=>line==='BEGIN:VEVENT').length,1);assert.match(ics,/SUMMARY:Één\\, twee\\; drie\\nBEGIN:VEVENT/);
 const long=calendarIcs({...e,title:'🎯'.repeat(80)});for(const line of long.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
});
const now=new Date('2026-10-10T12:00Z');
test('Weer alleen op echte speeldagen binnen de 16-daagse horizon',()=>{
 assert.equal(weatherWindow({...base,date:'2026-10-25'},now).state,'available');assert.equal(weatherWindow({...base,date:'2026-10-26'},now).state,'future');assert.equal(weatherWindow({...base,date:'2026-10-26'},now).availableFrom,'2026-10-11');
 assert.equal(weatherWindow({...base,date:'2026-10-09'},now).state,'past');assert.equal(weatherWindow({...base,date:'2026-02-30'},now).state,'invalid');
 const ongoing=weatherWindow({...base,date:'2026-10-09',endDate:'2026-10-27'},now);assert.equal(ongoing.from,'2026-10-10');assert.equal(ongoing.to,'2026-10-25');assert.equal(ongoing.partial,true);
});
const fixture={daily:{time:['2026-10-18','2026-10-19'],weather_code:[3,61],temperature_2m_min:[7,null],temperature_2m_max:[16,15],precipitation_probability_max:[20,80],precipitation_sum:[0,4],wind_speed_10m_max:[15,20]}};
test('Weer gebruikt evenementcoördinaten, deelt verzoeken en bewaart een uur per locatie',async()=>{
 let calls=0;const service=createWeatherService({clock:()=>now,fetchImpl:async(url,options)=>{calls++;const q=new URL(url).searchParams;assert.equal(q.get('latitude'),'50.917');assert.equal(q.get('forecast_days'),'16');assert.equal(options.credentials,'omit');return {ok:true,json:async()=>fixture};}});
 const [one,two]=await Promise.all([service(base),service({...base,date:'2026-10-19'})]);assert.equal(calls,1);assert.equal(one.days[0].date,'2026-10-18');assert.equal(two.days[0].date,'2026-10-19');assert.equal(two.days[0].min,null);await service(base);assert.equal(calls,1);
 assert.equal((await service({...base,location:'Onbekend'})).state,'unknown-location');assert.equal((await service({...base,date:'2026-12-01'})).state,'future');assert.equal(calls,1);
});
test('Weeruitval gebruikt herkenbaar oude data en kan daarna opnieuw ophalen',async()=>{
 let date=now,fail=false,calls=0;const service=createWeatherService({clock:()=>date,fetchImpl:async()=>{calls++;if(fail)throw Error('offline');return {ok:true,json:async()=>fixture};}});
 await service(base);date=new Date(now.getTime()+3600001);fail=true;const old=await service(base);assert.equal(old.stale,true);assert.equal(old.at,now.getTime());fail=false;const fresh=await service(base);assert.equal(fresh.stale,false);assert.equal(calls,3);
 for(const fetchImpl of [async()=>({ok:false}),async()=>({ok:true,json:async()=>({})}),async()=>{throw Error('offline');}]){const service=createWeatherService({clock:()=>now,fetchImpl});assert.equal((await service(base)).state,'unavailable');assert.equal((await service(base)).state,'unavailable');}
});

test('Detailpagina rendert het juiste weer en opent een ingevulde agenda op Android en web',async()=>{
 const {readFileSync}=await import('node:fs');const {createContext,runInContext}=await import('node:vm');
 const source=readFileSync('android/app/src/main/assets/app.js','utf8');const functions=source.slice(source.indexOf('async function loadWeather('),source.indexOf('async function refresh('));
 const info={innerHTML:''},dialog={opened:false,showModal(){this.opened=true;}},panel={isConnected:true,innerHTML:''};let payload;
 const context=createContext({weatherService:async()=>({state:'ready',days:[{date:'2026-10-18',code:3,min:8,max:15,rainChance:25,rain:1,wind:20}],at:now.getTime()}),
  weatherLabel,calendarEvent,googleCalendarUrl,calendarIcs,Intl,Date,esc:s=>String(s??''),long:d=>d,data:{events:[base]},navigator:{userAgent:'FielddayAndroid'},
  $:s=>s==='#info-body'?info:dialog,prompt:(name,body)=>{assert.equal(name,'fieldday:calendar');payload=JSON.parse(body);return 'ok';},notice:()=>assert.fail('Onverwachte fout')});
 runInContext(functions,context);await context.loadWeather(base,panel);assert.match(panel.innerHTML,/2026-10-18/);assert.match(panel.innerHTML,/25%/);assert.match(panel.innerHTML,/Open-Meteo/);
 const gone={isConnected:false,innerHTML:'oud'};await context.loadWeather(base,gone);assert.equal(gone.innerHTML,'oud');
 context.addCalendar(base.id);assert.equal(payload.title,base.title);assert.equal(payload.start,calendarEvent(base).start);assert.equal(dialog.opened,false);
 context.navigator.userAgent='Browser';context.addCalendar(base.id);assert.equal(dialog.opened,true);assert.match(info.innerHTML,/calendar.google.com/);assert.match(info.innerHTML,/Agendabestand downloaden/);
});
