import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createAndroidRelease} from '../lib/android-release.mjs';
const manifest='<manifest android:versionCode="6" android:versionName="1.2.0">';
const badging="package: name='nl.fieldday.app' versionCode='6' versionName='1.2.0'";
test('Updatepublicatie verwijst naar dezelfde APK-versie en SHA256',()=>{
 const apk=Buffer.from('fixture-apk'),r=createAndroidRelease(manifest,badging,apk);
 assert.equal(r.versionCode,6);assert.equal(r.versionName,'1.2.0');assert.equal(r.apkUrl,'https://irandomplays.github.io/fieldday-airsoft-agenda/downloads/Fieldday.apk?v=6');assert.equal(r.sha256,createHash('sha256').update(apk).digest('hex'));
});
test('Updatepublicatie weigert een oude, verkeerde of lege APK',()=>{
 for(const b of [badging.replace("versionCode='6'","versionCode='5'"),badging.replace("versionName='1.2.0'","versionName='1.1.0'"),badging.replace('nl.fieldday.app','other.app')])assert.throws(()=>createAndroidRelease(manifest,b,Buffer.from('apk')));
 assert.throws(()=>createAndroidRelease(manifest,badging,Buffer.alloc(0)));assert.throws(()=>createAndroidRelease(manifest.replace('Code="6"','Code="0"'),badging,Buffer.from('apk')));
});
test('Native updatebeleid blokkeert nieuwe versies, offline controle en terugdraaien',t=>{
 const home=process.env.JAVA_HOME||(process.platform==='win32'?'C:/Program Files/Android/Android Studio/jbr':null);
 const javac=home?path.join(home,'bin',process.platform==='win32'?'javac.exe':'javac'):'javac';
 const java=home?path.join(home,'bin',process.platform==='win32'?'java.exe':'java'):'java';
 if(spawnSync(javac,['-version']).error){t.skip('JDK vereist voor native beleidstest.');return;}
 const base=path.resolve('android/build');mkdirSync(base,{recursive:true});const temp=mkdtempSync(path.join(base,'update-test-'));
 try{
  const compile=spawnSync(javac,['-d',temp,'android/app/src/main/java/nl/fieldday/app/UpdatePolicy.java','tests/UpdatePolicyTest.java'],{encoding:'utf8'});
  assert.equal(compile.status,0,compile.stderr);
  const run=spawnSync(java,['-cp',temp,'UpdatePolicyTest'],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/8 updatecontroles geslaagd/);
 }finally{if(!temp.startsWith(base+path.sep))throw Error('Ongeldige testmap.');rmSync(temp,{recursive:true,force:true});}
});

test('Gepubliceerde updategegevens passen bij de meegeleverde APK en appversie',()=>{
 const release=JSON.parse(readFileSync('public/app-update.json','utf8'));
 const manifest=readFileSync('android/app/src/main/AndroidManifest.xml','utf8');
 assert.equal(release.schemaVersion,1);assert.equal(release.versionCode,Number(manifest.match(/android:versionCode="(\d+)"/)[1]));
 assert.equal(release.versionName,manifest.match(/android:versionName="([^"]+)"/)[1]);
 assert.equal(release.sha256,createHash('sha256').update(readFileSync('public/downloads/Fieldday.apk')).digest('hex'));
 assert.equal(release.apkUrl,'https://irandomplays.github.io/fieldday-airsoft-agenda/downloads/Fieldday.apk?v='+release.versionCode);
});

test('APK-download controleert hash, omvang, onderbreking en ondertekenaar voor installatie',t=>{
 const home=process.env.JAVA_HOME||(process.platform==='win32'?'C:/Program Files/Android/Android Studio/jbr':null);
 const javac=home?path.join(home,'bin',process.platform==='win32'?'javac.exe':'javac'):'javac',java=home?path.join(home,'bin',process.platform==='win32'?'java.exe':'java'):'java';
 if(spawnSync(javac,['-version']).error){t.skip('JDK vereist voor APK-downloadtest.');return;}
 const base=path.resolve('android/build');mkdirSync(base,{recursive:true});const temp=mkdtempSync(path.join(base,'apk-test-'));
 try{const compile=spawnSync(javac,['-d',temp,'android/app/src/main/java/nl/fieldday/app/ApkDownload.java','tests/ApkDownloadTest.java'],{encoding:'utf8'});assert.equal(compile.status,0,compile.stderr);
 const run=spawnSync(java,['-cp',temp,'ApkDownloadTest',temp],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/identiteitscontroles geslaagd/);
 }finally{if(!temp.startsWith(base+path.sep))throw Error('Ongeldige testmap.');rmSync(temp,{recursive:true,force:true});}
});
test('APK-overdracht gebruikt een niet-openbare provider met alleen tijdelijke leesrechten',()=>{
 const manifest=readFileSync('android/app/src/main/AndroidManifest.xml','utf8');
 assert.ok(manifest.includes('android.permission.REQUEST_INSTALL_PACKAGES'));assert.ok(manifest.includes('android:name=".UpdateApkProvider" android:authorities="nl.fieldday.app.updates" android:exported="false" android:grantUriPermissions="true"'));assert.ok(manifest.includes('<grant-uri-permission android:path="/release.apk"/>'));assert.ok(!manifest.includes('android.permission.WRITE_EXTERNAL_STORAGE'));
});
