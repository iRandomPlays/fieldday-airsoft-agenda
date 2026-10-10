import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAirsoften,parseAntwerp,collectAntwerp,parseAirborne,airborneDetails} from '../lib/belgium.mjs';
import {collectSource,SOURCES} from '../lib/sources.mjs';
const calendar='<h2>Skirmkalender 2026</h2><p>Eigen uitrusting € 30,00. Huren € 65,00</p><table><tr><th></th><th>Fort Barchon</th></tr><tr><td>Oktober</td><td>17 &amp; 18</td></tr><tr><td>Juli</td><td>/</td></tr><tr><td>December</td><td>5 &amp; 6</td></tr></table>';
test('Airsoften leest losse kalenderdagen, bronjaar en entree/huurprijzen',()=>{
 const events=parseAirsoften(calendar);assert.deepEqual(events.map(e=>e.date),['2026-10-17','2026-10-18','2026-12-05','2026-12-06']);assert.equal(new Set(events.map(e=>e.id)).size,4);assert.equal(events[0].price,30);assert.equal(events[0].rental,65);
 assert.throws(()=>parseAirsoften(calendar.replace('Skirmkalender 2026','Kalender')));assert.throws(()=>parseAirsoften(calendar+'<h2>Kalender 2027</h2>'));assert.throws(()=>parseAirsoften(calendar.replace('17 &amp; 18','31 oktober tot 2 november')));
});
const antwerp=(id=1)=>({id,status:'publish',title:'Avondskirm &amp; training',url:'https://antwerpairsoft.be/event/'+id,start_date:'2026-10-31 20:00:00',end_date:'2026-11-01 00:00:00',timezone:'UTC+0',cost:'&#8364;25,00',cost_details:{values:['25','60']},description:'<p>Speeldag</p><img src="/poster.jpg">',venue:{city:'Peer',address:'Kaulillerweg 122'}});
test('Antwerp behoudt vermelde lokale tijden, nacht-einddatum, plaats en vanafprijs',()=>{
 const e=parseAntwerp({events:[antwerp(),antwerp()]})[0];assert.equal(e.title,'Avondskirm & training');assert.equal(e.date,'2026-10-31');assert.equal(e.endDate,'2026-11-01');assert.equal(e.start,'20:00');assert.equal(e.location,'Peer');assert.equal(e.price,25);assert.equal(e.image,'https://antwerpairsoft.be/poster.jpg');assert.equal(parseAntwerp({events:[antwerp(),antwerp()]}).length,1);assert.throws(()=>parseAntwerp({events:[{...antwerp(),start_date:'2026-02-30 10:00:00'}]}));assert.throws(()=>parseAntwerp({error:'offline'}));
});
test('Antwerp volgt alle API-paginas en weigert onvolledige, externe of herhaalde paginering',async()=>{
 const next='https://antwerpairsoft.be/wp-json/tribe/events/v1/events?page=2';let calls=0;
 const result=await collectAntwerp(async u=>{calls++;return JSON.stringify(u===next?{events:[antwerp(2)],total:2}:{events:[antwerp(1)],total:2,next_rest_url:next});});assert.equal(calls,2);assert.equal(result.events.length,2);
 await assert.rejects(collectAntwerp(async()=>JSON.stringify({events:[antwerp()],total:2})),/niet alle/);
 await assert.rejects(collectAntwerp(async()=>JSON.stringify({events:[antwerp()],next_rest_url:'https://example.com/private'})),/onverwachte/);
 await assert.rejects(collectAntwerp(async()=>JSON.stringify({events:[antwerp()],next_rest_url:next})),/herhalende/);
});
const productLink=(id,name,category='Blackwood')=>`<a data-wnd_product_item_data='${JSON.stringify({id,name,category,detail_url:'/p/event-'+id+'/',image:['https://example.com/poster.png']})}'>${name}</a>`;
test('Airborne gebruikt het jaar van de bijbehorende terreinagenda en negeert accessoires',()=>{
 const events=parseAirborne('<h1>Blackwood</h1><p>Tijden: dag skirms 2026</p>'+productLink(1,'Zondag 22 november')+productLink(9,'Huurkit zonder datum')+'<h1>Fort Cognelée</h1><p>Tijden: dag skirms 2025</p>'+productLink(2,'Zondag 20 december','Fort Cognelée'));
 assert.deepEqual(events.map(e=>e.date),['2026-11-22','2025-12-20']);assert.equal(parseAirborne(productLink(1,'Zondag 22 november'))[0].date,null);assert.equal(parseAirborne(productLink(1,'Skirm 30 februari 2026'))[0].date,null);
});
const details=(body,variants)=>`<div data-wnd_product_data='${JSON.stringify({variants})}'><div class="b-e-d-desc">${body}</div></div><select><option value="food">Broodje hamburger</option><option value="rental">Huurkit</option><option value="ticket">Losse dag zondag</option><option value="night">Ticket Nightfall</option></select>`;
test('Airborne toont entree in plaats van eten/huur en bewaart middernacht als volgende dag',()=>{
 const e={date:'2026-11-07'};
 const html=details('start game 20:00 tot 00:00',[{option_ids:['food'],price:7},{option_ids:['rental'],price:65},{option_ids:['night'],price:25,out_of_stock:true}]);const d=airborneDetails(html,e);assert.equal(d.price,25);assert.equal(d.soldOut,true);assert.equal(d.start,'20:00');assert.equal(d.endDate,'2026-11-08');
 assert.equal(airborneDetails(details('Geen ticketprijs',[{option_ids:['food'],price:7}]),e).price,null);assert.throws(()=>airborneDetails('<html>Storing</html>',e));
});
test('Airsoften-bron blijft behouden bij lege of ongeldige kalender',async()=>{
 const source=SOURCES.find(s=>s.id==='airsoften-be');assert.equal((await collectSource(source,async()=>calendar)).events.length,4);await assert.rejects(collectSource(source,async()=>'<html>Storing</html>'));
});
