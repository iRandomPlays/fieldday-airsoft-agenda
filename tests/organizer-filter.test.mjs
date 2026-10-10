import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createContext,runInContext} from 'node:vm';import {load} from 'cheerio';
import * as model from '../android/app/src/main/assets/model.mjs';
const fixtures=[{id:'a',sourceId:'a',title:'Bos',date:'2026-11-01',location:'Lelystad',terrain:'Woodland'},{id:'b',sourceId:'b',title:'CQB',date:'2026-11-01',location:'Waalwijk',terrain:'Indoor CQB',soldOut:true},{id:'c',sourceId:'c',title:'BE',date:'2026-11-01',location:'Chambers'},{id:'past',sourceId:'a',title:'Oud',date:'2025-01-01'}];
test('Meervoudige organisatorselectie combineert met overige filters en favorieten',()=>{
  const options={from:'2026-10-11',organizations:['a','b']};assert.deepEqual(model.filterEvents(fixtures,options).map(e=>e.id),['a','b']);
  assert.deepEqual(model.filterEvents(fixtures,{...options,available:true}).map(e=>e.id),['a']);assert.equal(model.filterEvents(fixtures,{...options,region:'BE'}).length,0);
  assert.deepEqual(model.filterEvents(fixtures,{...options,favorites:new Set(['b'])}).map(e=>e.id),['b']);assert.equal(model.filterEvents(fixtures,{...options,organizations:[]}).length,0);
  assert.equal(model.filterEvents(fixtures,{...options,organizations:null}).length,3);
});
function app(storage=new Map()){
  const handlers={},nodes=new Map(),boxes=[];
  const node=id=>{if(!nodes.has(id))nodes.set(id,{id,checked:false,value:'',open:false,_html:'',classList:{toggle(){}},showModal(){this.open=true;},close(){this.open=false;},set innerHTML(value){this._html=value;if(id==='filter-org'){boxes.length=0;const $=load(value);$('input').each((_,el)=>boxes.push({value:$(el).attr('value'),checked:$(el).attr('checked')!==undefined,matches:s=>s==='[data-filter-org]'}));}},get innerHTML(){return this._html;}});return nodes.get(id);};
  const context=createContext({...model,platformInfo:()=>({native:true}),createWeatherService:()=>({}),
    document:{body:{classList:{toggle(){}}},querySelector:s=>node(s.replace(/^#/,'')),querySelectorAll:s=>s==='[data-filter-org]:checked'?boxes.filter(b=>b.checked):boxes,addEventListener:(name,fn)=>handlers[name]=fn},
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},window:{},console,Date,Intl,Set,AbortSignal});
  let source=readFileSync('android/app/src/main/assets/app.js','utf8').replace(/^import .*;\r?\n/gm,'');source=source.slice(0,source.indexOf("try{const cache=stored('agenda'"));runInContext(source,context);
  runInContext('render=()=>{};data={events:'+JSON.stringify(fixtures)+',sources:[{id:"a",name:"A"},{id:"b",name:"B"},{id:"c",name:"C"}]};',context);
  const click=id=>handlers.click({target:{closest:()=>({id,dataset:{}})}}),change=input=>handlers.change({target:input});
  return {context,storage,node,boxes,click,change,eval:code=>runInContext(code,context)};
}
test('Werkelijke app: meerdere vakjes, toepassen, herstart, annuleren, wissen en alle nieuwe bronnen',()=>{
  const first=app();first.eval('showFilters()');assert.equal(first.node('filter-all-organizers').checked,true);assert.ok(first.boxes.every(b=>b.checked));
  first.boxes[2].checked=false;first.change(first.boxes[2]);assert.equal(first.node('filter-all-organizers').checked,false);first.click('apply-filters');assert.equal(first.storage.get('fieldday-filter-organizations'),'["a","b"]');
  const second=app(first.storage);second.eval('showFilters()');assert.deepEqual(second.boxes.map(b=>b.checked),[true,true,false]);
  second.boxes[0].checked=false;second.change(second.boxes[0]);second.click('close-filters');assert.equal(second.storage.get('fieldday-filter-organizations'),'["a","b"]');
  second.eval('showFilters()');assert.deepEqual(second.boxes.map(b=>b.checked),[true,true,false]);second.click('reset-filters');assert.equal(second.storage.get('fieldday-filter-organizations'),'null');
  const third=app(first.storage);third.eval('data.sources.push({id:"new",name:"New"});showFilters()');assert.equal(third.boxes.length,4);assert.ok(third.boxes.every(b=>b.checked));
  third.node('filter-all-organizers').checked=false;third.change(third.node('filter-all-organizers'));third.click('apply-filters');assert.equal(third.storage.get('fieldday-filter-organizations'),'[]');
  const fourth=app(third.storage);fourth.eval('showFilters()');assert.ok(fourth.boxes.every(b=>!b.checked));fourth.node('filter-all-organizers').checked=true;fourth.change(fourth.node('filter-all-organizers'));fourth.click('apply-filters');assert.equal(fourth.storage.get('fieldday-filter-organizations'),'null');
});
test('Beschadigde voorkeuren vallen terug op alle organisatoren; volgen blijft apart',()=>{
  for(const value of ['bad','{}','42']){const instance=app(new Map([['fieldday-filter-organizations',value],['fieldday-organizers','["a"]']]));assert.equal(instance.eval('organizations'),null);assert.equal(instance.eval('followed.has("a")'),true);}
});
