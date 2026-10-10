# Fieldday Airsoft Agenda

Zelfstandige mobiele webapp. GitHub Actions verzamelt de informatie, GitHub Pages serveert de app en een JSON-bestand. Geen draaiende pc of eigen server nodig. De openbare agenda gebruikt GitHub; optionele accounts en vriendengroepen gebruiken Firebase Authentication en Firestore op het gratis Spark-plan, zonder betaalmiddel.

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

Standaard GitHub Actions-runners voor een openbare repository hebben geen minutentarief. Opslag, Pages-limieten en voorwaarden blijven gelden. Geen betaalde API gebruikt. Negen organisatoren aangesloten. De calculator is een indicatie voor een priverepository met 2.000 Linux-minuten en niet de gemeten looptijd van tien websites.

## Aangesloten bronnen

GitHub importeert Airsoft Vets, 3Division (shop en jaaragenda), Area077 (beide opgegeven ticketlijsten, ontdubbeld op event-id), Crimi Events (openbare agenda-API) , Rush Battle Arena (alle evenementkaarten in de paginabron, inclusief latere maanden), Airsoften.be (jaarkalender), Antwerp Airsoft (alle pagina’s van de openbare agenda-API) en Airborne Events (gedateerde ticketproducten en entreevarianten). Meerdaagse evenementen hebben een einddatum. Crimi toont online vanafprijzen en de apart vermelde betaling ter plaatse. Een mislukte bron houdt zijn vorige gegevens; andere bronnen worden wel bijgewerkt. Geannuleerde Crimi-events staan niet in de actieve agenda.


Airsoften.be importeert iedere gepubliceerde kalenderdag afzonderlijk. Een vermelding van een terrein zonder datums levert geen verzonnen speeldagen op. Airborne gebruikt het expliciete bronjaar van de bijbehorende terreinagenda of evenementbeschrijving; accessoires en eten tellen niet als entreeticket. Antwerp bewaart de lokale tijden zoals de organisator ze publiceert, ook wanneer de API een afwijkende tijdzone noemt.

## Unit 13 in Nuth

De import leest de openbare Briq-bookingwidget op de officiële Unit 13-website. Alleen open airsoftgames worden opgenomen; privéarrangementen, jeugdactiviteiten, schietbaan en lasergamen worden uitgesloten. Het script vraagt maximaal twaalf maanden vooruit op, maar neemt uitsluitend daadwerkelijk beschikbare datums uit de respons over (de boekingshorizon kan korter zijn). Prijzen komen per datum uit de kalender. Er wordt niet op basis van terugkerende weekdagen gegokt.

Alleen de twee uitleesverzoeken OrderItems en Booking/Dates worden gedaan. Er wordt geen boeking aangemaakt of ticket vastgehouden. Een willekeurige openbare widgetsessie is voldoende; geen account of API-sleutel nodig. Starttijden zijn pas onderdeel van de verdere boeking en worden niet verzonnen. Een lege of mislukte bron houdt eerdere gegevens ter controle in stand.

## Accounts en vriendengroepen (1.1.0)

De Android-app en de [mobiele webversie](https://irandomplays.github.io/fieldday-airsoft-agenda/social/) ondersteunen accounts, privéprofielen en groepsuitnodigingen. De openbare agenda blijft zonder account beschikbaar. Zie [architectuur, privacy, installatie en tests](firebase/README.md).

## Verplichte Android-updates (1.2.0)

De Android-app controleert bij starten en terugkeren de nieuwste versie via GitHub Pages. Een nieuwere versie blokkeert de app tot installatie. Een internetverbinding is hiervoor verplicht; bij een mislukte controle blijft ook de lokale agenda achter het controlescherm. Vanaf 1.2.2 downloadt Fieldday de APK zelf en opent na controles het Android-installatiescherm. Android vraagt de gebruiker om toestemming en installatiebevestiging. Oudere APKs bevatten de controle niet en moeten eenmalig handmatig bijgewerkt worden. Zie [release-instructies](android/README.md#verplichte-updates-vanaf-120).

## Developmentmenu (1.2.3)

De algemene bronwaarschuwing wordt niet meer boven de agenda weergegeven; fouten blijven in de importgegevens beschikbaar. Onder Profiel verschijnt Development alleen voor het ingelogde, geverifieerde Firebase-account vincentstijfs@live.nl. Openen, opnieuw ophalen en diagnostiek kopiëren controleren opnieuw het Firebase-ID-token (e-mail, verificatie en UID), ook bij een accountwissel. Het menu toont uitsluitend openbare importdiagnostiek en verleent geen extra database- of GitHub-rechten. De bestaande Firestore-beveiliging blijft gelden.

Het menu toont appversie, verbinding, ophaal-/publicatietijd, importstatus en fouten per organisator. Agenda opnieuw ophalen leest GitHub Pages; de import zelf blijft op GitHub draaien. Diagnostiek kopiëren bevat geen profiel, NABV-nummer, accounttoken of uitnodiging.

## Weer en persoonlijke agenda (1.2.4)

Op de evenementdetailpagina staat een weersverwachting voor de bestaande kaartcoördinaten van de locatie (bij benadering). Open-Meteo levert per speeldag temperatuur, regenkans, neerslag en maximale wind. De gratis non-commercial API vereist geen sleutel of betaalmiddel voor deze app zonder advertenties/abonnementen; bij commercieel gebruik moeten de voorwaarden opnieuw worden beoordeeld: https://open-meteo.com/en/terms . De kaart vermeldt bron en CC BY 4.0.

Maximaal 16 dagen vooruit; latere evenementen tonen de datum waarop de verwachting beschikbaar wordt. Meerdaagse evenementen tonen alleen beschikbare toekomstige speeldagen. Onbekende locaties krijgen geen verzonnen coördinaten. Verzoeken worden per locatie gedeeld en een uur in het geheugen bewaard; bij uitval wordt oudere beschikbare data expliciet gemarkeerd. De API ontvangt uitsluitend evenementcoördinaten en het IP-adres, geen GPS of accountgegevens.

Toevoegen aan agenda opent op Android ACTION_INSERT met titel, plaats/adres, bronlink en tijden, zonder READ_CALENDAR/WRITE_CALENDAR. De gebruiker kiest zijn agenda en bevestigt opslaan. Zonder agenda-app wordt Google Agenda in de browser geopend. De webversie biedt Google Agenda en RFC 5545 .ics-download. Ontbrekende begintijden worden als hele dag opgenomen, inclusief de laatste dag van meerdaagse evenementen. Onduidelijke eindtijden krijgen een duidelijk vermelde voorlopige duur. De tijdzone is Europe/Amsterdam of Europe/Brussels, met zomer-/wintertijd. Toevoegen is geen boeking en latere bronwijzigingen passen een al opgeslagen afspraak niet automatisch aan.

Tests controleren tijdzones, zomertijdsprong, nachtgames, exclusieve einddatums, ontbrekende tijden, ICS-escaping/UTF-8-regelvouw, forecast-horizon, per-datumselectie, caching en netwerkuitval. Native agenda-appkeuze en definitief opslaan nog op een telefoon controleren.
