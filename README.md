# Durak Multiplayer

Durak Kartenspiel als Webapp. Echtzeit Multiplayer bis 4 Spieler via Lobby Code.
Stack: Next.js 14 (App Router), Supabase (Realtime + Postgres), Tailwind, TypeScript, Vercel.

## Setup

### 1. Supabase Projekt anlegen

1. Auf https://supabase.com einloggen, neues Projekt erstellen
2. Im linken Menue auf "SQL Editor", dann "New query"
3. Inhalt von `supabase/schema.sql` einfuegen und ausfuehren
4. Im Menue "Project Settings" > "API" deine URL und den anon public key kopieren

### 2. Lokal starten

```bash
npm install
cp .env.local.example .env.local
```

In `.env.local` die Werte einfuegen:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Dann:

```bash
npm run dev
```

App laeuft auf http://localhost:3000

### 3. Deploy auf Vercel

```bash
npx vercel
```

Oder via Vercel Dashboard: Repo importieren, Environment Variables setzen (`NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY`), deploy.

## Spielablauf

1. Spieler 1 oeffnet die Seite, gibt seinen Namen ein, klickt "Neue Lobby erstellen"
2. Er bekommt einen 5 stelligen Code (z.B. K7M2X) und teilt ihn mit Freunden
3. Bis zu 3 weitere Spieler treten ueber den Code bei
4. Host klickt "Spiel starten"
5. Klassisches Durak mit 36 Karten, Trumpf wird durch unterste Deck Karte bestimmt

## Implementierte Regeln

- 36 Karten Deck (6 bis Ass, 4 Farben)
- Trumpf: Farbe der untersten Deck Karte
- Niedrigster Trumpfbesitzer startet als Angreifer
- Verteidiger schlaegt mit hoeherer Karte gleicher Farbe oder Trumpf
- Mitspieler koennen Karten gleichen Werts dazulegen (podkidat)
- Maximal 6 Angriffe pro Runde (oder bis Verteidiger keine Karten mehr hat)
- Verteidiger kann jederzeit aufnehmen
- Angreifer koennen passen wenn sie fertig sind
- Runde endet wenn alle Angreifer gepasst haben oder alle Karten geschlagen sind
- Nachziehen auf 6 Karten in Reihenfolge: Hauptangreifer, weitere Angreifer, Verteidiger
- Wer am Ende noch Karten hat ist der Durak

## Mobile Hinweis

Auf dem Handy am besten im Landscape Modus spielen, dann sieht man alle Karten gut.

## Erweiterungen

Ideen zum Selber bauen:
- Spectator Mode
- Chat in der Lobby
- Verschiedene Durak Varianten (perevodnoy, mit 52 Karten)
- Animationen mit Framer Motion
- Sound Effekte
- ELO Ranking persistent in Supabase
- Bot Spieler fuer fehlende Slots
