# Waldläufer im Google Play Store – Fahrplan

Stand: November 2026 · Zweig `playstore` · Version 2.1.0 (Testversion)

Dieser Fahrplan zeigt, was technisch schon vorbereitet ist (Teil A) und was du selbst erledigen
oder entscheiden musst (Teil B). Teil C ist die empfohlene Reihenfolge, Teil D ein Kostenüberblick.
Alle Euro-Beträge sind Richtwerte – bitte vor Entscheidungen beim jeweiligen Anbieter prüfen.
Rechtliche und steuerliche Punkte ersetzen keine Beratung durch Fachleute.

---

## Teil A – bereits erledigt (Zweig `playstore`)

| Thema | Stand |
|---|---|
| Ziel-Android-Version | Capacitor 8.6 → Android 16 (API 36), wie von Google für neue Apps verlangt |
| Akku-Optimierung | Store-konform: öffnet die Android-Einstellungsseite statt des direkten Dialogs; Berechtigung `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` entfernt |
| Werbung (AdMob) | eingebaut, **nur Google-Test-Werbung**: Einwilligungsfenster (UMP/TCF), Banner unten, Vollbild nach jeder 3. Suche, keine Werbung während der Navigation, Knopf „Datenschutz-Einstellungen (Werbung)“ unter ⚙️ |
| AdMob-App-ID | wird beim Bauen aus der GitHub-Variable `ADMOB_APP_ID` gelesen; fehlt sie, wird Googles Test-ID verwendet |
| Vermittlungs-Server | Cloudflare Worker im Ordner `server/` gebaut und getestet; Einrichtung siehe B3. Die App nutzt ihn automatisch, sobald seine Adresse in `www/config.js` steht |
| Test-APKs | jeder Bau auf einem Testzweig erscheint als „Pre-release“ unter Releases (der feste Download-Link der Alltags-App bleibt unberührt) |
| Eigene Test-Kennung | Der Zweig baut „Waldläufer Test“ (`de.waldlaeufer.test`) – läuft **neben** der Alltags-App. Vor der Veröffentlichung wieder auf `de.waldlaeufer.app` stellen. |

---

## Teil B – deine Aufgaben und Entscheidungen

### B1. Google-Play-Entwicklerkonto
1. Auf https://play.google.com/console registrieren (einmalig 25 US-$), Identität bestätigen.
2. Bei einem **privaten** Konto: Vor der Veröffentlichung ist ein **geschlossener Test mit mindestens
   12 Testern über 14 Tage** Pflicht. Tester rechtzeitig sammeln (Freunde, Laufgruppe).
3. Bei Einnahmen (Werbung) giltst du als Händler: Name, Adresse, E-Mail und Telefon werden im Store
   öffentlich angezeigt (EU-Gesetz über digitale Dienste).

### B2. AdMob-Konto (Werbung)
1. Auf https://admob.google.com mit demselben Google-Konto anmelden, Zahlungsprofil anlegen.
2. **App hinzufügen** (Android, „noch nicht im Store“) → du erhältst die **App-ID** (`ca-app-pub-…~…`).
3. Zwei **Anzeigenblöcke** anlegen: „Banner“ (adaptiv) und „Interstitial“ (Vollbild) → zwei IDs (`ca-app-pub-…/…`).
4. Unter **Datenschutz & Mitteilungen** eine **DSGVO-Nachricht** erstellen und veröffentlichen.
   Ohne sie erscheint kein Einwilligungsfenster, und in der EU gibt es dann keine personalisierte Werbung.
5. App-ID in GitHub eintragen: Repository → Settings → Secrets and variables → Actions → **Variables** →
   `ADMOB_APP_ID`.
6. Die beiden Anzeigenblock-IDs an Claude geben (oder in `www/index.html` bei `ADS` eintragen und
   `testing: false` setzen). **Niemals** echte Werbung auf dem eigenen Handy antippen – das kann zur
   Sperre des AdMob-Kontos führen. Zum Testen bleibt `testing: true`.
7. Später: Datei `app-ads.txt` auf einer eigenen Website hinterlegen (AdMob zeigt den Inhalt an).

### B3. Routing für alle Nutzer – Vermittlungs-Server (gebaut, muss noch eingerichtet werden)
Der Server liegt im Zweig `main`, Ordner `server/` (Cloudflare Worker). Er verwahrt deinen openrouteservice-Schlüssel,
lässt nur Rundkurs- und Ortsanfragen durch und begrenzt: höchstens 30 Anfragen pro Gerät und Minute,
insgesamt knapp unter dem Minutenlimit von openrouteservice. Die App braucht dann **keinen** Schlüssel mehr.
Kapazität mit dem kostenlosen openrouteservice-Kontingent: ca. 100–200 Suchen pro Tag für alle Nutzer
zusammen. Wächst die Nutzerzahl darüber hinaus: openrouteservice selbst betreiben oder einen bezahlten
Routing-Dienst nehmen (der Server bleibt dabei die Zwischenstation, die App muss nicht geändert werden).
Vorher klären: Ob der kostenlose openrouteservice-Zugang mit Werbeeinnahmen genutzt werden darf, ist auf
deren Seite nicht eindeutig – kurz bei HeiGIT anfragen.

**Einrichtung (einmalig, ca. 10 Minuten):**
1. Kostenloses Konto auf https://dash.cloudflare.com anlegen.
2. Links „Workers & Pages“ öffnen. Beim ersten Mal fragt Cloudflare nach einer **workers.dev-Subdomain**
   (frei wählbar, z. B. `waldlaeufer`) – festlegen.
3. **Konto-ID** kopieren (steht auf der Übersichtsseite von „Workers & Pages“ rechts als „Account ID“).
4. **API-Token** anlegen: oben rechts Profil → „My Profile“ → „API Tokens“ → „Create Token“ →
   Vorlage **„Edit Cloudflare Workers“** → „Use template“ → bei Konto/Zone „All“ lassen → „Continue“ →
   „Create Token“ → Token kopieren (wird nur einmal angezeigt).
5. In GitHub: Repository → Settings → Secrets and variables → Actions → **New repository secret**,
   drei Einträge: `CLOUDFLARE_API_TOKEN` (Token), `CLOUDFLARE_ACCOUNT_ID` (Konto-ID),
   `ORS_API_KEY` (dein openrouteservice-Schlüssel). Secrets sind danach für niemanden mehr lesbar.
6. Claude Bescheid geben → der Server wird automatisch eingerichtet (Ablauf „Server einrichten“),
   die Adresse wird in `www/config.js` eingetragen, und die nächste Test-APK nutzt den Server.

**Bitte Schlüssel und Token nie in den Chat kopieren** – nur direkt in GitHub eintragen.

**Wenn plötzlich sehr viele Nutzer kommen:** siehe `NOTFALLPLAN.md` (Zweig `main`). Kurz: Der Server
speichert gleiche Suchen zwischen, begrenzt Suchen je Gerät und Tag, hält eine Reserve zurück und zeigt
freundliche Meldungen statt Fehlern. Eine stündliche Prüfung schickt dir per GitHub eine E-Mail, wenn das
Kontingent knapp wird. Sofortmaßnahmen und das Umstellen auf einen eigenen Routing-Server gehen über
GitHub-Variablen und „Run workflow“ – ohne App-Update.

### B4. Kartenanbieter
Die jetzigen Karten (OpenTopoMap, OpenStreetMap-Server, Esri-Satellit) sind für Apps mit Einnahmen nicht
vorgesehen. Bei einem Anbieter mit kommerzieller Lizenz ein Konto anlegen (z. B. MapTiler, Stadia Maps,
Thunderforest – alle mit Outdoor-Karten) und den Schlüssel an Claude geben; der Umbau in der App ist klein.

### B5. Release-Signatur
Für den Store wird statt der Test-APK eine signierte **AAB-Datei** gebraucht. Dafür einen Upload-Schlüssel
erzeugen und als GitHub-Secrets hinterlegen (Claude erklärt die Schritte bzw. baut die Bauanleitung um).
Den Schlüssel sicher aufbewahren – ohne ihn lassen sich keine Updates mehr hochladen
(mit „Play App Signing“ kann Google ihn im Notfall zurücksetzen).

### B6. Rechtliches (Deutschland)
- Gewerbe anmelden, steuerliche Fragen klären (z. B. Kleinunternehmerregelung).
- **Datenschutzerklärung** als Webseite: Standort (GPS), Übermittlung an den Routendienst, Werbung über
  Google AdMob inkl. Werbe-ID und Einwilligung, gespeicherte Daten nur auf dem Gerät.
- Haftungshinweis: Routen werden aus Kartendaten berechnet; Wege können gesperrt oder gefährlich sein.
- Name „Waldläufer“ beim DPMA / EUIPO auf bestehende Marken prüfen.

### B7. Store-Eintrag
- Symbol 512×512, Feature-Grafik 1024×500, mindestens 2 Handy-Screenshots, Kurz- und Langbeschreibung.
- Inhaltseinstufung (Fragebogen), Zielgruppe (nicht für Kinder), Angabe „App enthält Werbung“.
- Formular **Datensicherheit**: Standort (genau), Werbe-ID; Zweck: App-Funktion, Werbung.
- Erklärung zum **Vordergrunddienst „Standort“** (Navigation bei gesperrtem Bildschirm), meist mit kurzem Video.

---

## Teil C – empfohlene Reihenfolge

1. Test-APK vom Zweig `playstore` ausprobieren (läuft alles mit Android 16 / Capacitor 8? erscheint Test-Werbung?).
2. B3 Server einrichten (Cloudflare-Konto + 3 GitHub-Secrets) → App nutzt den Server, kein Schlüssel mehr nötig.
3. B4 Kartenkonto → Claude stellt die Karten um.
4. B1 + B2 Konten anlegen, B2 IDs eintragen.
5. B5 Signatur → Claude stellt den Bau auf AAB um.
6. B6 Datenschutzerklärung (Claude kann einen Entwurf schreiben) + B7 Store-Eintrag.
7. Geschlossener Test: 12 Tester, 14 Tage → Fehler beheben.
8. Veröffentlichung.

---

## Teil D – Kosten und Einnahmen (Richtwerte)

**Kosten:** Play-Konto 25 US-$ einmalig · Vermittlungs-Server zum Start 0 € · eigener Routing-Server später
grob zweistellige €/Monat · Kartenanbieter: kleine Kontingente teils kostenlos, darüber nach Tarif.

**Einnahmen:** Branchenwerte für Deutschland (Stand 2025) je 1000 Einblendungen: Banner ca. 0,50–1,50 $,
Vollbild ca. 5–8 $. Beispiel: 500 tägliche Nutzer mit je einer Suche ≈ 5–10 € pro Tag.
Am Anfang realistischerweise deutlich weniger. Tragfähiger als reine Werbung ist eine Mischung:
kostenlose Version mit Werbung und begrenzten Suchen pro Tag + kleiner Kauf/Abo „werbefrei und unbegrenzt“.
