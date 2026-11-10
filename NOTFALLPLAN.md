# Waldläufer – Notfallplan: zu viele Nutzer, Kontingent aufgebraucht

Die App fragt nur den **Waldläufer-Server** (Cloudflare Worker, Ordner `server/`). Woher der Server die
Routen holt und wie viel jedes Gerät suchen darf, lässt sich **ohne App-Update** ändern – alles über
GitHub-Einstellungen und einen Knopfdruck.

## Woran du es merkst

- **E-Mail von GitHub:** Der Ablauf „Kontingent überwachen“ prüft stündlich den Server. Bei weniger als 20 %
  Restkontingent, aufgebrauchtem Kontingent oder wenn der Server nicht erreichbar ist, legt er ein Issue
  „⚠ Waldläufer: …“ an und erwähnt dich – GitHub schickt dir dazu eine E-Mail. Ist alles wieder normal,
  schließt sich das Issue von selbst.
- Jederzeit selbst nachsehen: `https://<deine-server-adresse>/status` im Browser öffnen
  (Restkontingent, Suchen heute, Geräte heute, Treffer aus dem Zwischenspeicher).

## Was automatisch passiert (ohne dein Zutun)

- **Zwischenspeicher:** Gleiche Suchen (gleicher Startpunkt, gleiche Distanz) kommen 7 Tage lang aus dem
  Speicher und kosten kein Kontingent.
- **Tageslimit je Gerät:** Standard 10 Suchen pro Gerät und Tag. Danach freundliche Meldung in der App:
  „Für heute hast du alle Suchen aufgebraucht … Gespeicherte Runden und Navigation funktionieren weiter.“
- **Reserve:** Sind nur noch 60 Anfragen übrig, starten keine neuen Suchen mehr – laufende werden fertig.
  Meldung in der App: „Gerade sind sehr viele Läufer unterwegs – neue Suchen sind in etwa … wieder möglich.“
- **Kontingent leer:** keine Fehlermeldungen, sondern dieselbe freundliche Meldung mit Wartezeit.

## Stufe 1 – sofort (5 Minuten)

GitHub → Repository → **Settings → Secrets and variables → Actions → Variables** → „New repository variable“:

| Variable | Wirkung | Beispiel |
|---|---|---|
| `STATUS_MESSAGE` | Hinweis, den die App beim Start zeigt | `Gerade sehr gefragt – Suchen heute auf 5 begrenzt. Danke fürs Verständnis!` |
| `DAILY_SEARCHES` | Suchen pro Gerät und Tag | `5` (0 = unbegrenzt) |
| `BUSY_RESERVE` | Reserve für laufende Suchen | `60` |

Danach: **Actions → „Server einrichten“ → „Run workflow“**. Nach ca. 1 Minute ist die Änderung aktiv.
Zum Aufheben die Variable löschen (bzw. `STATUS_MESSAGE` leeren) und erneut „Run workflow“.

## Stufe 2 – mehr Kapazität (Stunden bis 2 Tage)

Der Server kann auf jede openrouteservice-kompatible Quelle umgestellt werden: Variable **`ORS_BASE_URL`**
setzen und „Run workflow“. Die App bleibt unverändert.

**a) Eigener openrouteservice-Server** (empfohlen bei dauerhaft vielen Nutzern)
- Mietserver mit ca. 16 GB Arbeitsspeicher (Richtwert für Deutschland mit den beiden Lauf-Profilen;
  openrouteservice nennt ~8 GB für Deutschland, Fußgänger-Profile brauchen mehr), grob 20–60 €/Monat.
- openrouteservice per Docker installieren, Deutschland-Karte (Geofabrik) einlesen – das dauert einige Stunden.
- Profile `foot-hiking` und `foot-walking` aktivieren, Höhendaten und Zusatzinfos (waytype, surface, green) einschalten.
- Danach `ORS_BASE_URL` = Adresse des eigenen Servers (z. B. `https://ors.meine-domain.de/ors`).
  Ein Schlüssel ist dann nicht nötig. Die Ortssuche läuft weiter über HeiGIT (eigenes Kontingent von
  openrouteservice) – bei Bedarf `PELIAS_BASE_URL` setzen.
- Claude kann die Installationsanleitung bzw. ein fertiges Docker-Setup schreiben.

**b) Höheres Kontingent bei HeiGIT anfragen** – per Mail/Forum; Dauer und Ergebnis ungewiss.

**c) Bezahlter Routing-Dienst (z. B. GraphHopper)** – liefert ein anderes Antwortformat; der Server
müsste übersetzen (ca. 1 Tag Arbeit für Claude). Sinnvoll, wenn kein eigener Server betrieben werden soll.

> Nicht empfohlen: mehrere kostenlose Schlüssel kombinieren, um das Limit zu umgehen – das verstößt
> sehr wahrscheinlich gegen die Nutzungsbedingungen.

## Mit Nutzern kommunizieren

- `STATUS_MESSAGE` setzen (siehe Stufe 1) – erscheint beim Öffnen der App.
- Im Play Store auf Bewertungen antworten: „Danke! Wir bauen gerade die Kapazität aus …“
- Social-Media-Profil/Webseite: kurzer Hinweis.
