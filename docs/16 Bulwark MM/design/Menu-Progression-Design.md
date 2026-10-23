# Menu Progression, Rewards and Badges — design

**Version:** 1.0 (2026-10-22) · epic **MP** [MM-epic_mvkhe7yd_f] · plan story [MM-story_mvkhe82w_g] · stories [MM-story_mvkhef1t_i] (widget), [MM-story_mvkhegop_j] (rewards fly), [MM-story_mvkhei9q_k] (badges); Tech Net in the menu [MM-story_mvkhed1f_h] (Tech Tree epic [MM-epic_mvkg5mm7_2])

Repo copy is canonical: `docs/16 Bulwark MM/design/Menu-Progression-Design.md`.

**Owner request (2026-10-22):** "The design is perfect .. I will need to review the actual tree data but the visuals can replace the existing Tech Tree now. We will need to create a player progression widget as a header, footer, or info window for the main menu. When player complete battles the rewards should fly to economy indicators on the progression widget. We should also implement the notification badges as red dots on each menu item to indicate unlocks and updates." Then: "Post battle flow will need to add rewards which are probably missing right now".

## 1. Tech Net is the menu's Tech Tree

The main menu's **TECH TREE** button opens the 3D Tech Net (Tech-Tree-Design §11) full screen over the menu, on the **real save**:

| | sandbox page (`techtree3d.html`) | in the game (menu) |
|---|---|---|
| bank | a pretend bank in this browser | the banked gold (`save.carry.gold`) |
| owned | this browser's sandbox list | `save.tech.owned` (with `save.tech.paid` for refunds) |
| Map 3 Victory | a toggle | won: any `maps[3]` beaten or a faction record with Map 3 won |
| "1 win on a planet" | assumed | read from `factionRecords[faction].mapsWon` |
| refunds | full | full — while the tree data is in review nothing bought is lost |

One copy of everything: the tree data is `src/data/techtree.js` (pure — nodes, divisions, prices, status rules), the view is `src/menu/technet.js` (`mountTechNet(THREE, addons, host, adapter)`), and three.js's orbit controls and bloom are vendored beside `vendor/three.module.js` (`vendor/three-addons/`), so the game needs no CDN. `techtree3d.html` is now a thin page over the same modules (open it from the dev server or the Pages link).

Research is **recorded** now; its effects reach the battle with the Tech Tree build stories (sim loadout). The old Tech Tree screen (`techtree.js`, display-only nodes) and the classic TECH tier screen retire.

## 2. Progression widget — the menu header

A strip at the right of the menu's top bar, on **every** menu screen (main, survey, harvester, settings):

| indicator | shows | source |
|---|---|---|
| **Commander rank** | level number in a hex badge, rank title, XP bar to the next level | `save.progress.xp` → `src/data/progression.js` |
| **Gold** | banked gold | `save.carry.gold` |
| **Stars** | total best stars over all maps | sum of `save.maps[*].stars` |
| **Research** | upgrades researched / 57 | `save.tech.owned` |

Tapping Gold or Research opens the Tech Net; tapping Stars or the rank opens the Survey. On a phone the strip drops the labels and keeps the numbers.

### 2.1 Commander XP and ranks (data: `src/data/progression.js`)

| battle | XP |
|---|---|
| win | 100 + 25 × map id + 20 × average wave stars + kills ÷ 4 |
| loss | 25 + 10 × map id + kills ÷ 8 |

The classic board (map 0) grants nothing. XP to go from level L to L + 1 = **300 + 150 × (L − 1)**.

| level | rank | level | rank |
|---|---|---|---|
| 1 | Recruit | 7 | Captain |
| 2 | Private | 8 | Major |
| 3 | Corporal | 9 | Lt. Colonel |
| 4 | Sergeant | 10 | Colonel |
| 5 | Staff Sergeant | 11 | Brigadier |
| 6 | Lieutenant | 12+ | General (12–14), Marshal (15+) |

### 2.2 Banking gold on a win

Today the leftover gold is banked only when the player presses NEXT MAP; going back to the menu after a win banked nothing. Now a campaign **win banks the leftover gold** at match end (`save.carry = { gold: goldRemaining }`, the same thing NEXT MAP does); a campaign battle started from the menu starts with the banked gold. A loss leaves the bank alone. Replays never pay out (only played battles settle rewards).

## 3. Rewards — on the result, then into the widget

### 3.1 The results screen

The post-battle result had a score and wave stars but no rewards. It now shows a **REWARDS** panel under the score, rows rising in one by one: ◆ gold banked (with the new bank; "bank unchanged" on a loss), ★ new best stars (with the total), ⬢ commander XP with the rank and an XP bar that fills, "RANK UP — <title>" when it does, and a pointer to spend the gold in the Tech Tree. Same ledger as below (`hud.js` `rewardsHtml`).

### 3.2 Flying into the widget

At match end the game writes a **rewards ledger**, `save.pendingRewards`, beside the record: `{ mapId, result, gold: { from, to }, stars: { from, to }, xp: { from, to }, level: { from, to } }`. Battles that end before the menu is seen add up (from-values kept, to-values replaced).

When the menu next opens (the post-battle MAIN MENU goes to the Survey), it plays the ledger once and clears it:

1. A **rewards card** rises in the centre: VICTORY / DEFEAT, the map, one row per reward (+gold, +stars, +XP).
2. From each row, **tokens fly** in arcs to their indicator — gold coins to Gold, stars to Stars, cyan XP orbs to the rank badge (up to 14 per row, staggered).
3. Each arrival **pulses** the indicator and steps its counter; the XP bar fills; on a rank-up the badge flashes and shows "RANK UP — <title>".
4. The card fades. Tapping anywhere skips straight to the totals. With `prefers-reduced-motion` there are no tokens: the card shows and the counters set.

Presentation only — the values are already in the save before anything flies.

## 4. Notification badges — red dots

A small red dot on a menu button means "something new here". Opening that screen marks it seen (`save.seen`). Rules (pure, `src/menu/badges.js`):

| button | dot when | seen when |
|---|---|---|
| PLAY | a campaign map was unlocked since the last visit (`unlockedThrough` > seen) | the Survey opens |
| TECH TREE | an upgrade became **available** (requirements met and affordable) that wasn't available at the last visit | the Tech Net opens |
| HARVESTER | the next harvester level became affordable | the Harvester screen opens |
| SETTINGS | a settings feature is new to this player (`SETTINGS_NEWS`, today: the Effects Lab) | Settings opens |

The widget's indicators get the same dot: Research when TECH TREE has one. Dots re-check whenever the menu shows a screen or the save changes.

## 5. Tests

`progression.test.mjs` (XP formula, level curve, ranks), `rewards.test.mjs` (ledger: win banks gold, stars delta, XP, merge of two battles, classic board grants nothing), `badges.test.mjs` (each rule fires and clears), `techtree.test.mjs` (57 upgrades, statuses, portal price by count, refund guard, game-save adapter), plus the full suite and both deploy gates.

## Dependencies

| relation | plan | what it holds that this plan does not restate |
|---|---|---|
| depends-on | docs/16 Bulwark MM/design/Tech-Tree-Design.md | the tree's items, prices, requirements and the 3D view |
