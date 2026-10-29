# DVBZ Exchange · Web-App

Der Merch-Shop als eigene Website. Die Vertriebler melden sich mit E-Mail und Passwort an und brauchen kein Claude. Beim ersten Besuch legen sie ihr Passwort selbst fest. Das geht nur mit einer E-Mail, die im Back Office hinterlegt ist. Mailversand ist nicht nötig.

- `index.html`, `app.js`, `img/`: die Website (statisch, läuft auf jedem Hosting)
- `config.js`: Supabase-Adresse und öffentlicher Schlüssel (trägst du ein)
- `supabase/schema.sql`: Tabellen, Rechte und Server-Funktionen
- `supabase/seed.sql`: Startdaten (24 Titel, 23 Broker, Back Office, Challenges)
- `supabase/test.mjs`: lokaler Test des Schemas mit PGlite

## Was wo passiert
| | Wer | Wie |
|---|---|---|
| Anmelden | alle mit hinterlegter E-Mail | E-Mail + selbst gewähltes Passwort. Fremde E-Mails werden abgewiesen. |
| Passwort vergessen | Back Office | In Supabase unter *Authentication → Users* den Nutzer löschen. Die Person legt ihr Passwort neu fest, Punkte bleiben erhalten. |
| Einlösen, Stornieren | Vertriebler | Server prüft Punkte und Bestand, niemand kann überziehen |
| Punkte buchen, Broker und Titel pflegen | nur Back Office | Rechte in der Datenbank, nicht nur in der Oberfläche |
| Freigeben, bestellt, geliefert | nur Back Office | Freigabe bucht die Punkte ab |
| E-Mail-Adressen | nur Back Office | Vertriebler sehen nur Namen und Team |

Kontobewegungen sind für alle sichtbar (Laufband, Rangliste). Orders sieht jeder nur von sich selbst.

## Einrichtung (einmalig, ca. 30 Minuten)
1. **Supabase-Projekt anlegen** auf supabase.com (kostenloser Plan reicht). Region: *Central EU (Frankfurt)*.
2. **SQL Editor** öffnen: erst den Inhalt von `supabase/schema.sql` ausführen, dann `supabase/seed.sql`.
3. **Bestätigungsmail abschalten** unter *Authentication → Sign In / Providers → Email*: „Confirm email“ ausschalten.
   Sonst würde Supabase eine Mail schicken wollen. Das Freischalten läuft über die hinterlegte E-Mail im Back Office.
4. **`config.js` ausfüllen** mit den Werten aus *Project Settings → API*: Project URL und `anon public` Key.
   Niemals den `service_role` Key eintragen.
5. **Website veröffentlichen** über GitHub Pages (Repository `dvbz-exchange`).
6. **E-Mails der Vertriebler** im Back Office unter „Broker & Depots → Bearbeiten“ eintragen.
   Danach legen sie auf der Website unter „Zum ersten Mal hier?“ ihr Passwort fest. Wer „angemeldet“ ist, zeigt die Spalte „Zugang“.

Hinweis: Wer eine hinterlegte E-Mail kennt, könnte theoretisch vor der eigentlichen Person ein Passwort festlegen. Deshalb E-Mails erst eintragen, wenn die Person Bescheid weiß, und kurz in der Spalte „Zugang“ prüfen.

Du selbst bist als *Back Office* hinterlegt (`seed.sql`, E-Mail arndt@vertriebsbildungszentrum.de) und siehst nach der Anmeldung den Tab „Back Office“.

## Monatlicher Ablauf
- Punkte: Am Monatsende (oder öfter) werden die Zahlen aus dem Vertriebscontrolling als Buchungen eingetragen. Es wird nur der Zuwachs gebucht.
- **Top Broker** zeigt die Punkte des laufenden Monats und startet jeden Monat neu. Das Punktekonto bleibt erhalten.
- Bestellungen: freigeben, dann unter „Druckauftrag · Printful“ kopieren und mit `druck/printful.py` als Entwurf an Printful übergeben.

## Lokal testen
```bash
cd /tmp && npm install @electric-sql/pglite@0.2.17 && cp ~/Documents/Claude/Projects/Merch/webapp/supabase/* . && node test.mjs
```
