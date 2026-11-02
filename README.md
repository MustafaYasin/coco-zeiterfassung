# COCO Zeit

Zeiterfassung für [COCO Munich](https://coco-munich.de) — Tapas & Bar, Barer Straße 68.
Ersatz für Crewmeister, inkl. vollständig importierter Historie (Juli 2024 – Juli 2026).

**Live:** https://coco-zeit.vercel.app

## Features

- **Erfassen** (alle): Ein-/Ausstempeln mit Live-Timer, Zeiten nachtragen, eigene Einträge bearbeiten, Monatsübersicht — optimiert für Handy und iPad.
- **Zeiten** (Admin): Alle Einträge filtern (Person, Monat), anlegen, bearbeiten, löschen. Export als **Excel, CSV, PDF und JSON**.
- **Insights** (Admin): Teamstunden, Schichten, Ø Schichtlänge, gerade Eingestempelte, Stunden pro Person, Wochentrend.
- **Team** (Admin): Zugänge anlegen/löschen, Passwörter setzen, deaktivieren/reaktivieren (Historie bleibt erhalten).

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui; Design seit Oktober 2026: Inter (variabel, über @fontsource, OFL), Akzent Maisgelb `#e9bc52`, Tinte `#1f1c17`
- iPad/iPhone-App mit Capacitor 8 (`ios/`, Bundle-ID `de.cocomunich.zeit`), gleicher Code wie die Web-App
- Supabase (Auth, Postgres mit Row Level Security, Edge Function `admin-users`)
- Biome (Linter + Formatter), Recharts, SheetJS, jsPDF
- Deployment: Vercel

## Entwicklung

`npm run dev` läuft gegen die **lokale** Supabase (Datei `.env.development.local`), nie gegen die Live-Daten.

```bash
npm install
supabase start                 # lokale Datenbank (Docker), Schema aus supabase/migrations
npm run seed:local             # erfundene Testdaten, verweigert alles außer localhost
npm run dev                    # http://localhost:5173
npm run test:e2e               # 18 Prüfungen: Stempeln, Nachtragen, Löschen, Export, Team, RLS
npm run lint                   # Biome
npm run build                  # Produktion (Live-Supabase aus .env)
vercel deploy --prod --yes     # Web deployen
```

## iPad-App

```bash
npm run ios:sync               # Produktion bauen und nach ios/ kopieren (Live-Daten)
npm run ios:sync:lokal         # dasselbe gegen die lokale Testdatenbank
open ios/App/App.xcodeproj     # oder xcodebuild; Team = Apple-Entwicklerkonto
```

Exporte (Excel, CSV, PDF, JSON) öffnen in der App das iOS-Teilen-Menü. Der Login liegt in der App im
nativen Speicher (Capacitor Preferences), nicht im Browser-Speicher.

## Architektur

- Login per Benutzername (intern `<name>@crew.coco-munich.de`) oder echter E-Mail.
- `members` ist von `auth.users` entkoppelt: ehemalige Mitarbeiter:innen existieren ohne Login, ihre Zeiten bleiben auswertbar.
- RLS: Mitglieder sehen/ändern nur eigene Einträge, Admins alles. Nutzerverwaltung läuft über die Edge Function mit Service-Role.
- Ein offener Eintrag pro Person (partieller Unique-Index) verhindert doppeltes Einstempeln.
