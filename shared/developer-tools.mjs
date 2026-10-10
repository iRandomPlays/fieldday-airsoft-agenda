const DEVELOPER_EMAIL='vincentstijfs@live.nl';
export function isDeveloper(user){return !!user?.uid&&user.emailVerified===true&&typeof user.email==='string'&&user.email.toLowerCase()===DEVELOPER_EMAIL;}
export async function authorizeDeveloper(user,currentUser){
  if(!isDeveloper(user))throw {code:'permission-denied',message:'Dit menu is alleen beschikbaar voor het developeraccount.'};
  const token=await user.getIdTokenResult(true);
  if(currentUser()!==user||!isDeveloper(user)||token.claims?.sub!==user.uid||token.claims?.email_verified!==true||token.claims?.email?.toLowerCase()!==DEVELOPER_EMAIL)
    throw {code:'permission-denied',message:'Log in met het geverifieerde developeraccount.'};
}
// Public import diagnostics only: never include account, profile or invitation data.
export function developerDiagnostics(data,app){
  const run=data.runs?.[0];
  return {app:{version:app.version,platform:app.platform,online:app.online,lastFetchedAt:app.lastFetchedAt||null},
    agenda:{publishedAt:data.generatedAt||null,events:data.events?.length||0,organizers:data.sources?.length||0},
    import:run?{at:run.at,status:run.status,seconds:run.seconds,errors:run.errors||[],sources:(run.sources||[]).map(s=>({name:s.name,status:s.status,found:s.found,errors:s.errors||[]}))}:null};
}
