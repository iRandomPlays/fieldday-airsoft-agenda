import {doc,collection,query,where,orderBy,limit,startAfter,getDocFromServer,getDocsFromServer,getCountFromServer,runTransaction,serverTimestamp,updateDoc,deleteDoc} from 'firebase/firestore';
import {feedbackInput,FEEDBACK_STATUSES,FEEDBACK_CATEGORIES} from '../shared/feedback.mjs';
export function feedbackService(db,auth){
 const actor=()=>{const u=auth.currentUser;if(!u?.emailVerified)throw {code:'permission-denied',message:'Log in en verifieer je e-mailadres om feedback te versturen.'};return u;};
 return {
  async send(id,input,app){
   const user=actor(),value=feedbackInput(input);if(!/^[a-f0-9]{64}$/.test(id))throw Error('Ongeldige verzendcode.');
   if(!/^\d+\.\d+\.\d+$/.test(app.version)||!['Android','iPhone / iPad','Web'].includes(app.platform))throw Error('Onbekende appversie of platform.');
   const ref=doc(db,'feedback',id),guard=doc(db,'feedbackLimits',user.uid);
   await runTransaction(db,async tx=>{const existing=await tx.get(ref);if(existing.exists()){const old=existing.data();if(old.userId!==user.uid||Object.entries(value).some(([key,v])=>old[key]!==v))throw {code:'failed-precondition',message:'Deze verzendpoging is al ontvangen met andere inhoud. Open een nieuw feedbackformulier.'};return;}
    const previous=await tx.get(guard);if(previous.exists()&&Date.now()-previous.data().lastAt.toMillis()<60000)throw {code:'failed-precondition',message:'Wacht één minuut voordat je nog een melding verstuurt.'};
    tx.set(ref,{...value,userId:user.uid,contactEmail:value.allowContact?user.email:'',appVersion:app.version,platform:app.platform,status:'new',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});tx.set(guard,{lastAt:serverTimestamp(),feedbackId:id});
   });return id;
  },
  async list({status='',category='',cursor=null}={}){
   const filters=[];if(status){if(!Object.hasOwn(FEEDBACK_STATUSES,status))throw Error('Ongeldige status.');filters.push(where('status','==',status));}if(category){if(!Object.hasOwn(FEEDBACK_CATEGORIES,category))throw Error('Ongeldige categorie.');filters.push(where('category','==',category));}
   filters.push(orderBy('createdAt','desc'));if(cursor)filters.push(startAfter(cursor));filters.push(limit(21));
   const snapshot=await getDocsFromServer(query(collection(db,'feedback'),...filters));return {rows:snapshot.docs.slice(0,20).map(d=>({id:d.id,...d.data()})),cursor:snapshot.docs.length>20?snapshot.docs[19]:null};
  },
  async countNew(){return (await getCountFromServer(query(collection(db,'feedback'),where('status','==','new')))).data().count;},
  async detail(id){const result=await getDocFromServer(doc(db,'feedback',id));return result.exists()?{id:result.id,...result.data()}:null;},
  async status(id,status){if(!Object.hasOwn(FEEDBACK_STATUSES,status))throw Error('Ongeldige status.');await updateDoc(doc(db,'feedback',id),{status,updatedAt:serverTimestamp()});},
  remove:id=>deleteDoc(doc(db,'feedback',id))
 };
}
