// Uses the existing Firebase CLI login in memory; never prints or saves credentials.
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {getGlobalDefaultAccount}=require('firebase-tools/lib/auth.js');
const {requireAuth}=require('firebase-tools/lib/requireAuth.js');
const {Client}=require('firebase-tools/lib/apiv2.js');
const {ensure}=require('firebase-tools/lib/ensureApiEnabled.js');
const {getAppConfig,AppPlatform}=require('firebase-tools/lib/management/apps.js');
const project='fieldday-airsoft-irandomplays';
const account=getGlobalDefaultAccount();if(!account)throw Error('Log eerst in met firebase login.');
await requireAuth({...account,project,nonInteractive:true});
const action=process.argv[2];
if(action==='enable'){
  const billing=new Client({urlPrefix:'https://cloudbilling.googleapis.com',apiVersion:'v1'});
  const {body}=await billing.get(`/projects/${project}/billingInfo`,{skipLog:{resBody:true}});
  if(body.billingEnabled)throw Error('Dit project heeft facturering. Stop: uitsluitend Spark toegestaan.');
  console.log('Facturering uitgeschakeld; geen betaalmiddel gekoppeld.');
  await ensure(project,'firestore.googleapis.com','Fieldday',false);
  await ensure(project,'identitytoolkit.googleapis.com','Fieldday',false);
}else if(action==='auth'){
  const client=new Client({urlPrefix:'https://identitytoolkit.googleapis.com',apiVersion:'admin/v2'});
  const {body:before}=await client.get(`/projects/${project}/config`,{skipLog:{resBody:true}});
  const authorizedDomains=[...new Set([...(before.authorizedDomains||[]),'irandomplays.github.io','appassets.androidplatform.net'])];
  await client.patch(`/projects/${project}/config`,{name:`projects/${project}/config`,signIn:{email:{enabled:true,passwordRequired:true}},authorizedDomains},{queryParams:{updateMask:'signIn.email.enabled,signIn.email.passwordRequired,authorizedDomains'},skipLog:{resBody:true}});
  console.log('E-mail/wachtwoord en Fieldday-domeinen ingesteld.');
}else if(action==='config'){
  const config=await getAppConfig('1:196515470483:web:e6226f3fcdb1b0b7724166',AppPlatform.WEB);
  await writeFile('android/app/src/main/assets/firebase-config.json',JSON.stringify({enabled:true,firebase:config,webUrl:'https://irandomplays.github.io/fieldday-airsoft-agenda/social/'},null,2)+'\n');
  console.log('Openbare Firebase-clientconfiguratie opgeslagen (geen privésleutel).');
}else throw Error('Gebruik enable, auth of config.');
