# Fieldday voor Android

Installeerbare testversie voor Android 8.0 en hoger:

[Download Fieldday.apk](https://irandomplays.github.io/fieldday-airsoft-agenda/downloads/Fieldday.apk)

Open de download op je Android-telefoon. Als Android daarom vraagt, sta installatie vanuit je browser toe. De app vereist geen account, eigen server of draaiende pc.

Versie 1.0.1 voegt Helenaveen toe aan de kaart en het Nederland-filter. Rush Battle Arena wordt via GitHub automatisch geïmporteerd; de vorige APK toont de nieuwe evenementen ook in de agenda na verversen.

Versie 1.0.2 voegt Fort Barchon, Antwerpen, Peer en Blackwood toe aan de kaart. Airsoften.be, Antwerp Airsoft en Airborne Events worden via GitHub geïmporteerd. Regiofilters gebruiken waar beschikbaar het land uit de evenementgegevens.

Versie 1.0.3 voegt Nuth toe aan de kaart. Unit 13 publiceert beschikbare datums via zijn openbare Briq-widget; de app toont één agenda-item per beschikbaar gepubliceerde datum. Starttijden worden bij Unit 13 gekozen en niet geschat.

## Functies

- Agenda met zoeken, datum- en organisatorfilters, weekendfilter en beschikbaarheid.
- Kaart en lijst, met plaatsen bij benadering. Controleer het speeladres bij de organisator.
- Favoriete evenementen en organisatoren, opgeslagen op het toestel.
- Profiel met regio, licht/donker, verversen en informatie over gegevensgebruik.
- Actuele agenda van de bestaande GitHub Pages JSON-feed. Bij openen en na een uur bij terugkeren ververst de app; de knop Vernieuwen haalt direct de laatst gepubliceerde agenda op.
- Laatst opgehaalde agenda blijft beschikbaar zonder internet. Voor de eerste start is ook een momentopname meegeleverd. Afbeeldingen en kaarttegels kunnen internet nodig hebben.

GitHub Actions blijft de organisatoren verzamelen; de APK importeert geen organisatiewebsites. Veranderingen in evenementen vereisen geen nieuwe APK. Nieuwe appfuncties wel.

## Techniek en bouwen

De vier schermen zijn gebundelde HTML/CSS/JavaScript in een Android WebView met een Java Activity. De app laadt de interface uit de APK en gegevens via HTTPS. Er staat geen GitHub-token in de app. Alleen netwerkpermissies; geen GPS, camera of gebruikersaccount. Externe evenementlinks openen de browser. De kaart gebruikt Leaflet en OpenStreetMap, zonder downloads van hele gebieden.

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

31 geautomatiseerde tests geslaagd, inclusief importdatums, meerdaagse events, filters en favorieten. De vier tabbladen, kaartzoekfunctie, evenementdetails en blijvende favorieten zijn gecontroleerd in een mobiele browserpreview. De APK is gebouwd en de v2/v3-handtekening geverifieerd. Starten op een echte telefoon of werkende Android-emulator is nog niet getest: de aanwezige emulator heeft geen geïnstalleerd systeemimage.

## Assets en licenties

- Leaflet 1.9.4: BSD-2-Clause, zie `app/src/main/assets/leaflet-LICENSE.txt`.
- Barlow Condensed Black: SIL Open Font License, zie `app/src/main/assets/font-OFL.txt`.
- Het algemene bos/airsoft-sfeerbeeld `field-cover.png` is gegenereerd met OpenAI ImageGen voor deze app. Het beeld stelt geen specifieke locatie voor. Evenementposters komen uit de openbare brongegevens van de organisatoren.
- OpenStreetMap-kaarttegels en attributie: https://www.openstreetmap.org/copyright . Kaartposities zijn benaderingen van plaatsen, geen gecontroleerde ingangen of exacte speelvelden.
