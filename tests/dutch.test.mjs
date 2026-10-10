import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBalls,parseDelta,parseCopper,copperDates,copperDetails,parseGladiator,collectDutch,DUTCH_SOURCES,DELTA_PRODUCTS} from '../lib/dutch.mjs';
import {SOURCES,collectSource} from '../lib/sources.mjs';
const balls='<div><div><input class="chosen-skirm" name="skirm" id="skirm-1" value="1" entree="35"></div><div><label for="skirm-1">31-12-2026 - Balls and Arrows Oudjaar</label><span>Nog genoeg plaatsen beschikbaar.</span></div></div><div><div><input class="chosen-skirm" name="skirm" id="skirm-2" value="2" entree="40"></div><div><label for="skirm-2">03-01-2027 - Nieuwjaar</label><span>Uitverkocht</span></div></div>';
const copper=(title,url='first')=>'<ul class="products"><li class="product"><h3 class="product-title"><a href="https://copperheadtactical.eu/product/'+url+'/">'+title+'</a></h3><span class="price"><bdi>€35,00</bdi><bdi>€67,50</bdi></span></li></ul>';
const product={id:'one',name:'ZONDAG | 01-11-2026 | 20:00 - 00:00 | OPEN SKIRM',url:'old-01-04-2026',variants:[{price:17,quantity:0},{price:42,unlimited:true}],images:[{url:'https://example.com/poster.png'}]};
const info='<body><p>Elke laatste zondag van de maand open skirm</p><a href="https://www.gladiator.nl/webshop/product/88973">Aanmelden</a></body>';
const ticket='<h1>Open airsoft skirm met eigen replica</h1><input id="product_price" value="25.50"><div><label>Ongevallenverzekering</label><div><select><option data-price="1">Verplicht (+1)</option></select></div></div>';

test('Alle vier Nederlandse bronnen zijn aangesloten op de bestaande collectSource',async()=>{
  for(const source of DUTCH_SOURCES)assert.ok(SOURCES.some(s=>s.id===source.id));
  const result=await collectSource(SOURCES.find(s=>s.id==='balls-and-arrows'),async url=>url.includes('forms.skirmincontrol.nl')?balls:'<iframe src="https://forms.skirmincontrol.nl/ballsandarrows"></iframe>');
  assert.equal(result.events.length,2);assert.deepEqual(result.errors,[]);
});
test('Balls leest alle formulierdatums, jaargrenzen, entree en uitverkocht; ongeldige datum faalt veilig',()=>{
  const events=parseBalls(balls);assert.deepEqual(events.map(e=>e.date),['2026-12-31','2027-01-03']);assert.equal(events[0].price,35);assert.equal(events[0].soldOut,false);assert.equal(events[1].soldOut,true);assert.notEqual(events[0].id,events[1].id);
  assert.throws(()=>parseBalls(balls.replace('31-12-2026','31-02-2026')));
});
test('Delta gebruikt actuele productnaam, nachtelijke eindtijd, varianten en volledige broncontrole',()=>{
  const result=parseDelta({products:[product,{...product,id:'two',name:'LASERGAME',archived:false},{...product,id:'three',archived:true}],totalCount:3});
  assert.equal(result.length,1);assert.equal(result[0].date,'2026-11-01');assert.equal(result[0].start,'20:00');assert.equal(result[0].end,'00:00');assert.equal(result[0].price,17);assert.equal(result[0].soldOut,false);
  assert.equal(parseDelta({products:[{...product,variants:[{price:17,quantity:0}]}],totalCount:1})[0].soldOut,true);
  assert.throws(()=>parseDelta({products:[product],totalCount:2}));assert.throws(()=>parseDelta({error:'down'}));assert.throws(()=>parseDelta({products:[{...product,name:'Open skirm zonder datum'}],totalCount:1}));
});
test('Copperhead bewaart Halloween-combi, cursus en ontbrekend jaar zonder systeemjaar te gokken',()=>{
  assert.deepEqual(copperDates('Zaterdag én Zondag 24 & 25 Oktober – Halloween Combi','2026'),{date:'2026-10-24',endDate:'2026-10-25'});
  assert.equal(copperDates('Zondag 3 januari 2027','2026').date,'2027-01-03');assert.equal(copperDates('24 oktober').date,null);assert.equal(copperDates('31 februari 2026').date,null);
  const event=parseCopper(copper('Cursus Zaterdag 7 november 2026'))[0];assert.equal(event.date,'2026-11-07');assert.equal(event.price,35);assert.equal(event.pricePrefix,'Vanaf ');
  const detail=copperDetails('<div class="woocommerce-product-details__short-description">Poort open: 17:00 uur Gameplay start: 18:30 uur Gameplay end: 23:00</div>');assert.equal(detail.start,'17:00');assert.equal(detail.end,'23:00');
});
test('Copperhead volgt alle agendapagina’s, ontdubbelt en houdt bronjaar uit de agenda',async()=>{
  const source=DUTCH_SOURCES.find(s=>s.id==='copperhead-tactical'),page2=source.url+'page/2/';
  const pages={[source.url]:copper('Zondag 18 oktober 2026')+'<nav class="woocommerce-pagination"><a class="next" href="'+page2+'">Next</a></nav>',[page2]:copper('Zaterdag 24 oktober Halloween','second')};
  const result=await collectDutch(source,async u=>pages[u]??'<div class="woocommerce-product-details__short-description">Poort open: 08:30 Gameplay end: 16:00</div>');
  assert.deepEqual(result.events.map(e=>e.date),['2026-10-18','2026-10-24']);assert.equal(result.events[1].start,'08:30');
  await assert.rejects(collectDutch(source,async u=>{if(u===page2)throw Error('offline');return pages[u];}));
});
test('Gladiator herhaling heeft beperkte horizon, maand/jaargrens, bronbewijs en verplichte verzekering',()=>{
  const result=parseGladiator(info,ticket,new Date('2026-12-01T00:00:00Z'));
  assert.deepEqual(result.map(e=>e.date),['2026-12-27','2027-01-31','2027-02-28']);assert.equal(result[0].price,26.5);assert.equal(result[0].recurring,true);assert.match(result[0].dateEvidence,/Geen afzonderlijk/);assert.match(result[0].detailNote,/Bevestig datum/);assert.equal(result[0].soldOut,undefined);
  assert.throws(()=>parseGladiator('<body>Elke eerste zondag</body>',ticket));assert.equal(parseGladiator(info,ticket.replace('value="25.50"','value=""'))[0].price,null);
});
test('Lege of mislukte Nederlandse bronnen leveren geen succesvolle lege vervanging',async()=>{
  await assert.rejects(collectDutch(DUTCH_SOURCES[0],async()=>'<iframe src="https://evil.example/calendar"></iframe>'));
  await assert.rejects(collectDutch(DUTCH_SOURCES[3],async()=>JSON.stringify({products:[],totalCount:0})));
  await assert.rejects(collectDutch(DUTCH_SOURCES[3],async()=>{throw Error('offline');}));
});
