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
3. Distanz in km einstellen → „Routen suchen". Die Suche dauert bis zu ca. 45 Sekunden; Treffer erscheinen schon während der Suche.
4. Ergebnisse sind nach Natur-Anteil sortiert; der Balken zeigt Wald/Feldweg, Nebenstraße,
   Radweg und Hauptstraße. Runde antippen, dann:

### Neue Suche, letzte Suchen, gespeicherte Routen
- Sobald du suchst, ist der Startpunkt fixiert (🔒). Du kannst die Karte frei verschieben und antippen,
  ohne dass die Ergebnisse verschwinden.
- „＋ Neue Suche" löscht die aktuellen Ergebnisse und gibt den Startpunkt wieder frei.
- „🕘 Letzte Suchen ▾" zeigt deine letzten 10 Suchen mit Ort, Distanz und Uhrzeit. Ein Tipp lädt die
  Ergebnisse sofort wieder (ohne neue Anfrage beim Routendienst). 🗑 entfernt einen Eintrag.
- „☆ Speichern" bei einer Runde legt sie dauerhaft ab (max. 10). „★ Gespeichert ▾" zeigt die Liste;
  antippen lädt die Runde, danach kannst du direkt die Navigation starten.
- Gespeichertes bleibt beim Überinstallieren einer neuen App-Version erhalten, geht aber verloren,
  wenn du die App deinstallierst.

### Meine Standorte (⭐ oben neben ⚙️)
- Aktuellen Startpunkt mit Namen speichern (z. B. „Zuhause", „Waldparkplatz"), bis zu 30 Standorte.
- Antippen setzt den Startpunkt sofort – auch wenn gerade Ergebnisse angezeigt werden (die bleiben unter
  „🕘 Letzte Suchen"). 🗑 löscht einen Eintrag.

### Ortssuche
- Beim Tippen erscheinen Vorschläge, mit Enter/Suchen-Taste wird genauer gesucht. Am besten Straße,
  Hausnummer und Ort eingeben („Hauptstraße 5, Lauf"). Koordinaten oder ein Google-Maps-Link gehen auch.
- Ein ausgewählter Ort wird sofort neuer Startpunkt (auch wenn der alte fixiert war).

### Was du auf der Karte siehst
- Gelb markierte Abschnitte sind mäßig steil (5–10 %), rot markierte steil (über 10 %) – bergauf wie bergab.
  Die Längen stehen in der Karte der Runde.
- Kleine weiße Pfeile alle 250 m zeigen die Laufrichtung.
- Nummern in Kreisen markieren jeden Kilometer (1, 2, 3 …) wie bei Komoot.
- Weiß gestrichelte Abschnitte läufst du doppelt (hin und zurück). Dort stehen die Pfeile rechts
  neben der Linie – so siehst du Hin- und Rückweg getrennt.
- Stichwege (ein Stück hinein und auf demselben Weg gleich wieder zurück), die der Routendienst manchmal
  einbaut, entfernt die App automatisch. Die Karte zeigt dann „✂ Stichweg automatisch entfernt".
- Rote Punkte markieren Stellen, an denen die Runde ihre eigene Strecke kreuzt.
- Unter dem Balken stehen „↔ X % doppelt" und „✕ N Kreuzungen". Saubere Runden ohne Kreuzung und fast
  ohne Doppelung bekommen das Abzeichen „⭕ Rundkurs" und werden ganz oben einsortiert. Die Suche läuft
  so lange weiter (max. 30 Anfragen), bis mindestens 2 solche Rundkurse dabei sind.

### Sortieren und Laufrichtung
- Über den Ergebnissen: „Sortieren: Empfehlung | Wenig Höhenmeter | Viele Höhenmeter". Die Wahl wird gemerkt.
- Jede Runde zeigt, ob sie im (↻) oder gegen (↺) den Uhrzeigersinn läuft. „⇄ Richtung umkehren" dreht
  sie um – Pfeile, Kilometer-Nummern, Abbiegehinweise und Höhenmeter (bergauf/bergab) werden angepasst.

### „▶ Navigation starten" (empfohlen)
- Oben erscheint ein Navi-Feld: Pfeil, Meter bis zum nächsten Abzweig, Straßen-/Wegname,
  Rest-Kilometer und gelaufene Kilometer.
- Sprachansagen auf Deutsch: ca. 120 m vorher („In 120 Metern rechts abbiegen …"),
  direkt am Abzweig („Jetzt rechts abbiegen") mit Vibration, dazu jeder volle Kilometer.
- Läufst du mehr als ~45 m neben der Route, wird das Feld rot. Ein Pfeil zeigt zum nächsten Punkt der
  restlichen Route, mit Entfernung und Ansage („Die Strecke geht 200 Meter rechts weiter").
- Abkürzungen sind erlaubt: Triffst du weiter vorn wieder auf die Route, navigiert die App von dort weiter
  und sagt „Abkürzung erkannt – du sparst 1,5 Kilometer".
- „gelaufen" und die Kilometer-Ansagen zählen die tatsächlich gelaufene Strecke (GPS-Spur). Am Ziel sagt
  die App z. B. „6,0 km gelaufen, 2,0 km abgekürzt" oder „9,2 km gelaufen, davon 1,2 km Umweg".
- 🔊/🔇 schaltet die Stimme stumm, „Beenden" beendet die Navigation.
- Läuft auch im Hintergrund: Bildschirm sperren oder zur Musik-/Hörbuch-App wechseln ist erlaubt,
  die Ansagen kommen weiter. Android zeigt dabei die Benachrichtigung „Waldläufer navigiert".
- Beim ersten Start der Navigation fragt die App nach Benachrichtigungen (erlauben) und bittet darum,
  sie von der Akku-Optimierung auszunehmen („Erlauben" → im Android-Fenster bestätigen). Ohne diese
  Ausnahme beenden manche Handys (v. a. Samsung, Xiaomi, Huawei) die Navigation nach einigen Minuten.
  Samsung zusätzlich: Einstellungen → Akku → Hintergrund-Nutzungslimits → Waldläufer darf nicht unter
  „Apps im Standby" bzw. „Apps im Tiefschlaf" stehen.
- Musik & Hörbücher: Unter ⚙️ wählbar – „leiser stellen" oder „kurz pausieren". „🔊 Ansage testen" zeigt,
  ob das Waldläufer-Modul aktiv ist. Steht dort ⚠, fehlt der Ordner `native` oder die neue build-apk.yml auf GitHub.
  Wird die Musik beim Leiserstellen kaum leiser, „kurz pausieren" wählen.
  Manche Hörbuch-/Podcast-Apps pausieren stattdessen kurz und spielen danach weiter – das entscheidet
  die jeweilige App.
- Kopfhörer: Ansagen kommen über die Bluetooth-Kopfhörer, wenn verbunden.
- Keine Ansage zu hören? In den Android-Einstellungen unter „Sprachausgabe" (Text-in-Sprache)
  die Google-Sprachausgabe und das deutsche Sprachpaket aktivieren.

### „In Google Maps öffnen"
- Öffnet die Runde in Google Maps über 8 Zwischenpunkte. Google berechnet den Weg dazwischen
  selbst neu und nimmt dabei oft Straßen statt der Waldwege – die Runde kann also abweichen.
  Für die echte Wald-Route lieber die eingebaute Navigation nutzen.

## Wie die Routensuche funktioniert
- Es werden Rundkurse (Start = Ziel) berechnet, auf Basis von OpenStreetMap.
- Zuerst mit dem Wanderprofil plus „grün" und „ruhig" bevorzugt → Wald, Feldwege, Pfade.
- Nur wenn so keine 3 passenden Runden zustande kommen, wird mit normalem Fußgänger-Profil
  nachgesucht (dann sind mehr Straßen möglich – die Karte sagt dir das).
- Wohngebiete werden gemieden: Nebenstraßen (meist Siedlungen) zählen deutlich schlechter als Radwege
  am Feld; zusätzlich fließt der Grün-Index des Routendienstes ein (falls verfügbar).
- Angezeigt werden Runden mit Zieldistanz ±2 km, doppelte werden aussortiert. Findet sich keine,
  zeigt die App die 3 nächstgelegenen mit Hinweis auf die Abweichung.

## Wenn keine Route gefunden wird
⚙️ antippen → „🔧 Verbindung testen". Der Test zeigt, ob der Schlüssel funktioniert und ob
Rundkurse (normal und mit Wald-Bevorzugung) berechnet werden. Bei ❌ steht die genaue Fehlermeldung
des Routendienstes dabei.

## Dateien im Projekt
- `www/index.html` – die App selbst
- `native/` – kleines Android-Zusatzmodul (Ansagen mit Musik-Absenkung, Akku-Ausnahme) und ein Skript,
  das beim Bauen Berechtigungen einträgt
- `package.json`, `capacitor.config.json`, `.github/workflows/build-apk.yml` – Bau-Einstellungen

## Änderungen
Jede Änderung an Dateien im GitHub-Repository baut automatisch eine neue APK.
Zum Aktualisieren die neue APK einfach über die alte installieren.
