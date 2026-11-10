# Tech Plan — One dialog system: remove the duplicate, extend the comm system, track every character the same way

**Repo copy is canonical:** `docs/tech-plan/Dialog-Unification.md`.
**Status:** v0.2, 2026-11-09. D1 built (F1 scenes, F2 slides, F4 offers; the duplicates deleted), see §9; §5 and D2–D5 not yet.
**Notes and as-built justifications for this work go here, not on the tickets.**

> **owner** (2026-11-06): "you built a completely new dialog system, when we already had a dialog system. Why didnt you
> use Reality Graph and see the existing functionality" … "on every single map we use the dialog system at least 10
> times." … "create a plan to completely remove the duplicate dialog system. Study the existing system and add the new
> features need to it. Make sure the Collective characters are tracked and detailed the exact same way as the existing
> faction characters. The character have backstory, alignment, friends and enemies. New characters will need
> descriptions so we can make images, and voices should be created suing our voice system. And all characters should
> be tracked using the exisitng spreadsheets"

## 1. What went wrong

- **What was duplicated.** Opening S6 and S7 (PRs #167, #168) shipped a second dialog stack alongside the game's own:
  - `src/dialog/conversation.js` and `conversationState.js`: a panel with typed lines, voice and press to advance.
  - `src/opening/contractCard.js`: an ACCEPT card.
  - `content/dialog/opening.json`, written by hand.
- **How it happened.** The Collective-Opening tech plan listed `conversation.js` as a new module that would only
  "share typography with `comm/commCard.js`". That plan was written without asking the Reality Graph what the comm
  system already does, and S6 and S7 were built without reading their tickets' Reality bundles.
- **What the graph would have shown.** Asked on 2026-11-06, `does_exist("dialog conversation typewriter speaker
  portrait comm card reply choices")` returns `createComm` and the placeholder portrait tool among its first matches.

**Rule from here.** A plan's module map lists, for every new module, the `does_exist` / `impact_of` query it ran and
what came back (§7). A story starts with `read_ticket` and its Reality bundle.

## 2. The existing dialog system (studied 2026-11-06)

| Piece | Where | What it does today |
|---|---|---|
| **Character content** | `bulwark-dialog-system.md` (v1.1, §10 voice packs, 81 heroes) → `prototype/test-game/tools/extract_dialog.py` → `content/dialog/voicepacks.json` | Per character: `align`, `name`, `motivation`, drama `tags` (FL, DL, TA, RE, RV, TW), `phrases`, `gender` (inferred from the voice-profile prose), and the signature lines `m0`, `winEfficient`, `winClose`, `defeat` and `reward` (+ `motive`). Rule: "writers tune the doc, never code". **The source doc is not in the repo**; the extractor takes its path as an argument. |
| **Contact content** | `docs/16 Bulwark MM/design/Unknown-Contact-Dialog.md` → `tools/extract_contact.py` → `content/dialog/contact.json`; drift test `comm/contact.test.mjs` | A speaker outside the 81, with the same doc → JSON → test pattern. |
| **Selection** | `src/comm/dialog.js` | Seeded picks of who speaks at each moment (`challengeCall`, `winCall`, `defeatCall`, `tipsCall`, `contactCall`): about 10 calls a map. Returns call specs `{ factionKey, name, sub, line, gender, intent, voiceSeed, chip?, hold?, center? }`. |
| **Presentation** | `src/comm/commCard.js` `createComm(doc)` | The comm transmission: RF acquire → lock → translator boot → portrait → typed name → spoken and typed line → sign-off. Hold and centre modes ("TAP TO CLOSE"), click to skip, `waitForClose()` to chain lines (used after a battle: verdict → quest close → reward grant), `hush()` when the menu is up, and the shared audio control. |
| **Voice** | `src/comm/voice.js` | Procedural voices: a timbre per faction (`FACTIONS`, keyed by the registry's voice keys), `CONTACTS` for non-faction speakers, `paramsFor`, `playUtterance` (gender, intent and seed per character), static beds and icons. Audition tool: `comm.html` (Comm Array). |
| **Portraits** | `content/dialog/portraits/<slug>.png` (25 final, 56 placeholder); `tools/dialog/placeholder_portraits.py` reads `voicepacks.json` | The card looks up the portrait by `portraitSlug(name)` and falls back to a silhouette. |
| **Character spreadsheet** | `docs/sources/Bulwark-Missions.xlsx` › **Givers** (81 rows) → `tools/extract_missions.py` | `Name, Faction_Key, Faction, Align, Align_Name, Align_Value, Conviction, Motivation, Portrait_Art, Missions given`. Every mission giver must be on it. |
| **Offers** | `src/render/contractModal.js` `showContractModal` | The pre-battle quest contract (ACCEPT / DECLINE → `save/contracts.js`). |
| **Relationships** | Dossier (GDD §10–12): the 9 × 9 alignment matrix and six drama threads; `Dialog-Response-Reputation.md` plans `src/data/alignmentMatrix.js` | Friends and enemies follow from alignment (the matrix), plus named cross-faction ties (the threads). |

## 3. What gets removed

Removed, with the existing piece that replaces each:

| Duplicate | Replaced by |
|---|---|
| `src/dialog/conversation.js`, `src/dialog/conversationState.js`, `conversationState.test.mjs` | Comm card **scenes** (F1) |
| `src/opening/contractCard.js` | `showContractModal` with an offer's own copy (F4) |
| Hand-written `content/dialog/opening.json` | The Collective section of the dialog doc, extracted by `extract_dialog.py` (F5) |
| The `collective` entry in `voice.js` `CONTACTS` | A faction voice like the other nine (F6) |
| The intro's own calls into the duplicates (`introRunner.js`) | Calls into the comm card |

The plans that referenced `conversation.js` are corrected too: Collective-Opening §2, Dialog-Response-Reputation
§3.3, and Capital-Ship-Interior §3.5.

**Kept as new, because nothing existed for them:**
- `dialog/holoSlide.js`: it moves into `comm/` and becomes a card feature (F2).
- The opening's timeline and room view.

## 4. Features added to the existing system

| # | Feature | Change to the existing system |
|---|---|---|
| **F1** | **Scenes**: a run of lines played as one conversation | `commCard.playScene(calls, { onLine })`: each call held and centred, chained through `waitForClose()`, with one SKIP for the whole scene. Built on `showCall` (no second renderer). The post-battle chain in `main.js` (verdict → close → grant) moves onto it too. |
| **F2** | **Holo-slide on a call** | A call spec may carry `slide: { id, title, caption, image?, data? }`. The card shows the slide panel beside itself with a cross-dissolve and drops it on sign-off. `holoSlide.js` moves to `src/comm/` and is styled with the card. |
| **F3** | **Replies on the card** (Dialog-Response-Reputation R2) | A call spec may carry `choices: [{ text, effects, tone }]`. The card renders them after the line lands, in place of "TAP TO CLOSE", and resolves `waitForClose()` with the choice. This replaces that plan's edit to `conversation.js`. |
| **F4** | **Offers with their own copy** | `showContractModal` accepts an offer's `kicker`, `task`, `terms` and `acceptLabel`, and shows one button when there is no `onDecline`. The quest copy stays the default. (Already done on branch `feat/opening-uses-comm-dialog`.) |
| **F5** | **The Collective in the dialog doc** | A tenth faction section in `bulwark-dialog-system.md` §10 with the **same per-character entries** as the 81: alignment, name, motivation, tags, phrases, voice profile and signature lines. The Collective's moments are not battle moments, so its signature lines are the hub moments: `greet`, `contractOffer`, `contractDone`, `standingUp` and `farewell`. A new **Scenes** part of §10 holds scripted sequences (the opening first): each line names a speaker and an optional slide. `extract_dialog.py` gains `"The Collective": "collective"` and emits `voicepacks.factions.collective` and `voicepacks.scenes`. `dialog.js` gains `sceneCalls(packs, id)` and the hub picks. Battle picks keep reading only `COMBAT_FACTIONS`, so no wave ever hears the Collective. |
| **F6** | **A Collective voice like the others** | `voice.js` gives `collective` a faction timbre in `FACTIONS` (warm, clear, unhurried; already tuned as a contact) and removes it from `CONTACTS`. `ORDER` (the nine combat voices) is unchanged. Each officer's register comes from gender and seed exactly as for the 81. The Comm Array tool (`comm.html`) lists the Collective cast for audition. |
| **F7** | **One character registry** | The **Givers** sheet becomes the registry for every speaking character (the 81, the 9 Collective officers, and later contacts). It adds the columns in §5.1. `tools/extract_missions.py` validates them; a new `tools/extract_characters.py` writes `content/dialog/characters.json`. A test checks that the registry, the voice packs and the portraits agree name for name. |
| **F8** | **Image descriptions → prompts and placeholders** | `Portrait_Brief` on the registry is the image description. `tools/dialog/portrait_prompts.py` turns the briefs into a prompt sheet in the style of the Resource Icon Prompts, one prompt per character. `placeholder_portraits.py` reads the registry instead of `voicepacks.json`, so every new character gets a named placeholder until the art lands; `Portrait_Art` tracks Placeholder → Final. |

## 5. The character model — identical for every faction

### 5.1 Registry columns (Givers sheet)

**Existing columns:**
- `Name`, `Faction_Key`, `Faction`, `Align`, `Align_Name`, `Align_Value`, `Conviction`, `Motivation`, `Portrait_Art`,
  `Missions given`.

**New columns:**

| Column | Meaning | Source for the 81 | Source for the Collective |
|---|---|---|---|
| `Role` | Rank or job in a few words | The name's title (e.g. Quartermaster) | The Dossier's "who they are" |
| `Gender` | female / male / neutral (drives the voice register) | `voicepacks.json` | Written in D3 |
| `Drama_Tags` | FL / DL / TA / RE / RV / TW | `voicepacks.json` `tags` | Written in D3 (new threads where they exist) |
| `Backstory` | 2–4 sentences: where they come from, what made them, what they want | §10 voice profiles where present; written where missing (owner review) | Written in D3 |
| `Friends` | Named characters they stand with, `;`-separated, any faction | Drama threads + matrix ++ within the faction | Favourite combat faction's same-alignment hero; officers they back |
| `Enemies` | Named characters they oppose | Drama threads + matrix −− | Written in D3 |
| `Voice_Profile` | One line on how they sound (the §10 prose) | §10 | Written in D3 |
| `Portrait_Brief` | The image description: face, age, build, outfit (faction look and helmet from `Ship-Crew-Characters.md` C2–C3), expression, background | Written in D4 for the 56 placeholders | Written in D3 |

**Derived columns:**
- `Favourite_Faction`, Collective only. It names the combat faction each officer favours (the Dossier's 1:1 web), so
  standing with that faction reaches the officer.
- Friends and enemies by alignment come from the matrix (`alignmentMatrix.js`), so the columns name only the
  specific ties that override or add to it.

### 5.2 The Collective's nine, as they will be registered

| Align | Name | Role | Favourite faction |
|---|---|---|---|
| G | Factor Mira Valcourt | Contract officer; gives the ship and the first contract | Water |
| CG | Supercargo Dorian Quell | Her boss; charismatic salesman | Air |
| PG | Fleet Superintendent Harlan Boerhaave | Runs the transport fleet | Artillery |
| AG | Director Prudence Lund | Worries the wealth corrupts the staff | Arcane / Energy |
| E | Director Caspian Roe | "Greed is good"; names productive recruits | High Tech |
| N | Chief Ledger-Keeper Ovid Marlow | Just the numbers | Space Tech |
| CE | Licensed Interloper Sabine Roux | Privateer and smuggler on a Company letter of marque | Dark Energy |
| PE | Governor Isembard Croke | "A total trade order is a kind of peace." | Ground / Powder |
| DE | The Standing Charter | Faceless authority | Greenies |

Rows 1–5 are owner-specified (Dossier); the names of rows 6–9 were confirmed by the owner (Q2).

**Each officer also gets:**
- the full character entry (motivation, backstory, friends, enemies, phrases, voice profile and signature lines);
- a portrait brief.

These are written in D3 for owner review. The Collective's outfit and service cap come from the crew rig, so a
portrait and the ship's figure match.

## 6. Stories

Epic: *Unify the dialog system*. These replace the open story `story_mw548j4g_v`, which is re-scoped as D1.

| # | Story | DoD (summary) | Depends on |
|---|---|---|---|
| D0 | The dialog source doc in the repo | `bulwark-dialog-system.md` committed under `docs/16 Bulwark MM/design/`; `extract_dialog.py` defaults to it; a drift test like `contact.test.mjs` fails when `voicepacks.json` and the doc differ | Owner supplies the file (Q1, open) |
| D1 | The opening on the comm card; duplicates deleted | F1, F2, F4. The opening plays as a comm scene with slides and offers its contract on `showContractModal`. `conversation*.js`, `contractCard.js` and the hand-written `opening.json` are deleted; the post-battle chain uses `playScene` | D3 (lines) |
| D2 | One character registry | F7. Givers gains the §5.1 columns, filled for the 81 from the voice packs and the doc; `characters.json` extracted; registry ↔ voice packs ↔ portraits test | — (reads `voicepacks.json` until D0 lands) |
| D3 | The Collective cast, tracked like the 81 | F5, F6. Nine registry rows and nine §10 entries (backstory, alignment, friends, enemies, phrases, voice profile, hub lines, portrait brief); the opening as a §10 scene; the Collective voice in `FACTIONS`; the Comm Array lists them; placeholder portraits made | D2 |
| D4 | Image descriptions and prompts for every placeholder | F8. `Portrait_Brief` for the 56 placeholder heroes and the 9 officers; the prompt sheet generated; `placeholder_portraits.py` reads the registry | D2, D3 |
| D5 | Replies on the comm card | F3; Dialog-Response-Reputation R2 rebuilt on the card | D1 |

The **C4 story** (the Collective cast in the voice pack) is absorbed by D3.

## 7. Reality checks behind this plan (2026-11-06)

| Query | Result | Used for |
|---|---|---|
| `does_exist("dialog conversation typewriter speaker portrait comm card reply choices")` | `createComm` (commCard.js), `speakerOf` (voice.js), `portraitSlug`, `placeholder_portraits.portrait` | §2, F1–F3 |
| Source read: `comm/dialog.js`, `commCard.js` (`showCall`, hold, `waitForClose`, `hush`), `voice.js` (`FACTIONS`, `CONTACTS`, `ORDER`) | As §2 | F1, F5, F6 |
| Source read: `render/contractModal.js` | Quest offer with fixed copy | F4 |
| Workbooks: `Bulwark-Missions.xlsx` › Givers (81 rows, 25 Final / 56 Placeholder portraits); `extract_missions.py` reads it | As §2 | F7, §5.1 |
| `voicepacks.json`: source `bulwark-dialog-system.md` v1.1, not in the repo | Doc outside the repo | D0, Q1 |

The graph was behind the repo (`graph_head d84a711` vs `live 2eb7b26`), so every graph answer above was checked
against source.

## 8. Owner decisions (2026-11-06)

| # | Question | Decision |
|---|---|---|
| Q1 | Where is `bulwark-dialog-system.md` v1.1? It is not in the repo, so `voicepacks.json` cannot be regenerated here. | **Open: the owner will find it with a tool later.** D0 waits for it; D1–D5 can start without it, and their extractions and drift tests run against `voicepacks.json` until the doc is committed. |
| Q2 | Names for Collective officers 6–9 (Marlow, Roux, Croke, the Standing Charter) | **Keep all four.** |
| Q3 | Backstory, Friends and Enemies for the 81: write them where the doc has none, for your review? | **Yes:** written in D2, marked draft until the owner approves them. |
| Q4 | The Collective's signature moments | **The proposed five:** `greet`, `contractOffer`, `contractDone`, `standingUp`, `farewell`. |

## 9. As built: D1 (2026-11-09)

> **owner** (2026-11-09): "When a character has multiple lines of dialog use bread crumbs and cycle the dialog, but do
> not redraw the whole dialog window." · "Always use our primary dialog system and remove the duplicate system that
> was created by accident."

- **F1, scenes.** `commCard.playScene(calls, { onLine, center })`. A run of lines by the same speaker is one
  transmission. The card opens once with `showCall`, sized for the run's longest line, with breadcrumbs (one dot per
  line, the current one lit, more than 8 lines drawn smaller) in the footer. Each tap swaps the next line into the same
  window, re-typed and re-voiced, and moves the breadcrumb on; nothing else is rebuilt. A tap while a line types
  finishes it. A new speaker is a new transmission. `hush()` ends a scene. The card's text column can no longer be
  widened by its footer (`.bw-comm-right{min-width:0}`, the hidden quest chip and END take no room).
- **Users.** The Collective opening's bar conversation (`opening/introRunner.js`), with `onLine` cueing its
  holo-slides, and every ship visit's captain lines (`reveal/shipReveal.js speak`).
- **F2.** `holoSlide.js` moved to `src/comm/`.
- **F4.** The opening's first contract is the game's contract card (`render/contractModal.js showContractModal`).
- **Deleted.** `src/dialog/conversation.js`, `conversationState.js` (and its test), `src/opening/contractCard.js`.
- **Lines.** Mira's lines live in `docs/16 Bulwark MM/design/Collective-Opening-Dialog.md` and are generated into
  `content/dialog/opening.json` by `tools/extract_opening.py` (`comm/opening.test.mjs` keeps the two in step). This is
  the interim source until D3 puts the Collective cast in the dialog doc.
- **Not moved yet.** The post-battle chain in `main.js` (verdict → quest close → grant) still chains `showCall`; its
  calls come from different speakers, so a scene would not change what the player sees.

## Dependencies

| relation | document | what it holds that this plan does not restate |
|---|---|---|
| depends-on | docs/tech-plan/Collective-Faction.md | the Collective as a faction, its nine officers and the contracts they talk about |
| depends-on | docs/tech-plan/Dialog-Response-Reputation.md | standing, the alignment matrix and the reply effects F3 renders |
| depends-on | docs/tech-plan/Collective-Opening.md | the opening's beats that play the first scene |
| depends-on | docs/tech-plan/Ship-Crew-Characters.md | the faction looks the portrait briefs follow |
