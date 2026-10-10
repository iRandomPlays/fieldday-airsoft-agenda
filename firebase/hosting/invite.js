const match=location.pathname.match(/^\/invite\/([a-f0-9]{64})$/);
if(match){
 const id=match[1],web='https://irandomplays.github.io/fieldday-airsoft-agenda/social/#invite='+id;
 const link=document.getElementById('web');link.href=web;link.hidden=false;
 const open=document.getElementById('open-app');open.href='intent://invite/'+id+'#Intent;scheme=fieldday;package=nl.fieldday.app;S.browser_fallback_url='+encodeURIComponent(web)+';end';open.hidden=false;
 // Verified Android links are handled by the OS before this page loads.
 // Browser arrival falls back to the complete web invitation (no install detection claims).
 location.replace(web);
}else document.getElementById('message').textContent='Deze uitnodigingslink is ongeldig. Vraag de organisator om een nieuwe link.';
