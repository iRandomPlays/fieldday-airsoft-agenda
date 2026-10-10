import {readFile,writeFile,copyFile,rename} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {createAndroidRelease} from '../lib/android-release.mjs';
const sdk=process.env.ANDROID_HOME||path.join(process.env.LOCALAPPDATA||'', 'Android','Sdk');
const aapt=path.join(sdk,'build-tools','36.0.0',process.platform==='win32'?'aapt2.exe':'aapt2');
const result=spawnSync(aapt,['dump','badging','outputs/Fieldday.apk'],{encoding:'utf8'});
if(result.error||result.status!==0)throw Error('Kan APK-versie niet controleren met aapt2. Stel ANDROID_HOME in op de bestaande SDK.');
const release=createAndroidRelease(await readFile('android/app/src/main/AndroidManifest.xml','utf8'),result.stdout,await readFile('outputs/Fieldday.apk'));
let previous;try{previous=JSON.parse(await readFile('public/app-update.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(previous&&release.versionCode<previous.versionCode)throw Error('Versiecode mag niet achteruit gaan.');
await copyFile('outputs/Fieldday.apk','public/downloads/Fieldday.apk');
await writeFile('public/app-update.json.tmp',JSON.stringify(release,null,2)+'\n');
await rename('public/app-update.json.tmp','public/app-update.json');
console.log('APK en verplichte updategegevens klaargezet voor Fieldday '+release.versionName+'. Publiceer beide samen via GitHub Pages.');
