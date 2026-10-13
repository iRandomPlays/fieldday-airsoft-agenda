import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
const root='public/social';
const hash=value=>createHash('sha256').update(value).digest('hex');
const svg=await readFile('android/app/src/main/assets/logo.svg','utf8');
await mkdir(root+'/icons',{recursive:true});
for(const size of [180,192,512])await sharp(Buffer.from(svg)).resize(size,size).png().toFile(root+'/icons/'+(size===180?'apple-touch-icon':('icon-'+size))+'.png');
const manifest={id:'./',name:'Fieldday Airsoft Events',short_name:'Fieldday',lang:'nl',start_url:'./',scope:'./',display:'standalone',background_color:'#f7f5ec',theme_color:'#f7f5ec',icons:[{src:'icons/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'icons/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'}]};
await writeFile(root+'/manifest.webmanifest',JSON.stringify(manifest,null,2)+'\n');
async function files(dir,prefix=''){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?files(path.join(dir,e.name),prefix+e.name+'/'):[prefix+e.name]))).flat();}
const names=(await files(root)).filter(p=>!['sw.js','web-release.json'].includes(p)).sort();
// Normalize text before hashing so the deployed Git files match on Windows and Linux.
for(const name of names)if(/\.(m?js|css|html|json|webmanifest|txt)$/.test(name)){const p=root+'/'+name;await writeFile(p,(await readFile(p,'utf8')).replace(/\r\n/g,'\n'));}
const parts=[];for(const name of names){let data=await readFile(root+'/'+name);if(name==='web-start.mjs')data=Buffer.from(data.toString().replace(/const BUILD='[a-f0-9]{64}';/,"const BUILD='__FIELDDAY_BUILD__';"));parts.push(name+':'+hash(data));}
const version=hash(parts.join('\n')+await readFile('tools/pwa-worker.template.js','utf8'));
const boot=await readFile(root+'/web-start.mjs','utf8');await writeFile(root+'/web-start.mjs',boot.replace(/__FIELDDAY_BUILD__|(?<=const BUILD=')[a-f0-9]{64}(?=';)/,version));
const assets=[];for(const name of names)assets.push({path:name,sha256:hash(await readFile(root+'/'+name))});
const worker=(await readFile('tools/pwa-worker.template.js','utf8')).replace('__VERSION__',JSON.stringify(version)).replace('__ASSETS__',JSON.stringify(assets));await writeFile(root+'/sw.js',worker);
const manifestAndroid=await readFile('android/app/src/main/AndroidManifest.xml','utf8');const appVersion=manifestAndroid.match(/android:versionName="([^"]+)"/)[1];
await writeFile(root+'/web-release.json',JSON.stringify({schemaVersion:1,appVersion,version},null,2)+'\n');
console.log('Installeerbare Fieldday-webapp '+appVersion+' gebouwd met '+assets.length+' gecontroleerde bestanden.');
