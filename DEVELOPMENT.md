# Development status

Last updated: 2026-10-31

## Stage checklist

### Stage 1: Foundation ✅
- [x] Vite + React + TypeScript + Tailwind + Framer Motion project
- [x] Navigation: Home, Battle, Collection, Decks, Shop, Profile (desktop sidebar, mobile tab bar)
- [x] Fakedex import: 135 original sprites extracted; 133 used (see docs/ART.md for exclusions)
- [x] Typed, data-driven card schema and registry; reusable card components

### Stage 2: Battle engine ✅
- [x] Setup, opening hands (guaranteed Basic), turn order, drawing, Essence generation and attachment
- [x] Benching, evolution (with first-turn and same-turn restrictions), retreat
- [x] Attacks with 12 damage-modifier modes and 30 effect types (including chosen targets)
- [x] Weakness, resistance, tools, terrains, abilities (passive and activated), timed effects
- [x] Status conditions: asleep, paralyzed, poisoned, burned, confused
- [x] Knockouts, Prime 2-point KOs, promotion, all victory conditions, turn limit, concede
- [x] Hidden-information player views, determinization
- [x] Tests: `tests/engine.test.ts`, `tests/cards.test.ts` (every card is executed)

### Stage 3: AI ✅
- [x] Beginner / Easy / Normal / Expert using the same engine and only `PlayerView`
- [x] Tests: complete matches at every level, legality, hidden-info independence, strength ordering
- Latest 16-game matrix (`npm run sim -- 16`): Easy 14–2 Beginner · Normal 14–2 Beginner · Expert 16–0 Beginner · Normal 9–7 Easy · Expert 11–5 Easy · Expert 11–5 Normal

### Stage 4: Collection and economy ✅
- [x] Accounts (Supabase Auth), usernames, avatars, profile, levels/XP
- [x] Starter grant (2 decks + 300 Scoops), daily reward, missions (daily/weekly), achievements, events
- [x] Server-rolled packs with configurable odds, atomic purchase, pack history, NEW badges
- [x] Collection with owned/missing, completion %, filters, sorting, recent cards
- [x] Deck builder: create, edit, rename, duplicate, delete, validate, Essence selection

### Stage 5: Multiplayer ✅
- [x] Private rooms, 6-letter codes, invite links, ready/unready, deck re-validation
- [x] Server-validated actions with optimistic concurrency, per-player redacted Realtime views
- [x] Reconnection (state reload on open/focus/subscribe), turn timer, idle auto-advance and forfeit
- [x] Tests: full two-player matches through handlers, membership, stale and illegal actions, timeouts

### Stage 6: Polish ✅ (ongoing)
- [x] Holo, rainbow, cosmic and gold foils with pointer tilt; rarity glows; full-art layouts
- [x] Battle FX: attack lunges, damage/heal numbers, coin flips, turn banners, opponent card reveal, battle log
- [x] Pack opening: shake → tear → flip-reveal with rarity bursts → summary
- [x] Responsive layouts verified at 390×844 and 1366×860
- [ ] Sound effects (not implemented; see next steps)

### Stage 7: Deployment ✅
- [x] `vercel.json`, single serverless endpoint, `.env.example`
- [x] SQL migration verified in embedded Postgres (PGlite) including RLS checks
- [x] README with Supabase, GitHub and Vercel instructions

## Verification performed
- `npm test`: engine, 122-card execution suite, AI, server handlers, SQL/RLS
- `npm run build` passes; both TypeScript configs (browser and Vercel CommonJS) typecheck
- Headless-browser runs (Playwright) against the dev server:
  - Offline Practice match from setup to game-over (desktop)
  - Signed-in flow via `scripts/e2e-harness.ts`: bootstrap → daily reward → buy and open a pack →
    collection → build and save a deck → server Solo Battle to completion with rewards → profile (desktop + mobile)
  - Two separate browser sessions: create room → join by code → ready → shared match → turn hand-off

## Not yet verified against a live Supabase project
The handlers, schema and RLS are tested (memory store and PGlite), but this environment had no
network access to a real Supabase project. Points to check after the first deploy:
- Realtime `postgres_changes` delivery on `match_views` (RLS-filtered). The client falls back to
  re-syncing every 15 s and on window focus, so play continues even if Realtime is misconfigured.
- The email-confirmation redirect URL (set Site URL in Supabase Auth).

## Known limitations / bugs
- AI turns in Solo Battles are computed in one request and animated from the returned events,
  rather than streamed move by move (Practice mode does animate the AI step by step).
- Expert AI uses ~3 determinizations × depth-3 beam search. In very long turns on low-end phones
  in Practice mode it can take around half a second per move.
- Normal and Easy are close in strength on simple starter decks; the gap widens with
  evolution-heavy decks.
- Trainer "search" effects pick random matching cards (Pocket-style) rather than letting you
  choose from the deck.
- No rate limiting on `/api/game` beyond Supabase/Vercel defaults.

## Next steps
1. Deploy and smoke-test Realtime with two real accounts (see README → Deploy).
2. Commission or generate bespoke illustrations for the 9 Supporter characters and premium scenes (docs/ART.md).
3. Sound effects (attack, KO, pack tear, rarity sting) behind a mute toggle.
4. Public matchmaking queue (rooms already support it: add a `queue` table and a pairing handler).
5. Card crafting/dust from duplicates; trading.
6. Expansion 004 using the remaining ~60 unused Fakedex creatures (e.g. Oorcute line, Catoddle line,
   Flappilil line, Treflex branching line).
