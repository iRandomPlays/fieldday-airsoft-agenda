import {getDocFromServer,getDocsFromServer,doc,collection,setDoc,deleteDoc,runTransaction} from 'firebase/firestore';
import {deleteUser} from 'firebase/auth';
import {createService} from '../shared/social-service.mjs';

// No privileged credentials or server required. Every request is checked by Firestore Rules.
export function firestoreService(db,auth,events){
  const ref=path=>doc(db,path);
  const store={
    get:async path=>(await getDocFromServer(ref(path))).data(),
    set:(path,value)=>setDoc(ref(path),value),del:path=>deleteDoc(ref(path)),
    query:async path=>(await getDocsFromServer(collection(db,path))).docs.map(d=>({id:d.id,...d.data()})),
    transaction:fn=>runTransaction(db,tx=>fn({get:async path=>(await tx.get(ref(path))).data(),set:(path,value)=>tx.set(ref(path),value),del:path=>tx.delete(ref(path))})),
    async readNabv(uid,groupId){
      // This pointer carries no NABV number. Rules validate the group AND current participant consent.
      await setDoc(ref(`nabvGrants/${uid}/organizers/${auth.currentUser.uid}`),{groupId});
      return (await getDocFromServer(ref(`privateNabv/${uid}`))).data();
    },
    async deleteTree(path){
      const sub=path.startsWith('eventGroups/')?'participants':'groups';
      const rows=await getDocsFromServer(collection(db,path,sub));
      for(const row of rows.docs){if(path.startsWith('eventGroups/'))await deleteDoc(ref(`nabvGrants/${row.id}/organizers/${auth.currentUser.uid}`));await deleteDoc(row.ref);}
      if(path.startsWith('users/')){
        // Remove capability pointers as well as the single source of the NABV number.
        const grants=await getDocsFromServer(collection(db,'nabvGrants',path.slice(6),'organizers'));
        for(const row of grants.docs)await deleteDoc(row.ref);
      }
      await deleteDoc(ref(path));
    }
  };
  const service=createService(store,{events,deleteAuth:()=>deleteUser(auth.currentUser)});
  return async (name,input={})=>{
    const user=auth.currentUser;
    const actor=user?{uid:user.uid,email:user.email,...(await user.getIdTokenResult()).claims}:null;
    return service[name](actor,input);
  };
}
