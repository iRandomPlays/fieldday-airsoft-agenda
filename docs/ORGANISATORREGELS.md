# Regels per organisator

Nederlandse velden zonder volledig gevonden eigen reglement krijgen daarnaast een duidelijk gelabelde **Algemene NABV-reglementen**-sectie uit `fallbacks.NL` in hetzelfde GitHub-bestand. Deze verwijst naar het vanaf de officiële publicatiepagina gelinkte veiligheidsreglement (1 november 2025), huishoudelijk reglement (1 november 2024) en het actuele publicatieoverzicht. De checker volgt ook deze bronnen. De selectie gebruikt het land van het evenement/de locatie, nooit de nationaliteit of domeinnaam van de organisator. Belgische en onbekende landen krijgen geen NABV-terugval. Gevonden eigen veldregels blijven zichtbaar; een volledig gevonden reglement wordt niet vervangen. De terugval is geen verklaring dat het veld door NABV erkend is. Alleen de nieuwe NABV-fingerprints vastleggen na inhoudelijke review kan met `--record-nabv-fingerprints`; dat keurt geen gewijzigde organisatorbronnen goed.

De 13 organisator-ID’s komen rechtstreeks uit de bestaande app-agenda. `data/organizer-rules.json` in de GitHub-repository bevat korte Nederlandstalige samenvattingen, officiële bronlinks, de datum van inhoudelijke controle en eventueel een specifiek terreinprofiel. Geen volledige reglementen overgenomen. De website toont dit bij ieder bron-evenement in het tabblad **Regels**.

Publieke gegevensbron: https://irandomplays.github.io/fieldday-airsoft-agenda/data/organizer-rules.json

WordPress-cache/API: `/wp-json/fieldday/v1/organizer-rules`. Het thema toont regels via de exacte `sourceId` van het evenement; de organisatienaam wordt niet gegokt. De app hoeft niet te worden aangepast om dit bestand te publiceren. Een toekomstige app-weergave kan dezelfde JSON lezen.

## Inhoud en afbakening

Officiële spelregels gevonden voor 3Division, Crimi Events, Rush Battle Arena, Airsoften.be, Antwerp Airsoft/BAA, Airborne Events, Unit 13, Balls and Arrows, Gladiator Sports, Copperhead Tactical en Delta Airsoft Events. Copperhead gebruikt de momenteel vanaf de homepage gelinkte PDF versie 5.4 (2026), geen oude versie 4 uit de zoekresultaten. Antwerp Airsoft verwijst naar BAA; de huidige JavaScript-pagina is inhoudelijk in de browser bekeken.

Area077 is gedeeltelijk: de gelinkte deelnamereglementpagina meldt zelf dat deze niet beschikbaar is. Alleen oogbescherming en verplichte briefing van de officiële informatiepagina zijn samengevat. Geen joule-/BB-waarden verzonnen.

Airsoft Vets is gedeeltelijk: concrete speciale brand-/rookregels voor The Maze 2 zijn gevonden. Die verschijnen alleen bij de bronpagina `/poster-2` of een duidelijke Maze 2-titel. Ze gelden niet automatisch voor Wolfenstein of Trancentral. De rest wordt naar de officiële terreinpagina’s en organisator verwezen. Een vermelding ‘FPS standaard’ is niet naar numerieke limieten vertaald.

Crimi Events heeft terreinregels; algemene veiligheids-/deelnamepunten worden getoond, de locatiekeuze in de officiële bron blijft nodig voor limieten. Rush heeft op zijn officiële pagina’s verschillende beschrijvingen van formats; het blok benoemt dat expliciet en noemt reguliere CQB-waarden uitsluitend met de evenementuitzondering.

## Automatische controle versus inhoudelijke review

GitHub Actions voert bij de bestaande import `node tools/build-organizer-rules.mjs` uit. De checker haalt uitsluitend officiële HTTPS-bronnen op, beperkt redirects en bestandsgrootte, controleert HTTP-200-foutpagina’s en PDF-signatures en vergelijkt een SHA-256-fingerprint met de eerder inhoudelijk beoordeelde bron. HTML gebruikt genormaliseerde tekst zonder script/opmaak/navigatie. Voor de JavaScript-pagina van BAA wordt de versie van de hoofd-applicatiebundel gevolgd; een nieuwe bundel kan ook bij een andere appwijziging herbeoordeling vragen.

`reviewedAt` is een echte inhoudelijke controledatum. `checkedAt` is alleen de bereikbaarheids-/wijzigingscontrole en wordt nooit als nieuwe inhoudelijke review gepresenteerd. De checker schrijft geen automatisch gegokte nieuwe regels. `checkStatus` is `ok`, `changed`, `unreachable` of `unreviewed`. Bij wijzigingen of uitval blijven bronnen en de eerdere review bewaard. WordPress verbergt dan de samenvatting en biedt de officiële links aan. Een review ouder dan 90 dagen of broncontrole ouder dan 14 dagen wordt eveneens niet als actueel weergegeven. De officiële briefing/evenementregels zijn leidend.

Na een daadwerkelijke inhoudelijke review: pas de betrokken samenvatting en `reviewedAt` aan. Alleen nadat de bronnen opnieuw gelezen zijn kan lokaal `node --use-system-ca tools/build-organizer-rules.mjs --record-reviewed-fingerprints` worden uitgevoerd. Deze onderhoudsoptie mag niet automatisch in de workflow staan: hij zou anders gewijzigde bronnen zonder review accepteren.

WordPress haalt het openbare bestand maximaal eenmaal per uur op; bij fouten na vijf minuten opnieuw. Een gevalideerde cache blijft bij uitval bewaard met foutmelding en controledatums. Het installatiepakket bevat ook een gelabelde beginsnapshot. Een websitebezoek haalt geen code van externe organisatoren op en voert geen remote JavaScript uit. Beheerders hoeven geen GitHub-token in WordPress te plaatsen.

## Testen

Agenda-repository: `node --test tests/organizer-rules.test.mjs`; normale `node --test` blijft van toepassing. WordPress: `.runtime/php/php.exe -c .runtime/php/php.ini tools/test-organizer-rules.php`. De integratietests controleren validatie, bron-ID-koppeling, terreinselectie, bronwijzigingen, oude datums, onveilige links, netwerkuitval en behoud van de laatste geldige cache.
