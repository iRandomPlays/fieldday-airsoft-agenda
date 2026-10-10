import {createHash} from 'node:crypto';
export function createAndroidRelease(manifest, badging, apk) {
 const code=Number(manifest.match(/android:versionCode="(\d+)"/)?.[1]);
 const name=manifest.match(/android:versionName="([^"]+)"/)?.[1];
 const pkg=badging.match(/package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/);
 if(!Number.isSafeInteger(code)||code<1||code>2147483647||!/^\d+\.\d+\.\d+$/.test(name||''))throw Error('Ongeldige Android-versie.');
 if(!pkg||pkg[1]!=='nl.fieldday.app'||Number(pkg[2])!==code||pkg[3]!==name)throw Error('APK en AndroidManifest hebben niet dezelfde versie. Bouw de APK opnieuw.');
 if(!apk?.length)throw Error('Lege APK.');
 return {schemaVersion:1,versionCode:code,versionName:name,apkUrl:'https://irandomplays.github.io/fieldday-airsoft-agenda/downloads/Fieldday.apk?v='+code,sha256:createHash('sha256').update(apk).digest('hex')};
}
