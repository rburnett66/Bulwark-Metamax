# Mission Log — design (MLG-1)

**Owner request (2026-11-01):** "I want a Mission Log to present all active missions, rewards, and status. Everytime a mission is assigned to the user it gets log with a progress bar. The primary button for this feature should live in the header of the main screen to the left of the Player Info (4 - Sargeant). The UX of the mission log should be a AAA design with custom iconography, concise view which shows the list of missions with icons for type and reward, there should be a complete color language for status, and players should be able to click on a mission and see a full description including details, items, rewards, faction and alignment, with a small portrait of the person who granted the mission."

**The design is the page:** `docs/16 Bulwark MM/design/mission-log/Mission-Log-Design.html`. It is self-contained, so open it in any browser. Its review bar switches between the Mission Log, the main screen, an assignment demo, a progress demo and the **Design system** sheet (`?view=sheet`). It is built by `mission-log/build.py` from `mission-log.src.html`, with the real giver portraits from `prototype/test-game/content/dialog/portraits/`. Epic `epic_mvyqoffg_a`; implementation plan `docs/tech-plan/Mission-Log.md`.

## 1. Where it lives

- **Header button: MISSIONS.** It is the first chip in `.bwm-prog` (`src/menu/menu.js:315`, `progressWidget.js`), directly left of the rank chip ("4 · SERGEANT"). It has the same 52 px chip shape as the rank and economy chips, and it is the only chip with a gold-tinted ground, so it reads as an action rather than a readout.
  - **Contents:** the ledger glyph, the word MISSIONS, and a sub-line "**2 ready** · 4 active".
  - **Count badge:** a hex badge sits on the glyph. It is **green with the count of missions ready to claim** when any are ready. Otherwise it is **cyan with the count of unopened new missions**. It is hidden when there are neither.
  - **Collapse rules:** these are the shipped ones. At ≤ 900 px the sub-line drops. At ≤ 560 px only the glyph and badge remain. Under `max-height:500px` the chip compacts to 40 px, as the others do.
- **Screen.** The Mission Log is a menu screen (`show('missions')`), not a modal. The top bar stays live above it, and the main screen shows dimmed and blurred behind it. Esc, the header button again, or the back control on a narrow screen returns to `main`.
- **The moment a mission is logged:** a slim toast drops under the header. It shows the type badge, MISSION LOGGED, the title, the giver, and an empty progress bar. The header chip pings cyan twice at the same time. That is the whole "every assignment gets logged" moment: the record is created at assignment, never later.

## 2. Status language

Six states. Each one is a **hue + a glyph + a bar treatment**, so nothing relies on colour alone. The list sorts in this order, so whatever needs the player is always on top.

| state | hue | glyph | bar | meaning | list group |
|---|---|---|---|---|---|
| Ready | `#5fe39a` | filled hex + tick | solid green, slow shimmer | objectives met, rewards waiting | Ready to claim |
| At risk | `#ff8a3d` | filled triangle + ! | hazard stripes | a deadline or limit is one step from failing | Needs attention |
| New | `#34e1ff` | filled diamond (blinks) | empty cells | logged, not yet opened | Newly logged |
| Active | `#f2c869` | open arc | solid gold | in progress | In progress |
| Failed | `#ef5350` | filled hex + cross | dark red, hatched remainder | broken, expired or abandoned | Archive · Failed |
| Completed | `#7b8898` | tick | steel | rewards claimed | Archive · Completed |

**Where the hue appears:**
- the 3 px left edge of a row, so the list scans as a column of colour;
- the row's hex type badge, both its tint and its outline;
- the status tag;
- the progress bar and its percentage;
- the dossier's type line and its note.

Ready is the only state with a **filled** tag and the only idle animation in the log, which makes it the loudest thing on the screen. New blinks only its glyph, and only until the player opens the mission. Ready-cyan is never reused for anything else. Gold stays the game's own colour, for primary actions and Active.

## 3. Progress bars

- Up to 14 units, the bar is **segmented**, one cell per thing to do or collect. "7 of 12 Petal Silk" reads as cells, not as a ratio.
- Above 14 it is **continuous** with quarter ticks.
- Every list row carries a bar with its count (`8/15`). Ready, Failed and Completed replace the count with a word: Claim, Broken, Done.
- The dossier shows a big bar (12 px) with the percentage, plus one bar per objective.
- **Limits** are objectives that count *against* you (for example "Wall breaches (limit 2)"). They are drawn in the at-risk treatment and excluded from the mission's percentage.
- **Bonus** objectives are tagged *Bonus* and also excluded from the percentage.

## 4. The list (concise view)

- **Tabs:** **Current** (Ready, At risk, New, Active), **Ready** (the claim queue; the tab shows a green pip when it is non-empty) and **Archive** (Failed, Completed). Each tab shows a count.
- **Grouping:** rows sit under quiet group rules in sort order.
- **Row anatomy:**
  1. Hex type badge, tinted by status.
  2. Title, then the giver's faction icon in the faction accent, the giver's name and the planet.
  3. Status tag.
  4. Up to three reward icons in small wells, then +N.
  5. Bar and count.
  6. Status edge.
- **Selection:** the selected row takes a status-tinted ground and a pointer notch toward the dossier.
- **Empty states give direction:** for example the Ready tab says "Nothing to claim yet. Finish an objective and its rewards wait here."

## 5. The dossier (full description)

Two columns: the mission on the left, the giver on the right. The giver column scrolls on its own and its **action is pinned at its foot**, so Claim is always on screen.

**Mission column:**
1. Type, status tag, and where it applies (for example "Verdance · next 3 battles").
2. The title (34 px / 900).
3. The big bar with its percentage.
4. A one-line note in the status hue that says what is happening: "One more breached wall and this fails." / "All objectives complete. Claim to bank the rewards." / "Broken promise: hauled 50 %, needed 80 %."
5. **Briefing:** the giver's own words, in italics, with a left rule in the faction accent.
6. **Objectives:** a hex check (open, ticked or crossed), the text, a per-objective bar, and the count.
7. **Required items:** resource tiles in the rarity colours (`CRYSTAL`: common `#5aa8f0`, uncommon `#f2c84a`, rare `#e85050`, epic `#52c070`), with the planet and have / need.
8. **Rewards:** tiles with a 2 px top rule in the reward's colour, a 30 px icon, the amount and the label. A failed mission titles this section **Outcome** and shows losses in red.
9. **Terms:** the rules that bind, for example "Fulfil at ≥ 80 % hauled and a win" and "Broken promise −45 Ground loyalty".

**Giver column:**
- **Portrait:** a 3:4 frame with a cut corner and a faction-accent edge. The faction badge sits on the portrait.
- **Name, role and motivation line.** All three come from `content/dialog/voicepacks.json`.
- **Facts:** faction, homeworld, mission planet.
- **Alignment rail.** The nine GDD §10 steps run good to evil: AG, PG, G, CG, N, CE, E, PE, DE. The giver's step is raised and lit, with its name and conviction tier (Zealot, Committed, Free spirit, Unaligned). The **Unknown Contact** gets an unlit violet rail that reads "Unreadable", along with a hooded silhouette instead of a face.
- **Loyalty with that faction:** the current value, a hatched segment showing what this mission adds (red if it takes loyalty away), and the next tier mark.
- **Action, by state:**

| state | action |
|---|---|
| Ready | **Claim rewards** (green, the only green button in the game). A hex burst plays, then the mission moves to Completed. |
| New / Active / At risk | **Track in battle** (pins the mission to the battle HUD, like the quest-crystal counter) and a quiet **Abandon mission** (none for favours) |
| Failed | Remove from log |
| Completed | a dashed "Rewards claimed" stamp |

## 6. Iconography (MLG-6)

All icons are drawn for this feature on a 24-unit grid with a 1.6 stroke and round joins, matching the shipped faction icons in `src/comm/voice.js`. They use `currentColor`. Status glyphs are on a 12-unit grid so they stay crisp at 10 px inside tags. They ship as one sprite (the `<defs>` block in the design page).

- **Header:** `i-log`, a field ledger with a hex seal on its spine.
- **Types:**
  - `t-contract`: sealed contract.
  - `t-favour`: the hood.
  - `t-defend`: battlement and gate.
  - `t-haul`: crystal over a crate.
  - `t-bounty`: crosshair.
  - `t-survey`: radar sweep.
  - `t-campaign`: planet and flag.
- **Rewards:**
  - `r-gold`, `r-xp`, `r-stars`, `r-research`.
  - `r-loyalty`: a banner in the faction accent.
  - `r-crystal`: a resource in its rarity colour.
  - `r-unit`, `r-structure`, `r-blueprint`.
  - `r-sealed`: the Contact's unknown reward.
  - `r-penalty`: a banner struck through.
- **Status:** `s-new`, `s-active`, `s-risk`, `s-ready`, `s-failed`, `s-done`.

Reward colours reuse the header economy: gold `#f2c869`, XP and research cyan `#34e1ff`, stars `#ffe08a`. Loyalty borrows the giving faction's comm accent.

## 7. Type and tokens

- **Face:** the shipped UI face (`"Segoe UI", system-ui`). No web fonts, as everywhere else in the game.
- **Weights:** 800–900 for titles. Labels get wide tracking (`.2–.3em`). Every count uses tabular figures.
- **Surfaces:** ink `#0c0e12`, panel `#1a1f28`, well `#0f1217`, lines `#2e3846` / `#232a34`.
- **Text:** text `#e6ecf3`, dim text `#8fa0b3`.
- **Corners and gradients:** square corners, as in the menu. Gold gradients only on primary buttons, as in the shipped menu.
- **Screen frame:** gold corner ticks (120 × 2 px) at top-left and bottom-right are the screen's only ornament.
- **Motion:**
  - The screen opens with a 280 ms rise.
  - On a narrow screen the dossier slides over the list.
  - Ready bars shimmer.
  - Claim plays the burst.
  - Assignment plays the toast and the ping.
  - Nothing else moves, and `prefers-reduced-motion` stops all of it.

## 8. Layouts

| viewport | layout |
|---|---|
| desktop (≥ 981 px) | list 340–440 px, dossier with a 250 px giver column; both columns scroll independently |
| 701–980 px | the giver card moves under the mission |
| phone landscape (`max-height:500px`, the game's phone orientation) | list 280–330 px, dossier with a 190 px giver column and a 4:3 portrait; the log sits 58 px from the top and 44 px from the bottom |
| ≤ 700 px wide | one pane; picking a mission slides the dossier over the list with an "All missions" back control |

## 9. Content in the prototype (real game data)

Every mission uses real factions, characters and portraits, real planets and their four resources, and the real contract rules (80 % fulfil, −45 broken promise, −30 decline).

| mission | type | state | giver |
|---|---|---|---|
| Rootsong for the Vanguard | contract | Ready | Colonel Aldric Vane, Ground, PG |
| Not One Brick | defense | At risk | Sergeant "Bricks" Malloy, Ground, CG |
| A Quiet Exchange | favour | New | the Unknown Contact |
| Chart the Far Side | survey | New | Mechanic Sora Ito, Air, N |
| Silk for the Wings | harvest | Active | Squadron-Mother Hikari "Dawnwing" Aoi, Air, AG |
| Silence the Blight | bounty | Active | Mother-Spore Ilya, Greenies, AG (her rival Blight-Agitator Sear is the target) |
| Order Through Fire | contract | Failed | Chancellor Wilhelmina Graf, Ground, PE |
| First Light on Verdance | campaign | Completed | Quartermaster Ines Roth, Ground, N |

Only Ground, Air and Greenies have finished portrait art today. Givers from the other six factions show their named placeholder until their art lands.
