import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {invitationLinks,INVITE_ORIGIN,WEB_APP} from '../shared/invite-links.mjs';
const id='a'.repeat(64);
test('Gedeelde uitnodiging is een HTTPS App Link met dezelfde uitnodiging als webfallback',()=>{
 const links=invitationLinks(id);assert.equal(links.app,INVITE_ORIGIN+'/invite/'+id);assert.equal(links.web,WEB_APP+'#invite='+id);assert.match(links.intent,/package=nl.fieldday.app/);assert.ok(links.intent.includes('S.browser_fallback_url='+encodeURIComponent(links.web)));assert.ok(!links.intent.includes(encodeURIComponent(links.app)));assert.ok(!links.app.includes('nabv'));
});
test('Ongeldige uitnodigingscodes kunnen geen externe doorverwijzing invoegen',()=>{
 for(const value of ['',null,'../other','https://example.com',id+'?next=evil',id+'#Intent;',id.toUpperCase()])assert.throws(()=>invitationLinks(value));
});
test('Android-verificatie en Hosting wijzen naar hetzelfde domein en apppakket',()=>{
 const manifest=readFileSync('android/app/src/main/AndroidManifest.xml','utf8');assert.ok(manifest.includes('android:autoVerify="true"'));assert.ok(manifest.includes('android:host="'+new URL(INVITE_ORIGIN).host+'"'));assert.ok(manifest.includes('android:pathPrefix="/invite/"'));
 const [association]=JSON.parse(readFileSync('firebase/hosting/.well-known/assetlinks.json','utf8'));assert.equal(association.target.package_name,'nl.fieldday.app');assert.ok(association.relation.includes('delegate_permission/common.handle_all_urls'));assert.match(association.target.sha256_cert_fingerprints[0],/^([A-F0-9]{2}:){31}[A-F0-9]{2}$/);
 const config=JSON.parse(readFileSync('firebase.json','utf8'));assert.equal(config.hosting.public,'firebase/hosting');assert.ok(config.hosting.rewrites.some(r=>r.source==='/invite/**'));assert.ok(!config.hosting.ignore.includes('**/.*'));
});
test('Hosting-fallback bewaart de token, toont download en weigert externe paden',()=>{
 const script=readFileSync('firebase/hosting/invite.js','utf8');assert.ok(script.includes('([a-f0-9]{64})'));assert.ok(script.includes('location.replace(web)'));assert.ok(script.includes(WEB_APP+'#invite='));
 const html=readFileSync('firebase/hosting/index.html','utf8');assert.ok(html.includes('Android-app downloaden'));assert.ok(html.includes('no-referrer'));
});
