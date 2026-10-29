# Verwerkingsregistratie Organisatiezoeker

**Verwerkingsverantwoordelijke**: Jona zinvolle communicatie (Ruben Hadders).

**Doel**: zakelijke prospectie en relatiebeheer richting organisaties (kerken,
goede doelen): het vinden van het juiste functionele of persoonlijke werkadres
voor communicatie over diensten op het gebied van communicatie, marketing en AI.

**Grondslag**: gerechtvaardigd belang (art. 6 lid 1 sub f AVG), B2B-benadering
van functionarissen in hun zakelijke rol.

**Categorieën gegevens**: naam van de organisatie, plaats, website, RSIN/KVK,
functioneel e-mailadres; van contactpersonen: naam, functie, zakelijk
e-mailadres zoals de organisatie dat zelf openbaar heeft gepubliceerd, plus de
bron-URL en de datum waarop dat is gezien.

**Bronnen**: uitsluitend openbaar gepubliceerde pagina's van de organisaties
zelf en van hun koepels (gemeentelijsten, ANBI-pagina's, contactpagina's). Geen
e-mailadressen worden afgeleid of geraden. LinkedIn wordt niet gescraped.

**Bewaartermijn**: contactgegevens worden bij elke verrijking opnieuw
gecontroleerd; een contact dat niet meer op de bron staat wordt als niet-actueel
gemarkeerd. Exports blijven bewaard om herhaalde benadering te voorkomen.

**Rechten van betrokkenen**: de knop "Vergeet deze organisatie" verwijdert alle
contacten en zet de organisatie op een blokkadelijst die ook toekomstige
verrijking tegenhoudt. Elke export bevat een afmeldkolom. Verzoeken via
info@jonacommunicatie.nl.

**Beveiliging**: toegang alleen met wachtwoord plus authenticator-app (TOTP),
sessies van 1 uur met verversing, database en auth alleen bereikbaar binnen het
Dokploy-netwerk, dagelijkse back-up, auditlog van inlogpogingen en exports.

**Verwerkers**: Hostinger (VPS, Nederland/EU), Anthropic (tekstextractie: alleen
de platte tekst van openbare pagina's wordt verstuurd, geen eigen database).
