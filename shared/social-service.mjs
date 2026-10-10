// Shared application logic. Production authorization is additionally enforced by Firestore Rules.
export class Fault extends Error { constructor(code,message){super(message);this.code=code;} }
const fail=(code,message)=>{throw new Fault(code,message);};
const text=(v,max=100)=>typeof v==='string'?v.trim().slice(0,max):'';
const validId=id=>typeof id==='string' && /^[a-f0-9]{64}$/.test(id);
export function consent(response,share,forward,nabv){
  if(!['yes','no'].includes(response))fail('invalid-argument','Kies of je meegaat.');
  const shared=response==='yes' && share===true;
  if(shared&&!nabv)fail('failed-precondition','Voeg eerst je NABV-nummer toe of ga mee zonder dit te delen.');
  if(forward===true&&!shared)fail('invalid-argument','Doorgifte vereist toestemming voor delen met de organisator.');
  return {shareNabvWithOrganizer:shared,allowNabvForwarding:shared&&forward===true};
}
export function createService(db,{events,now=()=>new Date().toISOString(),deleteAuth=async()=>{}}={}){
  const userPath=uid=>`users/${uid}`, groupPath=id=>`eventGroups/${id}`;
  async function signed(actor){if(!actor?.uid)fail('unauthenticated','Log eerst in.');if(await db.get(`deletingUsers/${actor.uid}`))fail('permission-denied','Dit account wordt verwijderd.');return actor.uid;}
  const participant=(id,uid)=>`${groupPath(id)}/participants/${uid}`;
  async function group(id,actor,owner=false){
    if(!validId(id))fail('not-found','Deze uitnodiging bestaat niet.');
    const g=await db.get(groupPath(id));if(!g)fail('not-found','Deze uitnodiging is verwijderd.');
    if(owner&&g.organizerId!==actor?.uid)fail('permission-denied','Alleen de groepsorganisator kan dit doen.');
    return g;
  }
  async function activeGroup(id,actor,owner=false){const g=await group(id,actor,owner);if(g.status!=='active'||await db.get(`deletingUsers/${g.organizerId}`))fail('failed-precondition','Deze uitnodiging is ingetrokken.');return g;}
  async function profile(actor){const uid=await signed(actor);const p=await db.get(userPath(uid));const n=await db.get(`privateNabv/${uid}`);return {...p,email:actor.email||p?.email||'',nabvNumber:n?.number||''};}
  async function saveProfile(actor,input){
    const uid=await signed(actor), firstName=text(input.firstName,60),lastName=text(input.lastName,80),number=text(input.nabvNumber,30);
    if(!firstName||!lastName)fail('invalid-argument','Vul je voornaam en achternaam in.');
    if(number&&!/^[A-Za-z0-9 -]{2,30}$/.test(number))fail('invalid-argument','Controleer je NABV-nummer.');
    await db.transaction(async tx=>{
      const old=await tx.get(userPath(uid)),deleting=await tx.get(`deletingUsers/${uid}`);
      if(deleting)fail('permission-denied','Dit account wordt verwijderd.');
      tx.set(userPath(uid),{firstName,lastName,email:actor.email||'',createdAt:old?.createdAt||now(),updatedAt:now()});
      tx.set(`privateNabv/${uid}`,{number,updatedAt:now()});
    });
    // Signal existing group listeners after a profile edit without duplicating NABV numbers.
    const memberships=await db.query(`users/${uid}/groups`);
    for(const membership of memberships)await db.transaction(async tx=>{
      const path=groupPath(membership.id),g=await tx.get(path);
      if(!g||g.status!=='active')return;
      const p=await tx.get(participant(membership.id,uid)),currentProfile=await tx.get(userPath(uid)),currentNumber=await tx.get(`privateNabv/${uid}`),deleting=await tx.get(`deletingUsers/${uid}`);
      if(deleting||!currentProfile)return;
      const name=`${currentProfile.firstName} ${currentProfile.lastName}`;
      if(p)tx.set(participant(membership.id,uid),{...p,name,profileChangedAt:now(),...(!currentNumber?.number?{shareNabvWithOrganizer:false,allowNabvForwarding:false}: {})});
      if(g.organizerId===uid){const updated={...g,organizerName:name,revision:g.revision+1};tx.set(path,updated);tx.set(`publicInvites/${membership.id}`,publicGroup(updated));tx.set(`users/${uid}/groups/${membership.id}`,{...membership,...publicGroup(updated),role:'organizer'});}
    });return profile(actor);
  }
  async function createGroup(actor,{eventId,requestId}){
    const uid=await signed(actor);if(!actor.email_verified)fail('failed-precondition','Verifieer eerst je e-mailadres.');
    if(!validId(requestId))fail('invalid-argument','Ongeldige uitnodigingscode.');
    const p=await db.get(userPath(uid));if(!p)fail('failed-precondition','Vul eerst je profiel in.');
    const e=(await events()).find(e=>e.id===eventId&&e.status!=='missing'&&!e.cancelled);
    if(!e)fail('not-found','Dit evenement is niet meer beschikbaar.');
    if((e.endDate||e.date)<now().slice(0,10))fail('failed-precondition','Dit evenement is al afgelopen.');
    // Keep only the public event reference, not a second mutable event database.
    return db.transaction(async tx=>{
      const old=await tx.get(groupPath(requestId)),deleting=await tx.get(`deletingUsers/${uid}`);
      if(deleting)fail('permission-denied','Dit account wordt verwijderd.');
      if(old){if(old.organizerId!==uid)fail('already-exists','Probeer opnieuw.');return {groupId:requestId};}
      const count=await tx.get(`groupLimits/${uid}`);if((count?.count||0)>=100)fail('resource-exhausted','Maximaal 100 groepen per account.');
      const g={eventId,organizerId:uid,organizerName:`${p.firstName} ${p.lastName}`,status:'active',createdAt:now(),yesCount:0,registeredCount:0,revision:0};
      tx.set(groupPath(requestId),g);tx.set(`publicInvites/${requestId}`,publicGroup(g));
      tx.set(`${userPath(uid)}/groups/${requestId}`,{...publicGroup(g),role:'organizer'});
      tx.set(`groupLimits/${uid}`,{count:(count?.count||0)+1});return {groupId:requestId};
    });
  }
  function publicGroup(g){return {eventId:g.eventId,organizerName:g.organizerName,status:g.status,createdAt:g.createdAt,yesCount:g.yesCount,registeredCount:g.registeredCount,revision:g.revision};}
  async function respond(actor,{groupId,response,shareNabvWithOrganizer=false,allowNabvForwarding=false}){
    const uid=await signed(actor);if(!actor.email_verified)fail('failed-precondition','Verifieer eerst je e-mailadres.');
    await activeGroup(groupId,actor);
    return db.transaction(async tx=>{
      const g=await tx.get(groupPath(groupId)),old=await tx.get(participant(groupId,uid)),p=await tx.get(userPath(uid)),n=await tx.get(`privateNabv/${uid}`),deleting=await tx.get(`deletingUsers/${uid}`);
      if(deleting||!g||g.status!=='active')fail('failed-precondition','Deze uitnodiging is niet actief.');
      if(!p)fail('failed-precondition','Vul eerst je profiel in.');
      const permissions=consent(response,shareNabvWithOrganizer,allowNabvForwarding,n?.number);
      const changed=!!old&&old.response!==response;
      const next={userId:uid,name:`${p.firstName} ${p.lastName}`,response,registrationStatus:old?.registrationStatus||'pending',...permissions,respondedAt:now(),responseChanged:changed||old?.responseChanged||false,consentAt:now()};
      const yesCount=g.yesCount+(response==='yes'?1:0)-(old?.response==='yes'?1:0);
      // Registration survives response changes and requires an explicit organizer action.
      const registeredCount=g.registeredCount+(next.response==='yes'&&next.registrationStatus==='registered'?1:0)-(old?.response==='yes'&&old.registrationStatus==='registered'?1:0);
      const updated={...g,yesCount,registeredCount,revision:g.revision+1};
      tx.set(participant(groupId,uid),next);tx.set(groupPath(groupId),updated);tx.set(`publicInvites/${groupId}`,publicGroup(updated));
      tx.set(`${userPath(uid)}/groups/${groupId}`,{...publicGroup(updated),role:g.organizerId===uid?'organizer':'participant',response,registrationStatus:next.registrationStatus});
      if(g.organizerId!==uid)tx.set(`${userPath(g.organizerId)}/groups/${groupId}`,{...publicGroup(updated),role:'organizer',needsAttention:true});
      return next;
    });
  }
  async function setRegistration(actor,{groupId,userId,status}){
    await signed(actor);await activeGroup(groupId,actor,true);
    if(!['pending','registered','cancelled'].includes(status)||typeof userId!=='string'||userId.includes('/'))fail('invalid-argument','Ongeldige aanmeldstatus.');
    return db.transaction(async tx=>{
      const g=await tx.get(groupPath(groupId)),p=await tx.get(participant(groupId,userId)),index=await tx.get(`${userPath(userId)}/groups/${groupId}`);
      if(!g||g.organizerId!==actor.uid||g.status!=='active')fail('permission-denied','Geen toegang tot deze groep.');if(!p)fail('not-found','Deelnemer niet gevonden.');
      const updated={...g,registeredCount:g.registeredCount+(p.response==='yes'&&status==='registered'?1:0)-(p.response==='yes'&&p.registrationStatus==='registered'?1:0),revision:g.revision+1};
      tx.set(participant(groupId,userId),{...p,registrationStatus:status,responseChanged:false});tx.set(groupPath(groupId),updated);tx.set(`publicInvites/${groupId}`,publicGroup(updated));
      tx.set(`${userPath(userId)}/groups/${groupId}`,{...index,...publicGroup(updated),registrationStatus:status});
      tx.set(`${userPath(actor.uid)}/groups/${groupId}`,{...publicGroup(updated),role:'organizer'});return {ok:true};
    });
  }
  async function participants(actor,{groupId,forwarding=false}){
    await signed(actor);const g=await activeGroup(groupId,actor,true);
    const rows=await db.query(`${groupPath(groupId)}/participants`);
    const list=await Promise.all(rows.map(async ({id,...p})=>{
      const allowed=p.response==='yes'&&p.shareNabvWithOrganizer===true&&(!forwarding||p.allowNabvForwarding===true);
      const n=allowed?(db.readNabv?await db.readNabv(id,groupId):await db.get(`privateNabv/${id}`)):null;
      return {...p,userId:id,nabvNumber:n?.number||'',nabvForwardingAllowed:p.allowNabvForwarding===true};
    }));
    // Recheck consent and ownership after reading numbers; no stale grant is returned.
    const current=await activeGroup(groupId,actor,true);
    if(current.revision!==g.revision)fail('aborted','De groep is gewijzigd. Vernieuw het overzicht.');
    return {participants:forwarding?list.filter(p=>p.response==='yes'):list};
  }
  async function revokeGroup(actor,{groupId,remove=false}){
    await signed(actor);const g=await group(groupId,actor,true);
    // Invalidate authorization first; cleanup can be retried safely.
    await db.set(groupPath(groupId),{...g,status:'revoked',revision:g.revision+1});
    await db.set(`publicInvites/${groupId}`,{...publicGroup(g),status:'revoked',revision:g.revision+1});
    const people=await db.query(`${groupPath(groupId)}/participants`);
    for(const uid of new Set([g.organizerId,...people.map(p=>p.id)])){
      const path=`users/${uid}/groups/${groupId}`,idx=await db.get(path);
      if(remove)await db.del(path);else if(idx)await db.set(path,{...idx,...publicGroup({...g,status:'revoked',revision:g.revision+1})});
    }
    if(remove){await db.del(`publicInvites/${groupId}`);await db.deleteTree(groupPath(groupId));}return {ok:true};
  }
  async function deleteAccount(actor){
    if(!actor?.uid)fail('unauthenticated','Log eerst in.');
    if(!actor.auth_time||Date.now()/1000-actor.auth_time>300)fail('failed-precondition','Log opnieuw in voordat je je account verwijdert.');
    const uid=actor.uid;await db.set(`deletingUsers/${uid}`,{at:now()});
    await db.del(`privateNabv/${uid}`);
    const groups=await db.query(`users/${uid}/groups`);
    for(const idx of groups){
      const id=idx.id,g=await db.get(groupPath(id));if(!g)continue;
      if(g.organizerId===uid){
        // Internal cleanup shares the same revocation behavior without a disabled-user call.
        await db.set(groupPath(id),{...g,status:'revoked',organizerName:'Verwijderd account'});
        await db.del(`publicInvites/${id}`);
        const rows=await db.query(`${groupPath(id)}/participants`);
        for(const p of rows)await db.del(`users/${p.id}/groups/${id}`);
        await db.deleteTree(groupPath(id));
      }else await db.transaction(async tx=>{
        const latest=await tx.get(groupPath(id)),p=await tx.get(participant(id,uid));if(!latest||!p)return;
        const next={...latest,yesCount:latest.yesCount-(p.response==='yes'?1:0),registeredCount:latest.registeredCount-(p.response==='yes'&&p.registrationStatus==='registered'?1:0),revision:latest.revision+1};
        tx.del(participant(id,uid));tx.set(groupPath(id),next);tx.set(`publicInvites/${id}`,publicGroup(next));tx.set(`users/${latest.organizerId}/groups/${id}`,{...publicGroup(next),role:'organizer',needsAttention:true});
      });
    }
    await db.deleteTree(userPath(uid));await db.del(`groupLimits/${uid}`);await deleteAuth(uid);
    // Tombstone retained to reject already-issued auth tokens until expiry (no personal data).
    return {ok:true};
  }
  return {profile,saveProfile,createGroup,respond,setRegistration,participants,revokeGroup,deleteAccount};
}
