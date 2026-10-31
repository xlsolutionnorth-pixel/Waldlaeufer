# Waldläufer – Anleitung

## 1. Kostenlosen Routen-Schlüssel holen (5 Min.)
1. https://openrouteservice.org/dev/#/signup öffnen, kostenloses Konto anlegen.
2. Im Dashboard unter „Tokens" einen Schlüssel erstellen (Typ „Standard") und kopieren.
   Kostenlos: 2.000 Routen pro Tag – eine Suche braucht ca. 10–18.

## 2. APK von GitHub bauen lassen (10 Min., einmalig)
1. Auf https://github.com kostenlos registrieren.
2. Oben rechts „+" → „New repository" → Name z. B. `waldlaeufer` → „Public" → „Create repository".
3. „uploading an existing file" anklicken und aus dem entpackten ZIP hochladen:
   `package.json`, `capacitor.config.json`, `ANLEITUNG.md` und den Ordner `www` (per Drag & Drop) → „Commit changes".
4. Die Bauanleitung anlegen: „Add file" → „Create new file", als Dateiname exakt
   `.github/workflows/build-apk.yml` eintippen, den Inhalt der gleichnamigen Datei aus dem ZIP
   hineinkopieren → „Commit changes".
   (Ordner, die mit einem Punkt beginnen, werden beim Hochladen oft übersprungen – deshalb dieser Schritt.)
5. Reiter „Actions" öffnen. Der Lauf „APK bauen" startet automatisch und dauert ca. 5–8 Minuten.
   Falls nicht: „APK bauen" → „Run workflow".
6. Wenn der Haken grün ist: Lauf anklicken → unten bei „Artifacts" `Waldlaeufer-APK` herunterladen
   (ZIP, darin `Waldlaeufer.apk`).

## 3. Auf dem Android-Handy installieren
1. `Waldlaeufer.apk` aufs Handy bringen (z. B. das ZIP direkt im Handy-Browser von GitHub laden
   und in „Dateien" entpacken, oder per USB/Mail/Google Drive).
2. Datei antippen. Android fragt nach „Installation aus unbekannten Quellen" →
   für die App, mit der du öffnest (Dateien/Chrome), „Zulassen" → „Installieren".
3. Google Play Protect warnt evtl. („Unbekannte App") → „Trotzdem installieren".
   Das ist normal für Apps, die nicht aus dem Play Store kommen.

## 4. Benutzung
1. Beim ersten Start den openrouteservice-Schlüssel einfügen (später änderbar über ⚙️).
2. Startpunkt: 📍 für deinen Standort (Standort-Berechtigung erlauben), Karte antippen,
   Adresse suchen – oder Koordinaten/einen Google-Maps-Link ins Suchfeld einfügen.
   Den orangen Startpin kannst du verschieben.
3. Distanz in km einstellen → „Routen suchen". Die Suche dauert 20–30 Sekunden.
4. Ergebnisse sind nach Natur-Anteil sortiert; der Balken zeigt Wald/Feldweg, Nebenstraße,
   Radweg und Hauptstraße. Runde antippen → „▶ Lauf starten" zeigt deine Position live auf der Karte,
   „In Google Maps" öffnet die Runde in Google Maps (über 8 Zwischenpunkte, kann leicht abweichen).

## Wie die Routensuche funktioniert
- Es werden Rundkurse (Start = Ziel) berechnet, auf Basis von OpenStreetMap.
- Zuerst mit dem Wanderprofil plus „grün" und „ruhig" bevorzugt → Wald, Feldwege, Pfade.
- Nur wenn so keine 3 passenden Runden zustande kommen, wird mit normalem Fußgänger-Profil
  nachgesucht (dann sind mehr Straßen möglich – die Karte sagt dir das).
- Angezeigt werden nur Runden mit Zieldistanz ±1 km, doppelte werden aussortiert.

## Änderungen
Jede Änderung an Dateien im GitHub-Repository baut automatisch eine neue APK.
Zum Aktualisieren die neue APK einfach über die alte installieren.
