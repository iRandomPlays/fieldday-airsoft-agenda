export function platformInfo(nav=globalThis.navigator,media=globalThis.matchMedia){
 const ua=nav?.userAgent||'',native=/FielddayAndroid/.test(ua),ios=/iPhone|iPad|iPod/.test(ua)||/Macintosh/.test(ua)&&(nav?.maxTouchPoints||0)>1;
 const standalone=nav?.standalone===true||!!media?.('(display-mode: standalone)').matches;
 return {native,ios,android:!native&&/Android/.test(ua),standalone,label:native?'Android':ios?'iPhone / iPad':'Web'};
}
export const IOS_INSTALL_HELP='<p>Open deze pagina in <b>Safari</b> op je iPhone of iPad.</p><ol><li>Tik op <b>Deel</b> (het vierkant met de pijl omhoog). Staat dit onder Meer? Open dan eerst dat menu.</li><li>Kies <b>Zet op beginscherm</b>.</li><li>Schakel <b>Open als webapp</b> in als die optie verschijnt en tik op <b>Voeg toe</b>.</li></ol><p>Open Fieldday daarna via het icoon op je beginscherm. Vanuit WhatsApp kun je eerst het paginamenu gebruiken om de link in Safari te openen.</p>';
