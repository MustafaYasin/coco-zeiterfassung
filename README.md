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
- Tailwind CSS v4 + shadcn/ui, Design nach coco-munich.de (Playfair Display, DM Sans, `#2d5339`)
- Supabase (Auth, Postgres mit Row Level Security, Edge Function `admin-users`)
- Biome (Linter + Formatter), Recharts, SheetJS, jsPDF
- Deployment: Vercel

## Entwicklung

```bash
npm install
npm run dev      # lokal starten
npm run lint     # Biome check
npm run build    # Produktion bauen
vercel deploy --prod --yes   # deployen
```

## Architektur

- Login per Benutzername (intern `<name>@crew.coco-munich.de`) oder echter E-Mail.
- `members` ist von `auth.users` entkoppelt: ehemalige Mitarbeiter:innen existieren ohne Login, ihre Zeiten bleiben auswertbar.
- RLS: Mitglieder sehen/ändern nur eigene Einträge, Admins alles. Nutzerverwaltung läuft über die Edge Function mit Service-Role.
- Ein offener Eintrag pro Person (partieller Unique-Index) verhindert doppeltes Einstempeln.
