# Tech Plan — Character fiction: nine secrets, personality and relations (Powder first)

**Repo copy is canonical:** `docs/tech-plan/Character-Secrets.md`.
**Status:** v0.1, 2026-11-19, agent-proposed. Notes and as-built justifications for this epic go here, not on the tickets.

> **owner** (2026-11-17): "Every character will now have 9 secrets: who they love, who they hate, what they want
> (economy item), what they have to share (mission with reward), their secret desire, their hidden treasure (mission
> with reward), their trouble or sorrow, their magic (mission with reward)." … "The 9th secret was intended to be
> related to magic or 6th senses. A sensitivity to that which is not defined yet by science."
> **owner** (2026-11-19): "The secrets are revealed as friendship increases. But the order will change for each
> character. For story telling we could even have [characters] intentionally hide truth for a variety of reasons ..
> shame, fear, loyalty, control, love. This will translate into personalities. Whimsical characters could share magic
> quickly while evil character share secrets or lies to manipulate." … "instead of meeting a new character on each
> wave, interact with 1 character per map with the secondary character from another faction appearing at wave 3. We
> need to simplify the dialog, what we have now is too wordy. Start with the development of the Powder Faction."

## 1. Words (owner-agreed)

| Word | Means | Where it lives |
|---|---|---|
| **Alignment** | The moral axis. Characters already carry the GDD §10 nine steps (AG … DE); the player keeps `s.alignment`. | voicepacks `align`, Givers sheet |
| **Relations** | How factions see each other: **Allied · Friendly · Neutral · Wary · Hostile**. A character's relations start from their faction's row and bend with their secrets. | `src/data/factionRelations.js` |
| **Rapport** | The player's friendship with a character (exists, `save/standings.js`). Secrets reveal as it rises. | `s.rapport` |
| **Loyalty** | The player's standing with a faction (exists). | `s.loyalty` |
| **Personality** | How a character gives up their secrets (order, guards, lies). | character content |

## 2. What exists (reused, not rebuilt)

- `content/dialog/voicepacks.json`: the 81 characters (alignment, motivation, phrases, signature lines). Its source
  doc (`bulwark-dialog-system.md`) is not in the repo or on MetaMax, so the new fiction gets its own canonical files.
- `save/standings.js`: rapport ledger, bands (Not met / Hostile / Wary / Neutral / Friendly ≥20 / Trusted ≥60),
  `characterStandings`, `standingOf`.
- `menu/standingsScreen.js`: the capital-ship STANDINGS screen (character list + detail pane).
- GDD §10–12: alignment matrix and drama threads (`[FL]` family legacy, `[DL]` Otto ↔ Rei hidden love).
- `comm/dialog.js` + `main.js`: battle dialog. Today the wave's faction champion speaks before every wave, and the
  next wave's character speaks between waves.

## 3. Data — `content/characters/<faction>.json` (canonical, hand-authored)

```json
{ "faction": "ground", "status": "draft",
  "characters": [{
    "name": "Captain Otto von Halbrecht", "personality": "devoted",
    "relations": { "air": { "to": "wary", "why": "he loves Rei Skylark" } },
    "lines": { "start": "…", "win": "…", "lose": "…" },
    "secrets": [
      { "key": "hate", "text": "…", "line": "…" },
      { "key": "love", "text": "…", "line": "…", "guard": "love", "who": "Rei \"Skylark\" Tanaka" },
      { "key": "share", "text": "…", "mission": { "task": "…", "reward": { "kind": "gold", "amount": 400 } } },
      { "key": "want", "text": "…", "item": "heartwood-amber" },
      { "key": "desire", "text": "…", "lie": { "text": "…", "until": 60 } }
    ] }],
  "maps": { "1": { "primary": "Quartermaster Ines Roth", "secondary": { "name": "Mechanic Sora Ito", "faction": "air", "line": "…" } } } }
```

- **`secrets` is in the character's own reveal order.** All nine keys appear once: `love, hate, want, share, desire,
  treasure, sorrow, magic, sense`.
- `text`: what the standings show once revealed. `line`: what the character says in battle the first time it is out
  (optional; short).
- `guard`: one of `shame, fear, loyalty, control, love` (see §4). `lie`: a false version shown first; the truth
  replaces it at rapport `until`, and the entry is marked as a lie.
- `want.item`: a real resource id (`missions.json` resources). `share / treasure / magic` carry a `mission`
  (task + a reward of a real reward kind). They are shown in the standings now; making them playable Mission Log
  missions is a follow-up story (§8).
- `sense`: passive fiction now; omens in play are a follow-up (§8).
- `maps`: the cast for the faction's homeworld maps (Powder: Verdance 1–9): one primary per map, and the secondary
  from another faction with their one short line.

## 4. Reveal rules — `src/save/secrets.js` (pure)

- **Steps.** The nth secret in a character's order needs rapport ≥ `SECRET_STEPS[n]` = 0, 5, 12, 20, 30, 42, 60, 80,
  100 (first secret on meeting; Friendly ≈ the 4th; Trusted ≈ the 7th). Unmet characters show nothing.
- **Guards** add a condition on top of the step. A guarded secret that is not yet earned is held back, and the
  secrets after it can still come out:
  | Guard | Condition |
  |---|---|
  | shame | rapport ≥ step + 15 |
  | fear | at least one of their missions kept |
  | loyalty | player loyalty with their faction ≥ 0 |
  | control | Trusted (rapport ≥ 60) |
  | love | the player has met the person they love (`who`) |
- **Discovery stage.** A `magic` or `sense` secret of discovery stage k (Magic-System §6) is held, "Not yet
  understood", until the player has surveyed stage k's homeworld (Verdance, Florael, Kessra, Cinder, Xenthe for stages
  1–5) [MM-story_mwpt846x_3z].
- **Lies.** A secret with `lie` shows the lie once its step is met, and the truth once rapport ≥ `lie.until`; the
  standings then mark it "was a lie".
- `revealSecrets(char, s)` → `[{ key, label, text, lie, wasLie, mission, item }]` in order, plus `held` (count of
  guarded secrets waiting) and `locked` (count not reached).
- **Told aboard.** `s.secretsHeard[name]` counts the secrets a character has told in person. Secrets are told aboard
  the faction's capital ship (owner 2026-11-21: "Secrets should usually be delivered at the capital ships"): after the
  captain's greeting, up to three of the faction's characters with a newly unlocked secret come forward and tell it,
  once each (`mapCast.js aboardSecretCalls`, `shipReveal.js`) [MM-story_mwpsuo5b_3x].
- **The farm visitor** (Farming-Design rules 14–18, not built yet): the faction's wandering visitor on the outpost
  shares what they know once the player's rapport with them has grown (owner 2026-11-21: "The wandering character on
  the planet outpost could also share info once a report has been developed"). When the visitor is built, they tell
  their own unlocked secrets and, as a close knower, rumours about their circle (Character-System §7.1).

## 5. Battle — one character per map, a secondary at wave 3, short lines

- **Map start:** the map's primary (from `maps`, else the faction's cast rotated by map number) speaks once:
  `lines.start`. Secrets are told aboard the capital ship (§4).
- **Between waves:** no character dialog. The wave report, bonus pick and intel stay.
- **After wave 3:** one voice (owner 2026-11-21: "Wave 3 introduces a character and offers a contract"). The secondary
  (another faction) introduces themselves with their one line and, when the rare contract is earned (3★ or more on
  wave 3), offers it for their own faction's ship. A map with no secondary keeps the old offer from an arrived ship's
  contact.
- **Map end:** the primary's `lines.win` / `lines.lose`.
- Factions without a characters file keep today's lines but follow the same cadence (primary = cast rotated by map,
  secondary = the rival faction's champion), so every map drops to three character beats.
- Seeded and replay-safe: picks are pure functions of map id and save.

## 6. Shorter dialog

- Powder lines are rewritten short: one sentence, about 12 words or fewer, in the character's voice.
- The contract tip / star bonus / contract closed placeholder lines are shortened for every faction.
- Other factions' lines are shortened when each faction gets its characters file.

## 7. Standings

- The character detail adds: Personality, Relations (their bent rows, with why), and **Secrets**: revealed ones with
  their text (lies marked once uncovered), held ones as "Keeping something back", locked ones as "???".
- The FACTIONS detail adds the faction's Relations row.

## 8. Follow-ups (own stories, not in the first PR)

- Secret missions: `share / treasure / magic` as Mission Log missions with their rewards (workbook rows).
- Their sense: omens in play (e.g. a warning before a heavy wave once revealed).
- Gifts: giving a character what they want (and `control` guards traded for it).
- ~~The other eight factions' characters files~~: done (#349, reworked to pass the character system in #356).

## 9. Files

| File | Change |
|---|---|
| `content/characters/ground.json` | new: the nine Powder characters + Verdance map cast |
| `src/data/factionRelations.js` | new: 9 × 9 faction Relations + `relationOf`, `characterRelations` |
| `src/save/secrets.js` | new: reveal rules |
| `src/comm/mapCast.js` | new: the map's primary / secondary and their lines |
| `src/main.js` | battle cadence (§5) |
| `src/comm/dialog.js` | shorter tip lines |
| `src/menu/standingsScreen.js` | secrets, personality, relations |
| tests | `characters.test.mjs` (content shape, all nine keys, real items/reward kinds, personality rules), `secrets.test.mjs`, `factionRelations.test.mjs`, `mapCast.test.mjs` |

## Dependencies

| Relation | Document | Why |
|---|---|---|
| depends-on | docs/tech-plan/Dialog-Unification.md | one dialog system; characters tracked the same way |
| depends-on | docs/tech-plan/Dialog-Response-Reputation.md | rapport/standing and the alignment matrix this builds on |
