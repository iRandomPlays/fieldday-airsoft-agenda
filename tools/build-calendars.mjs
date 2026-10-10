import {readFile,mkdir,writeFile,readdir,unlink} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {calendarEvent,calendarIcs} from '../android/app/src/main/assets/event-extras.mjs';
export async function buildCalendars(events,output='public/calendar',now=new Date()){
 await mkdir(output,{recursive:true});const keep=new Set();let count=0;
 for(const event of events){if(event.cancelled||event.missing||!/^[a-zA-Z0-9_-]{1,80}$/.test(event.id))continue;let entry;try{entry=calendarEvent(event);}catch{continue;}
  const name=event.id+'.ics';keep.add(name);await writeFile(output+'/'+name,calendarIcs(entry,now));count++;
 }
 for(const name of await readdir(output))if(/^[a-zA-Z0-9_-]{1,80}\.ics$/.test(name)&&!keep.has(name))await unlink(output+'/'+name);
 return count;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const data=JSON.parse(await readFile('public/data/events.json','utf8'));console.log(await buildCalendars(data.events)+' openbare agendabestanden gepubliceerd.');}
