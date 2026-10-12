export const FEEDBACK_CATEGORIES={bug:'Fout melden',idea:'Verbeteridee',other:'Overige feedback'};
export const FEEDBACK_STATUSES={new:'Nieuw',in_progress:'In behandeling',done:'Afgehandeld'};
export function feedbackInput(value){
 const subject=String(value.subject??'').trim(),message=String(value.message??'').trim(),category=value.category;
 if(!Object.hasOwn(FEEDBACK_CATEGORIES,category)||!subject||subject.length>100||!message||message.length>3000)throw {code:'invalid-argument',message:'Kies een categorie, vul een onderwerp in (maximaal 100 tekens) en een bericht (maximaal 3.000 tekens).'};
 return {category,subject,message,allowContact:value.allowContact===true};
}
