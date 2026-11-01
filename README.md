# 🍦 Helado Region TCG

A complete digital trading card game built around the original Fakemon of the **Helado Region**.
Fast, Pocket-style battles (20-card decks, first to 3 points), four AI difficulties, private
online rooms, booster packs, a persistent collection, deck building and a Scoops economy.

- **122 cards** across three expansions: **Genesis**, **Wildfront**, **Celestial**
  (76 creatures, 33 trainers, 13 alternate-art prints; 7 rarity tiers).
- **Server-authoritative**: damage, coin flips, pack rolls, rewards and match results are
  computed on the server. Clients never see hidden cards or the RNG.
- **Vercel + Supabase**: one stateless serverless function, Postgres with Row Level Security,
  and Supabase Realtime for live match updates.

---

## Contents
1. [Quick start (offline)](#quick-start-offline)
2. [Full setup with Supabase](#full-setup-with-supabase)
3. [Deploy: GitHub → Vercel](#deploy-github--vercel)
4. [How to play](#how-to-play)
5. [Architecture](#architecture)
6. [Adding cards and expansions](#adding-cards-and-expansions)
7. [Testing](#testing)
8. [Security model](#security-model)
9. [Project structure](#project-structure)

See also: [DEVELOPMENT.md](DEVELOPMENT.md) (status checklist, known issues, next steps) and
[docs/ART.md](docs/ART.md) (art pipeline and what is still pending).

---

## Quick start (offline)

Requirements: **Node.js 18.18+** (20 or 22 recommended).

```bash
npm install
npm run dev          # http://localhost:5173
```

Without Supabase credentials the site runs in **offline mode**: you can browse every card and play
full **Practice** matches against all four AI difficulties in the browser. Accounts, packs, the
shop, Solo Battles with rewards and online rooms need Supabase (next section).

---

## Full setup with Supabase

### 1. Create the project
1. Create a free project at <https://supabase.com>.
2. **Authentication → Providers → Email**: keep Email enabled. For quick testing you can turn
   off *Confirm email*; leave it on in production.
3. **Authentication → URL Configuration**: set *Site URL* to your Vercel URL later (and
   `http://localhost:5173` while developing).

### 2. Run the database migration
Open **SQL Editor → New query**, paste the whole of
[`supabase/migrations/20261031000000_init.sql`](supabase/migrations/20261031000000_init.sql)
and run it. It creates every table, the RLS policies, the trusted functions, the new-user trigger
and adds `match_views` and `rooms` to the Realtime publication.

Using the Supabase CLI instead:
```bash
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase db push
```

### 3. Environment variables
Copy `.env.example` to `.env` and fill in values from **Project Settings → API**:

| Variable | Where it is used | Secret? |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser client | No |
| `VITE_SUPABASE_ANON_KEY` | Browser client (anon/public key) | No |
| `SUPABASE_URL` | Server function | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Server function only | **Yes — never prefix with `VITE_`** |

### 4. Run locally with the full stack
```bash
npm run dev
```
The Vite dev server also serves `POST /api/game` using the exact same handler that Vercel runs,
so sign-up, packs, Solo Battles and online rooms all work locally. To test multiplayer, open the
site in two different browsers (or a normal and a private window) with two accounts.

---

## Deploy: GitHub → Vercel

### Push to GitHub
```bash
git init                       # skip if the folder is already a repo
git add -A
git commit -m "Helado Region TCG"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/helado-tcg.git
git push -u origin main
```

### Import into Vercel
1. <https://vercel.com/new> → import the repository.
2. Framework preset: **Vite** (detected automatically; `vercel.json` sets the build command and
   output directory).
3. **Environment Variables**: add all four variables from the table above (Production and
   Preview).
4. Deploy. The SPA is served from `dist/`, and `api/game.ts` becomes the serverless function.
5. Copy your production URL into Supabase **Authentication → URL Configuration → Site URL**.

> Vercel functions are stateless and short-lived, so there is no WebSocket game server. Every
> action is a short `POST /api/game` that validates, applies it with the engine and saves the new
> state with an optimistic version check. Supabase Realtime then pushes each player's redacted
> view to their browser. Clients also re-sync on focus and every 15 s as a fallback.

---

## How to play

| Rule | Value (configurable in `src/engine/rules.ts`) |
|---|---|
| Deck size | 20 cards, max 2 copies per name, ≥1 Basic creature |
| Essence (energy) | Pick 1–3 Essence types per deck; one Essence is generated each turn (not on the very first turn) and may be attached to one creature |
| Board | 1 Active + up to 3 Benched creatures |
| Win | 3 points (Prime creatures are worth 2), or opponent has no creatures left |
| Opening hand | 5 cards, always containing a Basic |
| Weakness | +20 damage |
| Status | Asleep, Paralyzed, Poisoned (10), Burned (20), Confused |
| Evolution | Not on either player's first turn, nor on a creature played or evolved this turn |
| Turn timer (online) | 90 s per turn, 120 s for setup; idle opponents can be auto-advanced, then forfeited after a further 3 min |

Card types: **Creatures** (Basic, Stage 1, Stage 2, and 2-point **Prime** creatures), and
**Trainers**: *Items* (any number), *Supporters* (one per turn), *Tools* (attach one per creature)
and *Terrains* (stay in play and affect both players).

**Controls:** tap a hand card and then a glowing spot to play it. Tap the Essence orb and then a
creature to attach. Tap your Active creature to attack, retreat or use abilities. Tap any creature
to inspect it.

### Modes
- **Practice**: runs entirely in your browser vs any AI. No rewards. Works offline.
- **Solo Battle**: vs AI on the server, rewarded.
- **Play a Friend**: private room → share the 6-letter code or invite link → both players pick a
  deck and press Ready.

### Economy (Scoops)
Earned from match wins and losses (by difficulty), the first win of the day, the daily login
reward, daily and weekly missions, one-time achievements and timed events (*Grand Opening Week*:
2× match rewards). All values live in `src/economy/rewards.ts` and `src/economy/missions.ts`.

Anti-farming: matches under 6 turns pay nothing, forfeits pay nothing, solo rewards are capped
per day, rewards against the same online opponent are capped per day, and every grant is
idempotent in the ledger.

Packs cost 100–120 Scoops and contain 5 cards rolled on the server from configurable
per-slot rarity tables (`src/economy/packs.ts`). Odds are shown in the shop.

---

## Architecture

```
            ┌──────────── browser (React + Vite) ────────────┐
            │ UI pages · BattleBoard · Practice AI (local)    │
            │ supabase-js (anon key): read own rows via RLS   │
            └──────┬───────────────────────┬──────────────────┘
       POST /api/game (JWT)        Realtime (match_views, rooms)
                   │                       │
     ┌─────────────▼─────────────┐   ┌─────┴──────────────────────┐
     │ Vercel function api/game  │   │ Supabase Postgres + RLS    │
     │  auth → handlers → engine │──▶│ SECURITY DEFINER functions │
     │  (service-role key)       │   │ (grant_scoops, open_pack…) │
     └───────────────────────────┘   └────────────────────────────┘
```

- **`src/engine`**: a pure TypeScript, deterministic battle engine (seeded RNG stored in state).
  `legalActions()` is the single source of truth: an action is valid if and only if it is in the
  legal list. It is shared by the server, the browser and the AI.
- **`src/cards`**: data-only card definitions. Effects, damage modifiers, passives, tools and
  terrains are structured data, and the engine interprets them. No card IDs are hardcoded in the
  engine.
- **`src/ai`**: four difficulty policies over `PlayerView` only (hidden cards are placeholders):
  Beginner (frequent random slips), Easy (fixed priorities), Normal (one-step look-ahead over
  determinized states) and Expert (beam search over whole-turn sequences with threat evaluation).
- **`src/server`**: trusted handlers behind a `Store` interface (`SupabaseStore` in production,
  `MemoryStore` for tests).

---

## Adding cards and expansions
1. Add artwork: run the art pipeline for new Fakedex sprites (`npm run art -- path/to/file.sb3`),
   or drop transparent images into `public/art/creatures/<key>.webp`.
2. Add definitions to `src/cards/sets/<expansion>.ts`. Every field is typed (`src/cards/types.ts`);
   rules text is generated automatically from the data.
3. For a new expansion: add an `ExpansionDef` in `src/cards/expansions.ts` and append its list
   in `src/cards/registry.ts` (`SET_LISTS`). Optionally add pack odds in `src/economy/packs.ts`.
4. Run `npm test`. The card suite automatically executes every attack, trainer and ability of the
   new cards.

A *new kind* of effect is one union member in `types.ts`, one case in `engine/effects.ts` and one
line in `cards/text.ts`.

---

## Testing
```bash
npm test             # engine, cards, AI, server handlers, SQL migration (≈200 tests)
npm run typecheck
npm run sim -- 20    # AI difficulty win-rate matrix (20 games per pairing)
```
`tests/sql.test.ts` runs the real migration inside an embedded Postgres (PGlite) with a stub of
Supabase's auth schema and verifies the RLS policies and trusted functions.

`scripts/e2e-harness.ts` is a development-only server that runs the real handlers on the
in-memory store with a minimal emulation of the Supabase REST endpoints. It was used to drive
the signed-in UI in a headless browser. It is not part of the deployed app.

---

## Security model
- Clients can **write only their own decks and their avatar**. Currency, collections, pack
  history, missions, achievements, matches and rooms are writable only by the server (service
  role) through `SECURITY DEFINER` functions that are not executable by `anon`/`authenticated`.
- The full match state (hands, deck order, RNG) lives in `matches.state`, which has **no client
  policy at all**. Players receive only `match_views` rows filtered to themselves.
- Every action is re-validated by the engine on the server. Stale or out-of-turn actions are
  rejected (`409`/`422`). Concurrent writes are blocked by optimistic versioning.
- Deck legality and card ownership are re-checked when a match starts.
- Pack contents use `crypto.randomInt` on the server, and the purchase is one atomic SQL
  transaction.
- No credentials are stored client-side except Supabase's own session token.

---

## Project structure
```
api/game.ts                 Vercel function (single endpoint)
src/engine/                 rules, state types, core turn flow, effects, views, RNG
src/cards/                  card schema, element chart, registry, rules-text generator, sets/
src/ai/                     evaluation + 4 difficulty policies
src/economy/                packs, rewards, missions/achievements
src/game/                   starter decks, AI decks, AI runner
src/server/                 handlers, Store interface, Supabase + memory stores, HTTP adapter
src/battle/                 controllers (practice/remote), BattleBoard, creature tokens
src/pages/ src/ui/          React pages and components (cards, scenes, illustrations)
supabase/migrations/        schema, RLS, trusted functions, realtime publication
public/art/creatures/       133 processed creature images (from the Fakedex)
scripts/                    art pipeline, AI simulator, e2e harness
tests/                      vitest suites
```
