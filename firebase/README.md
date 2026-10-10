# Accounts en vriendengroepen

Fieldday 1.1.0 gebruikt Firebase Authentication (e-mail/wachtwoord) en Cloud Firestore op **Spark, zonder gekoppelde facturering**. Geen Cloud Functions, Admin SDK, eigen server of draaiende pc is nodig. GitHub blijft de openbare evenementen importeren. De webversie staat onder `/social/`; Android bundelt dezelfde interface.

## Kosten en grenzen

Project: `fieldday-airsoft-irandomplays`, Firestore-regio `europe-west4`. Het project is zonder betaalmiddel ingericht. Spark heeft harde gratis quota; bij overschrijding kunnen functies tijdelijk niet beschikbaar zijn. Firebase verzorgt quota voor onder andere databaseopslag, reads/writes en verificatie-/herstelde-mails. Geen automatische upgrade of betaalde dienst toegevoegd. Zie de [officiële Spark-uitleg](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans) en [Firestore-quota](https://firebase.google.com/docs/firestore/quotas).

## Beveiliging en opslag

- `users/{uid}`: privéprofiel, uitsluitend eigen account. Wachtwoorden blijven bij Authentication.
- `privateNabv/{uid}`: één bron voor het optionele NABV-nummer, los van publieke documenten.
- `eventGroups/{token}`: eigenaar, verwijzing naar het bestaande evenement, status en aantallen. Geen kopie van evenementgegevens.
- `publicInvites/{token}`: alleen evenementverwijzing, groepsorganisatornaam, status en aantallen. Alleen ophalen met de volledige willekeurige 256-bit token; lijsten opvragen is verboden.
- `eventGroups/{token}/participants/{uid}`: eigen reactie, afzonderlijke officiële aanmeldstatus en twee expliciete toestemmingen. Alleen de deelnemer zelf en de groepsorganisator kunnen de deelnemer ophalen; alleen de groepsorganisator kan de lijst lezen of officiële aanmeldstatus wijzigen.
- `users/{uid}/groups/{token}`: privéoverzicht van eigen groepen en reacties, via realtime listeners.
- `nabvGrants/{uid}/organizers/{organizerUid}`: een verwijzing naar een groep, **geen nummerkopie**. Voor iedere NABV-read controleren Security Rules opnieuw eigenaarschap, actieve groep en actuele toestemming van de deelnemer. Een oude verwijzing geeft na intrekken geen toegang meer.
- `deletingUsers/{uid}`: minimale verwijdermarker met tijdstip, zonder naam, e-mail of NABV. Blokkeert oude sessies tijdens opruimen; blijft bestaan om oude tokens te weigeren.

Autorisatie wordt afgedwongen door `firestore.rules`; interfacecontroles zijn aanvullend. De client bevat uitsluitend de openbare Firebase-webconfiguratie, geen beheersleutel. Iedereen kan de app bekijken, maar accounts moeten hun e-mail verifiëren voordat zij groepen maken of reageren.

NABV-inzage en doorgifte aan het airsoftveld zijn afzonderlijke keuzes. Export bevat alleen actuele ja-reacties; nummers alleen bij beide toestemmingen. Voor kopiëren/delen verschijnt een gegevenspreview en volgt opnieuw een servercontrole. Een eenmaal door de organisator gekopieerde/verstuurde lijst kan technisch niet worden teruggehaald. De app boekt geen tickets bij velden.

Privénummers worden niet in lokale persistente databaseopslag gezet. Deelnemerslijsten worden verborgen bij verbindingsverlies en als de app naar de achtergrond gaat. De database gebruikt transacties voor reacties en aantallen. Acties worden pas bevestigd na serverbevestiging. Account verwijderen vraagt recente herauthenticatie en ruimt profiel, nummer, reacties en eigen groepen op vóór Authentication-verwijdering. Bij onderbroken opruiming kan de gebruiker het verwijderen opnieuw uitvoeren; Spark heeft hiervoor geen achtergrondworker.

## Uitnodigingslinks (vanaf 1.2.1)

Nieuwe gedeelde links gebruiken `https://fieldday-airsoft-irandomplays.web.app/invite/<token>`. Android App Links verifieert dit domein aan de hand van `firebase/hosting/.well-known/assetlinks.json`, het apppakket en de publieke SHA256-fingerprint van de huidige ondertekeningssleutel. Het Android-manifest heeft een autoVerify-filter uitsluitend voor HTTPS en /invite/. Behoud bij nieuwe APKs dezelfde sleutel; bij een toekomstige andere release-/Play-sleutel moet de associatie aangepast worden.

Met de actuele app geïnstalleerd en Android-linkverificatie ingeschakeld kan de link rechtstreeks naar de uitnodiging in Fieldday gaan. Zonder app opent de kleine statische Hosting-pagina en verwijst door naar de bestaande GitHub-webuitnodiging, met dezelfde token in het fragment. De webversie toont een installatieverzoek en APK-downloadknop, plus een expliciete knop om de app te openen als een ingebouwde browser de App Link tegenhoudt. De browser beweert niet te kunnen vaststellen welke apps geïnstalleerd zijn. De gebruiker kan ook via het web reageren. Na installatie opent hij dezelfde uitnodigingslink opnieuw. Er wordt geen deferred-install- of trackingdienst gebruikt.

Bestaande GitHub-links en fieldday://-links blijven bruikbaar. De bestaande APK 1.2.0 krijgt 1.2.1 via de verplichte updatecontrole; oudere APKs moeten handmatig bijgewerkt worden. De domeinverificatie vereist een eenmalige internetverbinding op het toestel. Android-instellingen en ingebouwde browsers kunnen automatisch openen tegenhouden; daarom blijft de handmatige openknop bestaan.

Firebase Hosting gebruikt het bestaande Spark-project, zonder betaalmiddel of Cloud Functions. Alleen de gateway, CSS/JS en domeinassociatie worden daar gehost. Evenementgegevens, webapp en APK blijven op GitHub. De uitnodigingstoken kan bij webfallback in Hosting-verzoeken voorkomen; er worden geen NABV- of profielgegevens in de URL opgenomen en de gateway verstuurt geen referrer. Publiceren: `npx firebase deploy --only hosting --project fieldday-airsoft-irandomplays`. Gratis Hosting-quota gelden; geen automatische betaalde uitbreiding.

## Bouwen en controleren

```powershell
npm ci
node --test
node tools/build-social.mjs
& .\tools\build-android.ps1
```

Integratietests gebruiken uitsluitend lokale demo-emulators, geen echte gebruikers of productiegegevens:

```powershell
npx firebase emulators:exec --project demo-fieldday --only auth,firestore "node --test tests/social-emulator.test.mjs"
```

Java 21+ is vereist voor de Firestore-emulator. `.github/workflows/social-checks.yml` voert de tests ook op GitHub uit. Voor handmatige browsertests: start de demo-emulators en `node tools/preview-android.mjs --firebase-emulators`. De emulatorconfig wordt uitsluitend door de lokale previewserver geleverd en staat niet in de APK/webpublicatie.

Live configuratie beheren met de bestaande Firebase CLI-login:

```powershell
node tools/configure-firebase.mjs enable
node tools/configure-firebase.mjs auth
node tools/configure-firebase.mjs config
npx firebase deploy --only firestore:rules --project fieldday-airsoft-irandomplays
node tools/build-social.mjs
```

Authentication moet eenmaal zijn gestart in de Firebase-console. Het configuratiescript weigert gekoppelde facturering. Wijzig regels alleen samen met de emulatorbeveiligingstests. De APK is ontwikkelondertekend; native delen, klembord en intent-openen moeten nog op een echt Android-toestel gecontroleerd worden.
