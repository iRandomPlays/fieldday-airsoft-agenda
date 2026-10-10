import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const enabled=!!process.env.FIRESTORE_EMULATOR_HOST;
test('Firestore rules enforce profile, invitation and participant access', {skip:!enabled},async()=>{
  const {initializeTestEnvironment,assertSucceeds,assertFails}=await import('@firebase/rules-unit-testing');
  const {doc,getDoc,getDocs,collection,setDoc,deleteDoc}=await import('firebase/firestore');
  const env=await initializeTestEnvironment({projectId:'demo-fieldday',firestore:{rules:await readFile('firebase/firestore.rules','utf8')}});
  const token='a'.repeat(64);
  try{
    await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();await deleteDoc(doc(db,'deletingUsers','guest'));for(const [p,v] of Object.entries({
      'users/owner':{firstName:'Owner'},'users/guest':{firstName:'Guest'},'privateNabv/guest':{number:'123456'},
      [`publicInvites/${token}`]:{eventId:'example',organizerName:'Owner',yesCount:1},
      [`eventGroups/${token}`]:{organizerId:'owner',status:'active'},
      [`eventGroups/${token}/participants/guest`]:{name:'Guest',response:'yes'},
      [`users/guest/groups/${token}`]:{eventId:'example'}
    }))await setDoc(doc(db,p),v);});
    const owner=env.authenticatedContext('owner').firestore(),guest=env.authenticatedContext('guest').firestore(),stranger=env.authenticatedContext('stranger').firestore(),anon=env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anon,'publicInvites',token)));
    await assertFails(getDocs(collection(anon,'publicInvites')));
    await assertSucceeds(getDoc(doc(guest,'users','guest')));
    await assertSucceeds(getDoc(doc(guest,'privateNabv','guest')));
    await assertFails(getDoc(doc(owner,'users','guest')));
    for(const db of [owner,stranger,anon])await assertFails(getDoc(doc(db,'privateNabv','guest')));
    await assertSucceeds(getDocs(collection(owner,'eventGroups',token,'participants')));
    await assertSucceeds(getDoc(doc(guest,'eventGroups',token,'participants','guest')));
    await assertFails(getDocs(collection(guest,'eventGroups',token,'participants')));
    await assertFails(getDoc(doc(stranger,'eventGroups',token,'participants','guest')));
    await assertFails(setDoc(doc(guest,'eventGroups',token,'participants','guest'),{registrationStatus:'registered'}));
    await assertFails(setDoc(doc(owner,'users','owner'),{nabvNumber:'injected'}));
    await assertSucceeds(getDocs(collection(guest,'users','guest','groups')));
    await assertFails(getDocs(collection(owner,'users','guest','groups')));
    await env.withSecurityRulesDisabled(context=>setDoc(doc(context.firestore(),'deletingUsers','guest'),{at:'now'}));
    await assertFails(getDoc(doc(guest,'users','guest')));
  }finally{await env.cleanup();}
});


test('Spark: real Firebase Auth + Firestore transactions and authorization',{skip:!enabled||!process.env.FIREBASE_AUTH_EMULATOR_HOST},async()=>{
 const {initializeApp,deleteApp}=await import('firebase/app');
 const {getAuth,connectAuthEmulator,createUserWithEmailAndPassword,signInWithEmailAndPassword}=await import('firebase/auth');
 const {getFirestore,connectFirestoreEmulator,doc,getDocFromServer,setDoc,terminate}=await import('firebase/firestore');
 const {firestoreService}=await import('../android/social-store.mjs');
 const apps=[];
 async function account(name){
  const app=initializeApp({projectId:'demo-fieldday',apiKey:'test-key',appId:'test'},name+Date.now());apps.push(app);
  const auth=getAuth(app);connectAuthEmulator(auth,'http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST,{disableWarnings:true});
  const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',8080);
  const email=name+'-'+Date.now()+'@example.test',password='Example-password-123';
  const signup=await createUserWithEmailAndPassword(auth,email,password);
  const update=await fetch('http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1/accounts:update?key=test-key',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer owner'},body:JSON.stringify({localId:signup.user.uid,emailVerified:true})});assert.equal(update.ok,true);
  await signInWithEmailAndPassword(auth,email,password);
  const call=firestoreService(db,auth,async()=>[{id:'example',title:'Test skirm',date:'2099-10-18',location:'Nuth'}]);
  await call('saveProfile',{firstName:name,lastName:'Test',nabvNumber:name==='guest'?'123456':''});return {db,auth,call,uid:auth.currentUser.uid};
 }
 try{
  const owner=await account('organizer'),guest=await account('guest'),other=await account('other');
  const groupId='b'.repeat(64);
  await owner.call('createGroup',{eventId:'example',requestId:groupId});
  await guest.call('respond',{groupId,response:'yes',shareNabvWithOrganizer:true,allowNabvForwarding:false});
  assert.equal((await owner.call('participants',{groupId})).participants[0].nabvNumber,'123456');
  assert.equal((await owner.call('participants',{groupId,forwarding:true})).participants[0].nabvNumber,'');
  await assert.rejects(other.call('participants',{groupId}),{code:'permission-denied'});
  await assert.rejects(getDocFromServer(doc(other.db,'privateNabv',guest.uid)),{code:'permission-denied'});
  await assert.rejects(setDoc(doc(other.db,'nabvGrants',guest.uid,'organizers',other.uid),{groupId}),{code:'permission-denied'});
  await assert.rejects(guest.call('setRegistration',{groupId,userId:guest.uid,status:'registered'}),{code:'permission-denied'});
  await owner.call('setRegistration',{groupId,userId:guest.uid,status:'registered'});
  await guest.call('respond',{groupId,response:'no'});
  const p=(await owner.call('participants',{groupId})).participants[0];assert.equal(p.registrationStatus,'registered');assert.equal(p.responseChanged,true);assert.equal(p.nabvNumber,'');
  // A previously valid grant must not permit a direct read after withdrawal.
  await assert.rejects(getDocFromServer(doc(owner.db,'privateNabv',guest.uid)),{code:'permission-denied'});
  await guest.call('respond',{groupId,response:'yes',shareNabvWithOrganizer:true,allowNabvForwarding:true});
  assert.equal((await owner.call('participants',{groupId,forwarding:true})).participants[0].nabvNumber,'123456');
  await guest.call('saveProfile',{firstName:'Guest updated',lastName:'Test',nabvNumber:'654321'});
  const updated=(await owner.call('participants',{groupId})).participants[0];assert.equal(updated.nabvNumber,'654321');assert.equal(updated.name,'Guest updated Test');
  await guest.call('respond',{groupId,response:'yes'});
  assert.equal((await owner.call('participants',{groupId})).participants[0].nabvNumber,'');
  await guest.call('deleteAccount');
  await other.call('respond',{groupId,response:'yes'});
  await owner.call('revokeGroup',{groupId});
  await assert.rejects(other.call('respond',{groupId,response:'yes'}),{code:'failed-precondition'});
  // Editing a profile and deleting an account must also work with revoked memberships.
  await other.call('saveProfile',{firstName:'Changed',lastName:'Test',nabvNumber:''});
  await other.call('deleteAccount');
  await owner.call('revokeGroup',{groupId,remove:true});
  await assert.rejects(owner.call('participants',{groupId}),{code:'not-found'});
  await owner.call('deleteAccount');
 }finally{for(const app of apps){await terminate(getFirestore(app));await deleteApp(app);}}
});
