import test from 'node:test';
import assert from 'node:assert/strict';
import {unit13OpenItems,unit13Events,collectUnit13} from '../lib/unit13.mjs';
import {filterEvents} from '../android/app/src/main/assets/model.mjs';
const item={itemType:'Deal',itemKey:'public-open',displayName:'Airsoft Open Event',description:'<p>Open evenement</p>',prices:{person:{price:29.5}},imageLocation:'https://example.com/poster.png'};
const dates={responseData:{availableDates:[{date:'2026-10-16',salePrice:29.5},{date:'2026-10-17',salePrice:35.5}]}};
test('Unit 13 importeert openbare airsoftgames en negeert privé, junior, laser en schietbaan',()=>{
 const all=[item,{...item,itemKey:'private',displayName:'Airsoft Open Event privé'},{...item,itemKey:'laser',displayName:'Open Lasergame'},{...item,itemKey:'range',displayName:'Schietbaan airsoft 1 uur'},{...item,itemKey:'junior',displayName:'Junior Airsoft Open Event'}];assert.deepEqual(unit13OpenItems({responseData:all}),[item]);assert.throws(()=>unit13OpenItems({error:'offline'}));assert.throws(()=>unit13OpenItems({responseData:[]}));
});
test('Unit 13 bewaart daadwerkelijke datums en de prijs per dag, zonder starttijden te verzinnen',()=>{
 const events=unit13Events(item,dates,'2026-10-10','2027-10-10');assert.deepEqual(events.map(e=>e.price),[29.5,35.5]);assert.equal(events[0].location,'Nuth');assert.equal(events[0].start,undefined);assert.notEqual(events[0].id,events[1].id);assert.equal(unit13Events(item,dates,'2026-10-10','2027-10-10')[0].id,events[0].id);assert.equal(filterEvents(events,{from:'2026-10-10',region:'NL',category:'cqb'}).length,2);
 assert.equal(unit13Events(item,{responseData:{availableDates:[{date:'2026-10-16',salePrice:null}]}},'2026-10-10','2027-10-10')[0].price,29.5);
 assert.throws(()=>unit13Events(item,{responseData:{availableDates:[{date:'2026-02-30'}]}},'2026-01-01','2027-01-01'));assert.throws(()=>unit13Events(item,dates,'2026-11-01','2027-11-01'));
});
test('Unit 13 leest alleen de catalogus en beschikbaarheid en reserveert geen tickets',async()=>{
 const paths=[];const result=await collectUnit13(async()=>'<div class="bw-widget" data-domain="unit13"></div>',async(path,data)=>{paths.push(path);if(path==='OrderItems'){assert.equal(data.customFilters.items[0].values[0],'airsoft');return {responseData:[item]};}assert.equal(path,'Booking/Dates');assert.deepEqual(data.OrderItem,{type:'Deal',key:'public-open'});assert.equal(data.AvailabilityStartDate,'2026-10-10');return dates;},'2026-10-10');assert.deepEqual(paths,['OrderItems','Booking/Dates']);assert.equal(result.events.length,2);
});
test('Unit 13 behoudt bestaande agenda bij gewijzigde widget, lege beschikbaarheid of bronfout',async()=>{
 await assert.rejects(collectUnit13(async()=>'<html>Storing</html>'),/veranderd/);
 await assert.rejects(collectUnit13(async()=>'<div class="bw-widget" data-domain="unit13"></div>',async path=>path==='OrderItems'?{responseData:[item]}:{responseData:{availableDates:[]}},'2026-10-10'),/geen beschikbare/);
 await assert.rejects(collectUnit13(async()=>{throw Error('offline');}),/offline/);
});
