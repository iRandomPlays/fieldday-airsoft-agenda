# Fieldday op Google Play

Deze bouw staat los van de APK op GitHub Pages. Pakketnaam: `nl.fieldday.app`. Eerste Play-bundel: versie 1.2.10, versiecode 17. Verhoog bij elke volgende Play-upload de versiecode in `android/play/build.gradle`.

## Bouwen

Vereist: Gradle 9.3.1, Android SDK 36 en JDK (Android Studio jbr). Vanuit de projectmap:

```powershell
& ./tools/build-play.ps1
```

Bij een lokaal antiviruscertificaat kan `-TrustStore` naar een vertrouwd, lokaal Java-certificaatarchief wijzen. Certificaatcontrole wordt niet uitgeschakeld. De uploadsleutel staat in `data/fieldday-play-upload.keystore`, de configuratie in `data/play-signing.properties`. Beide zijn uitgesloten van Git. Bewaar beide veilig als back-up; stuur wachtwoorden niet via chat. De bouw weigert een bestaande sleutel zonder configuratie te overschrijven.

Resultaat: `outputs/Fieldday-Play.aab`. De bestaande `tools/build-android.ps1` en gepubliceerde GitHub-APK blijven hun eigen ontwikkelsleutel en updater gebruiken.

## Play-updates

De release gebruikt Googles App Update Library 2.1.0. De native gate controleert bij opstarten en terugkeer naar de app of Google Play een update aanbiedt aan het betreffende account/apparaat. Een beschikbare update blokkeert verdere bediening en wordt gestart met de knop Controleren en bijwerken (IMMEDIATE). Een geannuleerde update heft de blokkade niet op. Bij een mislukte eerste controle blijft opnieuw proberen mogelijk; een latere tijdelijke fout maakt een reeds gecontroleerde sessie niet onbruikbaar. Google Play bepaalt beschikbaarheid, testtrack en uitrol. Er wordt geen GitHub-APK opgehaald of geïnstalleerd. De Play-bundel bevat geen REQUEST_INSTALL_PACKAGES of UpdateApkProvider.

Test dit via een door Google Play geïnstalleerde interne testversie; een losse lokaal geïnstalleerde APK geeft niet dezelfde update- en eigendomsresultaten. Test op een echt toestel nog: opstarten, annuleren/hervatten van een Play-update, offline gedrag en uitnodigingslinks.

## Upload en volgende stappen

1. Play Console: Fieldday > Testen en releasen > Testen > Intern testen > Nieuwe release maken.
2. Configureer Play App Signing en upload de ondertekende AAB.
3. Haal vervolgens de **SHA-256 van het app-ondertekeningscertificaat** uit App-integriteit. Dit is niet de SHA-256 van het uploadcertificaat. Voeg die naast de bestaande fingerprint toe aan `firebase/hosting/.well-known/assetlinks.json` en deploy Hosting om uitnodigingslinks ook voor de Play-versie te verifiëren.
4. Vul winkelgegevens, privacybeleid, Gegevensveiligheid, accountverwijderings-URL en app-toegang voor reviewers in voordat je beoordeling/publicatie aanvraagt.

De Play-handtekening verschilt van de bestaande ontwikkelondertekende GitHub-APK. Die APK kan daarom niet rechtstreeks door de Play-versie met dezelfde pakketnaam worden vervangen. Bij de overstap kan verwijderen en opnieuw installeren nodig zijn. Firebase-account en servergegevens blijven beschikbaar na opnieuw inloggen; lokale favorieten en voorkeuren kunnen daarbij verloren gaan. Verwijder je Firebase-account hiervoor niet.

Deze bundel is bedoeld voor een eerste upload naar Intern testen, niet als verklaring dat alle winkel- en beleidsvereisten al zijn afgerond.
