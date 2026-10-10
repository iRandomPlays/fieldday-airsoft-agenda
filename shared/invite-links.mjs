export const INVITE_ORIGIN='https://fieldday-airsoft-irandomplays.web.app';
export const WEB_APP='https://irandomplays.github.io/fieldday-airsoft-agenda/social/';
export const APK_URL='https://irandomplays.github.io/fieldday-airsoft-agenda/downloads/Fieldday.apk';
export function invitationLinks(id,webUrl=WEB_APP){
 if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))throw Error('Ongeldige uitnodigingscode.');
 const app=INVITE_ORIGIN+'/invite/'+id;
 const web=webUrl+'#invite='+id;
 const intent='intent://invite/'+id+'#Intent;scheme=fieldday;package=nl.fieldday.app;S.browser_fallback_url='+encodeURIComponent(web)+';end';
 return {app,web,intent,download:APK_URL};
}
