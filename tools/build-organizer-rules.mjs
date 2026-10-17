import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {SOURCES} from '../lib/sources.mjs';
import {validateRules,checkRules} from '../lib/organizer-rules.mjs';
const source=new URL('../data/organizer-rules.json',import.meta.url);
const reviewed=validateRules(JSON.parse(await fs.readFile(source,'utf8')),SOURCES.map(s=>s.id));
const recordReview=process.argv.includes('--record-reviewed-fingerprints');
const recordNabv=process.argv.includes('--record-nabv-fingerprints');
const output=await checkRules(reviewed,{recordReview});
if(recordNabv){for(const [country,fallback] of Object.entries(reviewed.fallbacks||{})){const result=await checkRules({organizers:[fallback]},{recordReview:true});output.fallbacks[country]=result.organizers[0];}}
if(recordReview||recordNabv){
 // Explicit maintenance operation only, after actually reviewing all affected official texts.
 for(const o of [...reviewed.organizers,...Object.values(reviewed.fallbacks||{})])for(const s of o.sources){const checked=[...output.organizers,...Object.values(output.fallbacks||{})].find(p=>p.id===o.id).sources.find(p=>p.id===s.id);if(checked.checkStatus==='ok')s.reviewedFingerprint=checked.reviewedFingerprint;}
 await fs.writeFile(source,JSON.stringify(reviewed,null,2)+'\n');
}
const destination=new URL('../public/data/organizer-rules.json',import.meta.url);
await fs.mkdir(new URL('../public/data/',import.meta.url),{recursive:true});
await fs.writeFile(fileURLToPath(destination)+'.tmp',JSON.stringify(output,null,2)+'\n');
await fs.rename(fileURLToPath(destination)+'.tmp',destination);
for(const o of output.organizers)console.log(o.id+': '+o.coverage+'; '+o.sources.map(s=>s.checkStatus).join(', '));
console.log('Regels gepubliceerd naar public/data/organizer-rules.json. Bereikbaarheidscontrole verandert geen samenvattingen of inhoudelijke controledatum.');
