# Fieldday Airsoft Agenda

Zelfstandige mobiele webapp. GitHub Actions verzamelt de informatie, GitHub Pages serveert de app en een JSON-bestand. Geen draaiende pc, eigen server, Firebase, cloud-OCR-account of geheime sleutel nodig.

## Android-app

[Download de Android APK](https://irandomplays.github.io/fieldday-airsoft-agenda/downloads/Fieldday.apk) · [Functies en bouwinstructies](android/README.md). Android 8.0+, vier tabbladen en dezelfde GitHub-agenda. Ontwikkelondertekende testversie; nog niet op een Android-toestel getest.

## Online

https://irandomplays.github.io/fieldday-airsoft-agenda/

Workflow: .github/workflows/import.yml. Op iedere codewijziging, handmatig en ieder uur op minuut 17. Geplande taken kunnen vertragen. Openbare repositories kunnen geplande workflows na 60 dagen zonder repositoryactiviteit uitschakelen; de import bewaart gewijzigde gegevens als commit. Er is geen gegarandeerde beschikbaarheid of updatefrequentie.

## Gegevensstroom

Organisatiewebsite -> GitHub Actions -> OCR en controles -> data/state.json + data/ocr-cache.json -> public/data/events.json -> app.

De workflow bewaart de gegevens in de repository en publiceert de map public via GitHub Pages (Settings > Pages > Source: GitHub Actions). Alleen de workflow krijgt schrijfpermissie voor importgegevens; de browser bevat geen GitHub-token. Start een extra controle via Actions > Importeren en publiceren > Run workflow. De knop Vernieuwen haalt uitsluitend het laatste gepubliceerde bestand op.

## Datums

Eerst datum inclusief jaar uit afbeeldingsnaam. Anders Tesseract op meerdere uitsneden van de originele poster, met Sharp voor voorbewerking. Tegenstrijdige resultaten blijven in controle. Het jaartal voor OCR komt uit nabije gedateerde posters op dezelfde bronpagina, maximaal 120 dagen en alleen bij overeenstemming; nooit uit het huidige systeemjaar. De app toont de herkomst in het detailvenster. Deze uitsneden zijn afgestemd op Airsoft Vets; andere organisatoren vereisen een eigen koppeling.

De herkenning wordt op Wix-media-identiteit en algoritmeversie bewaard. Ongewijzigde afbeeldingen hoeven niet opnieuw door OCR. Bij een gewijzigde poster met een nieuwe identiteit volgt nieuwe herkenning. Prijzen en tijden zijn van de gedeelde locatiepagina. Verdwenen posters blijven gemarkeerd en worden niet automatisch geannuleerd. Bij bronfouten blijft de eerdere agenda beschikbaar, met importfout in de geschiedenis.

## App

Zoeken, locatie- en datumfilters, favorieten, details en importgeschiedenis. Favorieten en eventuele datumcorrecties blijven alleen op het eigen toestel. De app kan als webapp aan het startscherm worden toegevoegd waar de browser dit ondersteunt. De laatst opgehaalde agenda blijft lokaal beschikbaar bij verbindingsproblemen; afbeeldingen zijn mogelijk niet offline beschikbaar.

## Ontwikkelen (optioneel)

Node 22 of nieuwer aanbevolen:

    npm ci
    npm test
    node import.mjs
    npm start

Lokale server alleen voor ontwikkeling op http://127.0.0.1:8787. De online app gebruikt deze server niet.

## Kosten en scope

Standaard GitHub Actions-runners voor een openbare repository hebben geen minutentarief. Opslag, Pages-limieten en voorwaarden blijven gelden. Geen betaalde API gebruikt. Vier organisatoren aangesloten; nog zes nodig om tien organisaties echt te meten. De calculator is een indicatie voor een priverepository met 2.000 Linux-minuten en niet de gemeten looptijd van tien websites.

## Aangesloten bronnen

GitHub importeert Airsoft Vets, 3Division (shop en jaaragenda), Area077 (beide opgegeven ticketlijsten, ontdubbeld op event-id), Crimi Events (openbare agenda-API) , Rush Battle Arena (alle evenementkaarten in de paginabron, inclusief latere maanden), Airsoften.be (jaarkalender), Antwerp Airsoft (alle pagina’s van de openbare agenda-API) en Airborne Events (gedateerde ticketproducten en entreevarianten). Meerdaagse evenementen hebben een einddatum. Crimi toont online vanafprijzen en de apart vermelde betaling ter plaatse. Een mislukte bron houdt zijn vorige gegevens; andere bronnen worden wel bijgewerkt. Geannuleerde Crimi-events staan niet in de actieve agenda.


Airsoften.be importeert iedere gepubliceerde kalenderdag afzonderlijk. Een vermelding van een terrein zonder datums levert geen verzonnen speeldagen op. Airborne gebruikt het expliciete bronjaar van de bijbehorende terreinagenda of evenementbeschrijving; accessoires en eten tellen niet als entreeticket. Antwerp bewaart de lokale tijden zoals de organisator ze publiceert, ook wanneer de API een afwijkende tijdzone noemt.
