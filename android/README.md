# Fieldday voor Android

Installeerbare testversie voor Android 8.0 en hoger:

[Download Fieldday.apk](https://irandomplays.github.io/fieldday-airsoft-agenda/downloads/Fieldday.apk)

Open de download op je Android-telefoon. Als Android daarom vraagt, sta installatie vanuit je browser toe. Evenementen bekijken vereist geen account. Vriendengroepen vereisen een account. Een eigen server of draaiende pc is niet nodig.

Versie 1.0.1 voegt Helenaveen toe aan de kaart en het Nederland-filter. Rush Battle Arena wordt via GitHub automatisch geïmporteerd; de vorige APK toont de nieuwe evenementen ook in de agenda na verversen.

Versie 1.0.2 voegt Fort Barchon, Antwerpen, Peer en Blackwood toe aan de kaart. Airsoften.be, Antwerp Airsoft en Airborne Events worden via GitHub geïmporteerd. Regiofilters gebruiken waar beschikbaar het land uit de evenementgegevens.

Versie 1.0.3 voegt Nuth toe aan de kaart. Unit 13 publiceert beschikbare datums via zijn openbare Briq-widget; de app toont één agenda-item per beschikbaar gepubliceerde datum. Starttijden worden bij Unit 13 gekozen en niet geschat.

Versie 1.1.0 voegt registratie, e-mailverificatie, privéprofielen met optioneel NABV-nummer en vriendengroepen toe. Deelnemers kunnen reageren; de groepsorganisator beheert de afzonderlijke officiële aanmeldstatus. NABV-inzage en doorgifte vragen afzonderlijke toestemming. [Techniek en beveiliging](../firebase/README.md).

## Functies

- Agenda met zoeken, datum- en organisatorfilters, weekendfilter en beschikbaarheid.
- Kaart en lijst, met plaatsen bij benadering. Controleer het speeladres bij de organisator.
- Favoriete evenementen en organisatoren, opgeslagen op het toestel.
- Profiel met regio, licht/donker, verversen en informatie over gegevensgebruik.
- Actuele agenda van de bestaande GitHub Pages JSON-feed. Bij openen en na een uur bij terugkeren ververst de app; de knop Vernieuwen haalt direct de laatst gepubliceerde agenda op.
- Laatst opgehaalde agenda blijft beschikbaar zonder internet. Voor de eerste start is ook een momentopname meegeleverd. Afbeeldingen en kaarttegels kunnen internet nodig hebben.

GitHub Actions blijft de organisatoren verzamelen; de APK importeert geen organisatiewebsites. Veranderingen in evenementen vereisen geen nieuwe APK. Nieuwe appfuncties wel.

## Techniek en bouwen

De vier schermen zijn gebundelde HTML/CSS/JavaScript in een Android WebView met een Java Activity. De app laadt de interface uit de APK en gegevens via HTTPS. Er staat geen GitHub-token in de app. Alleen netwerkpermissies; geen GPS of camera. Accounts gebruiken Firebase Authentication. Externe evenementlinks openen de browser. De kaart gebruikt Leaflet en OpenStreetMap, zonder downloads van hele gebieden.

Broncode: `app/src/main`. De HTTPS-assets worden via `shouldInterceptRequest` uit Android AssetManager geserveerd. Bestandstoegang is uitgeschakeld; CSP beperkt scripts tot meegeleverde bestanden.

Vereisten voor bouwen op Windows: Android SDK platform 36, build-tools 36.0.0, JDK (getest met Android Studio jbr), PowerShell en Node voor de tests. Geen Gradle nodig.

Vanuit de projectmap:

```powershell
node --test
& .\tools\build-android.ps1
```

Zo nodig geef `-Sdk` en `-Jdk` mee. Resultaat: `outputs/Fieldday.apk`. De bouw maakt een lokale ontwikkelsleutel in `data/android-debug.keystore`. Bewaar deze sleutel om volgende testversies als update te installeren. De sleutel wordt niet gepubliceerd. Dit is een ontwikkelondertekende testversie, niet een Play Store-uitgave; voor productie zijn een release-sleutel en publicatieproces nodig.

`tools/download-android-assets.mjs` haalt de vastgezette Leaflet 1.9.4-versie, het lettertype en een actuele agenda-momentopname op. De assets zijn meegeleverd, dus downloaden is geen verplichte bouwstap.

Een publicatie vervangt `public/downloads/Fieldday.apk` door de gebouwde APK en pusht die naar main; de bestaande Pages-workflow publiceert de download. Gebruikersgegevens blijven lokaal bij een update met dezelfde sleutel en app-id.

## Controle van deze versie

54 geautomatiseerde tests geslaagd, plus twee integratietests met Firebase Auth en Firestore-emulators, inclusief importdatums, meerdaagse events, filters en favorieten. De vier tabbladen, kaartzoekfunctie, evenementdetails en blijvende favorieten zijn gecontroleerd in een mobiele browserpreview. De APK is gebouwd en de v2/v3-handtekening geverifieerd. Starten op een echte telefoon of werkende Android-emulator is nog niet getest: de aanwezige emulator heeft geen geïnstalleerd systeemimage.

## Assets en licenties

- Leaflet 1.9.4: BSD-2-Clause, zie `app/src/main/assets/leaflet-LICENSE.txt`.
- Barlow Condensed Black: SIL Open Font License, zie `app/src/main/assets/font-OFL.txt`.
- Het algemene bos/airsoft-sfeerbeeld `field-cover.png` is gegenereerd met OpenAI ImageGen voor deze app. Het beeld stelt geen specifieke locatie voor. Evenementposters komen uit de openbare brongegevens van de organisatoren.
- OpenStreetMap-kaarttegels en attributie: https://www.openstreetmap.org/copyright . Kaartposities zijn benaderingen van plaatsen, geen gecontroleerde ingangen of exacte speelvelden.

## Verplichte updates vanaf 1.2.0

Bij starten en terugkeer naar de app controleert een native scherm `public/app-update.json` via HTTPS op GitHub Pages. Elke hogere versiecode is verplicht. De interface blijft geblokkeerd tijdens controle, bij netwerkfouten en zolang een bekende update niet is geïnstalleerd. Er is geen oversla-knop. Dit betekent dat ook de eerder offline beschikbare agenda pas na een succesvolle onlinecontrole geopend kan worden. Accounts en voorkeuren blijven behouden bij installeren met dezelfde app-id en ondertekeningssleutel.

Vanaf 1.2.2 downloadt de updateknop de APK binnen Fieldday, toont voortgang en controleert SHA256, pakketnaam, versie en het ondertekeningscertificaat. Daarna opent de app rechtstreeks het Android-installatiescherm. Android vraagt zo nodig eenmalig toestemming voor installaties vanuit Fieldday; na terugkeer gaat de app verder. De gebruiker bevestigt de installatie. Annuleren heft de updateplicht niet op. De app installeert niets stilzwijgend. Versies vóór 1.2.0 moeten eenmalig handmatig worden bijgewerkt; zij bevatten deze controle nog niet.

Voor elke release: verhoog `versionCode` en `versionName` in AndroidManifest.xml en de zichtbare versie in app.js, bundel de webassets, bouw met dezelfde sleutel, voer de tests uit en draai `node tools/publish-android-update.mjs`. Stel eventueel `ANDROID_HOME` in op de SDK-map. Dit script controleert APK-versie versus manifest en schrijft APK plus update-JSON met SHA256. Commit en publiceer **beide in dezelfde Pages-deployment**. Publiceer nooit alleen de versie-JSON vóór de APK. Er is geen Firebase-verbruik of betaalde dienst voor deze controle.

## Uitnodigingen openen (1.2.1)

Gedeelde HTTPS-links gebruiken nu het geverifieerde domein `fieldday-airsoft-irandomplays.web.app/invite/…`. Android opent de actuele Fieldday-app wanneer de domeinkoppeling actief is. Zonder app volgt de webuitnodiging met downloadverzoek. De knop “Ik heb de app” vangt browsers op die App Links niet doorgeven. De bestaande fieldday://-koppeling blijft bestaan. Hosting is op Spark zonder betaalmiddel ingericht. Zie [configuratie en beperkingen](../firebase/README.md#uitnodigingslinks-vanaf-121). Op een echte Android-telefoon nog controleren met `adb shell pm verify-app-links --re-verify nl.fieldday.app` en `adb shell pm get-app-links nl.fieldday.app`, daarna een gedeelde link in WhatsApp openen met en zonder de app.

## Downloaden binnen de app (1.2.2)

Geen browser of externe opslagpermissie nodig voor volgende updates. De download staat in de privémap van de app en wordt pas na volledige controle aan de Android-installer aangeboden. Een niet-openbare ContentProvider deelt uitsluitend de update-APK met tijdelijke leesrechten. Downloads boven 100 MB, lege/onvolledige bestanden en verkeerde hashes worden geweigerd; gedeeltelijke bestanden worden opgeruimd. Netwerk-/opslagfouten tonen opnieuw proberen en versiegegevens vernieuwen. Na annuleren is de gecontroleerde download opnieuw te installeren. Als Android de app tijdens het downloaden beëindigt, start de gebruiker de download opnieuw. Een ontvangen uitnodiging blijft bewaard tijdens de verplichte update en wordt na opnieuw openen hervat.

De upgrade naar 1.2.2 gaat nog via de browserknop van de oude APK; alleen een nieuw geïnstalleerde APK kan de nieuwe downloader uitvoeren. Het download-/controlepad is op JVM getest en de APK is gebouwd en ondertekend. De echte Android-toestemming, content-URI en installerflow zijn nog op een toestel te controleren. Er is momenteel geen Android-toestel of bruikbaar emulatorimage aangesloten.

## Developmentmenu (1.2.3)

De algemene bronwaarschuwing wordt niet meer boven de agenda weergegeven; fouten blijven in de importgegevens beschikbaar. Onder Profiel verschijnt Development alleen voor het ingelogde, geverifieerde Firebase-account vincentstijfs@live.nl. Openen, opnieuw ophalen en diagnostiek kopiëren controleren opnieuw het Firebase-ID-token (e-mail, verificatie en UID), ook bij een accountwissel. Het menu toont uitsluitend openbare importdiagnostiek en verleent geen extra database- of GitHub-rechten. De bestaande Firestore-beveiliging blijft gelden.

Het menu toont appversie, verbinding, ophaal-/publicatietijd, importstatus en fouten per organisator. Agenda opnieuw ophalen leest GitHub Pages; de import zelf blijft op GitHub draaien. Diagnostiek kopiëren bevat geen profiel, NABV-nummer, accounttoken of uitnodiging.

## Weer en persoonlijke agenda (1.2.4)

Op de evenementdetailpagina staat een weersverwachting voor de bestaande kaartcoördinaten van de locatie (bij benadering). Open-Meteo levert per speeldag temperatuur, regenkans, neerslag en maximale wind. De gratis non-commercial API vereist geen sleutel of betaalmiddel voor deze app zonder advertenties/abonnementen; bij commercieel gebruik moeten de voorwaarden opnieuw worden beoordeeld: https://open-meteo.com/en/terms . De kaart vermeldt bron en CC BY 4.0.

Maximaal 16 dagen vooruit; latere evenementen tonen de datum waarop de verwachting beschikbaar wordt. Meerdaagse evenementen tonen alleen beschikbare toekomstige speeldagen. Onbekende locaties krijgen geen verzonnen coördinaten. Verzoeken worden per locatie gedeeld en een uur in het geheugen bewaard; bij uitval wordt oudere beschikbare data expliciet gemarkeerd. De API ontvangt uitsluitend evenementcoördinaten en het IP-adres, geen GPS of accountgegevens.

Toevoegen aan agenda opent op Android ACTION_INSERT met titel, plaats/adres, bronlink en tijden, zonder READ_CALENDAR/WRITE_CALENDAR. De gebruiker kiest zijn agenda en bevestigt opslaan. Zonder agenda-app wordt Google Agenda in de browser geopend. De webversie biedt Google Agenda en RFC 5545 .ics-download. Ontbrekende begintijden worden als hele dag opgenomen, inclusief de laatste dag van meerdaagse evenementen. Onduidelijke eindtijden krijgen een duidelijk vermelde voorlopige duur. De tijdzone is Europe/Amsterdam of Europe/Brussels, met zomer-/wintertijd. Toevoegen is geen boeking en latere bronwijzigingen passen een al opgeslagen afspraak niet automatisch aan.

Tests controleren tijdzones, zomertijdsprong, nachtgames, exclusieve einddatums, ontbrekende tijden, ICS-escaping/UTF-8-regelvouw, forecast-horizon, per-datumselectie, caching en netwerkuitval. Native agenda-appkeuze en definitief opslaan nog op een telefoon controleren.
