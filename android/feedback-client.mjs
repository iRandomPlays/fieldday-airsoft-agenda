import {feedbackService} from './feedback-store.mjs';
import {feedbackInput,FEEDBACK_CATEGORIES,FEEDBACK_STATUSES} from '../shared/feedback.mjs';
import {authorizeDeveloper} from '../shared/developer-tools.mjs';
export function createFeedbackController({getUser,getAuth,getDb,getApp,esc,open,notice,requireAccount}){
 let draft={category:'bug',subject:'',message:'',allowContact:false},requestId=null,pendingFingerprint=null,epoch=0,rows=[],cursor=null,selected=null,filters={status:'',category:''};
 const service=()=>feedbackService(getDb(),getAuth());
 const options=(map,value,all=false)=>(all?'<option value="">Alle</option>':'')+Object.entries(map).map(([id,label])=>`<option value="${id}" ${value===id?'selected':''}>${label}</option>`).join('');
 const date=value=>value?.toDate?value.toDate().toLocaleString('nl-NL'):'Onbekend';
 function clearPrivate(){epoch++;rows=[];cursor=null;selected=null;}
 function clearDraft(){draft={category:'bug',subject:'',message:'',allowContact:false};requestId=null;pendingFingerprint=null;}
 function capture(values){draft={category:values.category||'bug',subject:values.subject||'',message:values.message||'',allowContact:values.contact==='on'||values.allowContact===true};}
 function form(){open(`<h2>Feedback geven</h2><p>Wat kunnen we verbeteren? Deel geen wachtwoord, NABV-nummer of andere gevoelige gegevens.</p><form id="social-feedback"><label>Categorie<select name="category">${options(FEEDBACK_CATEGORIES,draft.category)}</select></label><label>Onderwerp<input name="subject" required maxlength="100" value="${esc(draft.subject)}"></label><label>Bericht<textarea name="message" required maxlength="3000" rows="7">${esc(draft.message)}</textarea></label><label class="consent"><input type="checkbox" name="contact" ${draft.allowContact?'checked':''}>Je mag mij via mijn account-e-mailadres benaderen over deze feedback.</label><p class="foot">We bewaren je feedback, account-ID, appversie, platform en tijdstip. Je e-mailadres wordt alleen meegestuurd met jouw toestemming. Bij accountverwijdering wordt je feedback verwijderd.</p>${!getUser()?.emailVerified?'<p>Voor versturen moet je inloggen en je e-mailadres verifiëren. Je tekst blijft tijdens deze stappen bewaard.</p>':''}<p id="social-error" role="alert"></p><button class="primary full" type="submit">${getUser()?.emailVerified?'Feedback versturen':'Inloggen en verdergaan'}</button></form>`,'feedback-form');}
 async function send(values){capture(values);feedbackInput(draft);if(!getUser()?.emailVerified){await requireAccount(async()=>form());return;}
  const generation=epoch,fingerprint=JSON.stringify(feedbackInput(draft));if(pendingFingerprint!==fingerprint){requestId=null;pendingFingerprint=fingerprint;}if(!requestId)requestId=[...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,'0')).join('');
  await service().send(requestId,draft,getApp());if(generation!==epoch)return;clearDraft();open('<h2>Bedankt voor je feedback</h2><p>Je melding is ontvangen. De developer kan deze in het developmentmenu bekijken.</p><button class="primary full" data-social="close">Sluiten</button>','feedback-sent');
 }
 async function guarded(work){const generation=epoch,user=getUser();await authorizeDeveloper(user,()=>getAuth().currentUser);const result=await work();if(generation!==epoch||getUser()!==user)return null;return result;}
 async function list(next=false){
  const result=await guarded(async()=>{const [page,count]=await Promise.all([service().list({...filters,cursor:next?cursor:null}),service().countNew()]);return {page,count};});if(!result)return;
  rows=result.page.rows;cursor=result.page.cursor;selected=null;
  open(`<h2>Feedback</h2><p><strong>${result.count} nieuwe meldingen</strong></p><label>Status<select id="feedback-status">${options(FEEDBACK_STATUSES,filters.status,true)}</select></label><label>Categorie<select id="feedback-category">${options(FEEDBACK_CATEGORIES,filters.category,true)}</select></label><button class="primary full" data-social="feedback-filter">Filters toepassen / vernieuwen</button>${rows.map(row=>`<article class="social-group"><h3>${esc(row.subject)}</h3><p>${esc(FEEDBACK_CATEGORIES[row.category])} · ${esc(FEEDBACK_STATUSES[row.status])}<br>${esc(date(row.createdAt))}</p><button class="text-btn full" data-social="feedback-detail" data-id="${esc(row.id)}">Melding bekijken</button></article>`).join('')||'<p>Geen meldingen voor deze selectie.</p>'}${cursor?'<button class="primary full" data-social="feedback-next">Volgende 20</button>':''}${next?'<button class="text-btn full" data-social="feedback-admin">Terug naar eerste pagina</button>':''}<p id="social-error" role="alert"></p><button class="text-btn full" data-social="developer">Terug naar developmentmenu</button>`,'feedback-admin');
 }
 async function detail(id){const row=await guarded(()=>service().detail(id));if(!row){return;}selected=id;open(`<h2>${esc(row.subject)}</h2><p>${esc(FEEDBACK_CATEGORIES[row.category])} · ${esc(date(row.createdAt))}<br>Fieldday ${esc(row.appVersion)} · ${esc(row.platform)}</p><p class="feedback-message">${esc(row.message)}</p><p>${row.allowContact?'Contact toegestaan: <a href="mailto:'+esc(row.contactEmail)+'">'+esc(row.contactEmail)+'</a>':'Geen toestemming om contact op te nemen.'}</p><label>Status<select id="feedback-detail-status">${options(FEEDBACK_STATUSES,row.status)}</select></label><button class="primary full" data-social="feedback-save">Status opslaan</button><button class="text-btn full danger" data-social="feedback-delete">Melding verwijderen</button><p id="social-error" role="alert"></p><button class="text-btn full" data-social="feedback-admin">Terug naar feedback</button>`,'feedback-admin');}
 async function action(action,b){
  if(action==='feedback'){form();return;}
  if(action==='feedback-admin'){await list();return;}
  if(action==='feedback-filter'){filters={status:document.querySelector('#feedback-status').value,category:document.querySelector('#feedback-category').value};await list();return;}
  if(action==='feedback-next'){await list(true);return;}
  if(action==='feedback-detail'){await detail(b.dataset.id);return;}
  if(action==='feedback-save'){const id=selected;if(!id)return;const result=await guarded(async()=>{await service().status(id,document.querySelector('#feedback-detail-status').value);return true;});if(result){notice('Feedbackstatus opgeslagen.');await detail(id);}return;}
  if(action==='feedback-delete'){if(!selected)return;await guarded(async()=>true);open('<h2>Feedback verwijderen?</h2><p>Deze melding wordt definitief verwijderd.</p><button class="primary full danger" data-social="feedback-confirm-delete">Definitief verwijderen</button><button class="text-btn full" data-social="feedback-cancel-delete">Terug</button><p id="social-error" role="alert"></p>','feedback-admin');return;}
  if(action==='feedback-cancel-delete'){if(selected)await detail(selected);return;}
  if(action==='feedback-confirm-delete'){const id=selected;if(!id)return;const result=await guarded(async()=>{await service().remove(id);return true;});if(result){notice('Feedback verwijderd.');await list();}}
 }
 return {form,send,capture,action,clearPrivate,clearDraft};
}
