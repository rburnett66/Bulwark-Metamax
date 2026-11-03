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

Six live states plus **Locked** (added with the missions workbook, §10). Each one is a **hue + a glyph + a bar treatment**, so nothing relies on colour alone. The list sorts in this order, so whatever needs the player is always on top.

| state | hue | glyph | bar | meaning | list group |
|---|---|---|---|---|---|
| Ready | `#5fe39a` | filled hex + tick | solid green, slow shimmer | objectives met, rewards waiting | Ready to claim |
| At risk | `#ff8a3d` | filled triangle + ! | hazard stripes | a deadline or limit is one step from failing | Needs attention |
| New | `#34e1ff` | filled diamond (blinks) | empty cells | logged, not yet opened | Newly logged |
| Active | `#f2c869` | open arc | solid gold | in progress | In progress |
| Failed | `#ef5350` | filled hex + cross | dark red, hatched remainder | broken, expired or abandoned | Archive · Failed |
| Completed | `#7b8898` | tick | steel | rewards claimed | Archive · Completed |
| Locked | `#5c6a7a` dim steel | padlock | none — the Unlock requirements are listed instead | visible (View met) but not yet unlocked; added 2026-11-01 with the missions workbook | Locked (bottom of Current) |

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

## 10. Mission content and the four requirement stages

The missions themselves are authored in `docs/sources/Bulwark-Missions.xlsx` (MLG-7) and extracted to `prototype/test-game/content/missions/missions.json` by `tools/extract_missions.py`. Every mission has requirements in four stages, plus optional failure:

- **View:** when the mission appears in the log at all. Until then it is invisible, which is how alignment-gated missions stay hidden.
- **Unlock:** when it is assigned (status New), with the toast and the header ping.
- **Execute:** where progress counts: a planet, a campaign map, an enemy faction, or anywhere.
- **Complete:** the objectives, which drive the progress bar.
- **Fail:** optional. Any one row met fails the mission.

A mission whose View is met but whose Unlock is not shows as **Locked**. It gets a padlock glyph and dim steel edge, and its dossier lists the Unlock requirements in place of objectives. It sits below Active in the Current tab. The design page does not draw this state yet; the build stories (MLG-4/5) add it.

## 11. Mission flow (owner, 2026-11-02)

**owner**: "1. Primary mission per map, not per wave. 2. Secondary mission per map which is optional, and includes faction impact. Secondary missions may change on alignment history as well. Secondary missions can be unlocked by redoing a planet … 3. Missions are gated by level, faction alignment, and tech tree nodes. 4. Capital ships arrive after finishing the first map on each planet at 3 star or above, then missions can be granted on the capital ships. 5. Mission rewards must be collected at Capital ships when mission series can continue. Linked missions are called a quest line." Owner answers the same day:
- capital ship = **the planet's own faction**;
- the secondary unlock = **a replay that beats your previous result**;
- primaries = **one per planet × map** (81).

**Update (owner 2026-11-03)** [MM-story_mw12m06h_1]: a planet's capital ship arrives when its **map 3** is won at an
average of **3 stars or more** (only 3★ wins open the next map, so map 3 at 3★). Until then the **Collective ship** —
the player's first employer, present from the opening — grants and collects that planet's **maps 1–3** missions,
primaries and secondaries. From map 4 they are granted and collected aboard the planet's own ship. Steps 2–4 below
read with that change: the ship comes after map 3, and primaries 2–3 are granted aboard the Collective ship.
*Open:* the map 2–3 primaries still name the planet's captain as giver; a Collective giver is needed once the opening
script names the Collective's people.

**The loop on one planet:**

1. **Landing (map 1).** The landing craft's quartermaster grants primary 1. The player wins the map.
2. **Capital ship arrives.** It comes when the planet's first map is won at an average of **3 stars or more**. The planet's faction flagship drops into orbit; the nine ships are listed on the workbook's Capital_Ships sheet (Verdance: *Halbrecht's Oath*, Colonel Aldric Vane). If map 1 was won below 3 stars, primary 1 stays Ready, and its rewards wait for the ship.
3. **Collect aboard the ship.** Rewards for every Ready mission on that planet are collected aboard. Collecting is what advances a quest line, because the next step is only offered once the previous one is collected.
4. **Primaries 2–9.** They are granted aboard the ship, one per map. Each is gated by commander level and by **owning** the tech node the previous primary unlocked.
5. **Secondaries.** When a replay of a won map **beats your best average stars**, the ship offers that map's secondary. It is optional and has one attempt: the next battle on that map. Each secondary comes in a **Light** version (alignment history ≥ 0, good or neutral givers) or a **Shadow** version (≤ −1, evil givers from the same faction).
   - **Success** applies the faction impact: loyalty with the planet's faction, a loss with its rival, and an alignment shift when the giver is a zealot.
   - **Failure** costs the broken-promise penalty (−45, as for today's contracts).
6. **Quest lines.** Each planet has two:
   - **Planet campaign:** the 9 primaries.
   - **Favours line:** the 9 secondaries. Either the Light or the Shadow version of a step advances it, so a commander whose alignment flips continues on the other path instead of being stranded.

**Today's wave-2 contract offer moves off the battle timeline.** The faction contract becomes the planet's secondary, offered aboard the capital ship before the battle, and its loyalty rules carry over. Only tracking stays in battle. This retires `questBeats.js`'s mid-battle offer. The build did not keep the contract card as a briefing: the dossier does that job.

**Gating:**

| gate | rule |
|---|---|
| level | primaries rise with the map and the planet's place in the order (Verdance map 1 = level 1, Vexmire map 9 = level 11) |
| alignment | the Light / Shadow band of a secondary; hidden outside its band (VIEW) |
| tech | map 1 of each planet needs that planet's portal node; later primaries need the node the previous step unlocked, owned |

**Tech nodes unlock through missions but are still paid for.** A primary's `tech_unlock` reward makes a node purchasable in the Tech Net; buying it still costs its price. The loop is: complete → collect → unlock → pay → the next primary.
- All 57 buyable nodes are unlocked by exactly one primary, in prerequisite order. The last is the Apocalypse Cannon, on Vexmire map 9.
- Each planet's map 3 opens the next planet's portal.
- Map 5 unlocks that faction's landing craft.
- Resource costs per node are open columns on the workbook's Tech_Unlocks sheet.

**Mission Log changes this implies** (design page update pending):
- Rows carry a **Primary** or **Secondary · Light/Shadow** tag and the quest step ("4 / 9").
- The Ready action reads **Collect aboard Halbrecht's Oath** and opens the capital ship view. Ready missions stay Ready until collected there.
- The dossier shows the quest line, the gates (level, alignment band, tech node) and the faction impact.

## 12. Inventory (owner, 2026-11-02)

**owner**: "Along with missions we should introduce an inventory button next to missions with a list of each resource currently in the game sorted by faction/planet."

- **INVENTORY** is a header chip directly right of MISSIONS (left of the rank chip). Same shape as the other chips; a crate-and-crystal glyph; the count of resources gained since the last visit as a cyan badge.
- **Inventory screen** (owner 2026-11-02: "the inventory screen should show all resources, sorted by planet"): one scrolling view of **all 36 resources**. They are grouped into a band per planet in campaign order (Verdance → Vexmire), each band with the faction icon and colour, the planet's held total and new count. Each band holds the planet's four resources as tiles: rarity colour top edge, crystal glyph, name, tier, held count, +new. Planets whose portal is not owned stay listed but dimmed, with "Portal: X not owned". Tabs filter All 36 / Kept / Quest crystals. Selecting a tile opens the detail pane on the right (on a narrow screen it slides over), showing held count, planet, faction, role, source and what wants the resource.
- **Source of truth:** `docs/sources/Bulwark-Missions.xlsx` › Resources (36 = 9 planets × 4), extracted into `missions.json` › `resources`.
- **Harvest — the Collective contract (owner 2026-11-03, replaces the 2026-11-02 rule)** [MM-story_mw12m2df_2]: at the start of the game the player sells every harvested resource to the Collective through the contract. Each map's contract buys a set number of units per tier (map-data workbook › Maps › `Contract_Common/_Uncommon/_Rare/_Epic`). In battle a load pays gold until its tier's quota is met; above the quota a load pays **no gold** and the player **keeps** it. Only the kept surplus goes to the inventory at battle end. The battle HUD shows each tier as *sold / required*, then ✓ and the units kept.
  - **Starting quotas** come from `tools/economy/contract_quota.mjs`: common (which regrows) = what one harvester delivers on the richest common field in the map's par time, the minimum over the nine planets; uncommon, rare and epic (consumed) = 80 % of what the map seeds, minimum over the planets. So a commander with only the starting harvester sells everything, and extra harvesters produce the surplus. They are tuning values, not rules.
  - *Open:* who buys the harvest once the planet's own ship has arrived (the Collective, or the planet's faction).

## 13. Design page v2 (2026-11-02)

The design page now shows the flow:
- **Header:** an INVENTORY chip right of MISSIONS.
- **List:** Primary / Secondary · Light / Shadow tags with the quest step on every row, and a **Locked — next steps** group.
- **Dossier:** the quest line, a **Gates** panel (met / not met), **Faction impact** for secondaries, and **Collect aboard <capital ship>** in place of Claim. Collecting Amber Fields opens Three Banners, the next step, with the assignment toast.
- **Inventory screen:** all 36 resources on one screen, banded by planet in campaign order, with a detail pane for the selected resource (`?view=inv&res=Petal%20Silk`).
- **Review bar:** gains an Inventory view (`?view=inv`, `&planet=Florael`).

The sample's Ace Jun "Halo" Sato portrait (`content/dialog/portraits/ace-jun-halo-sato.png`) is a group poster with lettering, not a single portrait. The art needs replacing.
