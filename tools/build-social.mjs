import {build} from 'esbuild';
import {mkdir,cp} from 'node:fs/promises';
await build({entryPoints:['android/social-client.mjs'],outfile:'android/app/src/main/assets/social.mjs',bundle:true,format:'esm',target:'chrome80',minify:true,legalComments:'eof'});
await mkdir('public/social',{recursive:true});
await cp('android/app/src/main/assets','public/social',{recursive:true});
await import('./build-pwa.mjs');
console.log('Sociale client gebundeld; zelfstandige webuitnodigingen bijgewerkt.');
