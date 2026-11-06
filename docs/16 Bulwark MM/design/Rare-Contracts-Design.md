# Rare Contracts — Design

Status: defaults for review · 2026-11-06 · Task `task_mw5h8fxu_d` (story R11 `story_mw5eozsn_c`, epic *Content reveal*)
· Tech plan: `docs/tech-plan/Content-Reveal.md` §5.5

## Owner direction (2026-11-06)

> Players do not get missions associated with other planets, although a faction character can appear if your star
> level is above a 2 on wave 3 and present you with the optional contract to collect rare resources from a currently
> unlocked planet. Accepting the contract allows you to sell some rare resources without actually visiting the capital
> ship for that faction, and the optional contract will resolve at the end of that map.

> […] the optional contract which appears only if you get 3 stars on wave 3 will introduce a new character. This new
> character will greet you and give you a mission the first time you visit the unlocked capital ship.

> Rare contract propose defaults is fine, create all contracts and save in design and game data.
> Decline costs nothing, but player will need to re-earn it to unlock it again.

## Rules

| Rule | Value | Where it lives |
|---|---|---|
| When it is offered | wave 3 cleared at **3★ or better** (wave 3's own stars), in the frozen interlude before wave 4 | `RARE_OFFER` in `src/data/rareContract.js` |
| Who offers | a character of a faction whose **capital ship has arrived** (its planet's map 3 won at ≥ 3★), never the planet being fought on; picked with the battle seed so a replay offers the same buyer | `pickBuyer` |
| Who the character is | a **new character**, met here first; the same character greets the player and gives a mission on the first visit to that ship | Content-Reveal §5.3 F4–F6; character data per Dialog-Unification |
| What it buys | this map's **rare** finds only, up to **Quota** units, at **Price_Per_Unit** gold each | workbook `Rare_Contracts` |
| Accept | rare units harvested this map count toward the quota | `settleRareContract` |
| Resolves | at the **end of the map, win or lose**: sold = min(quota, rare harvested); gold = sold × price; the buyer gains **Loyalty** if anything sold; the giver's closing line plays (`questClosingDue`) | `settleRareContract` |
| Decline | **costs nothing**; the offer is gone for this run and must be **re-earned** (3★ on wave 3 again, on a later run) | `rareOfferEarned(alreadyOffered)` |
| Missions | never: no mission for another planet is granted | Content-Reveal §5.5 |

## How the defaults were set

`tools/economy/rare_quota.mjs` builds each live board exactly as the game does and counts its rare (red) nodes:

- **Quota** is half of the rare units the board seeds, floored to 10 (minimum 10). Half, because the offer comes at
  wave 3 and the rare fields beyond it sit in the outer rings.
- **Price_Per_Unit** is 1.5 × the Premium `Value_Per_Unit` of the rare nodes' resource (Resources sheet): Flowers
  14 → 21, Minerals 20 → 30. Rare sells above uncommon, which is the reason to take the contract rather than wait
  for the ship.
- **Loyalty** to the buyer is 10 on maps 1–3, 15 on 4–6 and 20 on 7–9, the same bands as the Collective's
  Standing.

To change them, edit the workbook sheet by hand or re-run the measurement. Either way, finish with
`python tools/extract_mapdata.py`, which refuses a quota above what the board seeds.

```
node tools/economy/rare_quota.mjs > /tmp/rc.csv
python tools/economy/write_rare_contracts.py /tmp/rc.csv
python tools/extract_mapdata.py
```

## All 81 contracts

Source: `docs/sources/Bulwark-Map-Data.xlsx` › `Rare_Contracts` → `MAPDATA.rareContracts`. Each cell reads
*quota units @ price gold (loyalty)*; the rare units the board seeds are in brackets.

| Planet | Map 1 | Map 2 | Map 3 | Map 4 | Map 5 | Map 6 | Map 7 | Map 8 | Map 9 |
|---|---|---|---|---|---|---|---|---|---|
| Verdance | 30 @ 30 (10) [60] | 50 @ 30 (10) [100] | 40 @ 21 (10) [80] | 50 @ 21 (15) [100] | 70 @ 21 (15) [140] | 80 @ 30 (15) [160] | 100 @ 21 (20) [200] | 120 @ 21 (20) [240] | 160 @ 21 (20) [320] |
| Florael | 30 @ 30 (10) [60] | 50 @ 30 (10) [100] | 20 @ 21 (10) [40] | 70 @ 21 (15) [140] | 50 @ 21 (15) [100] | 120 @ 30 (15) [240] | 140 @ 21 (20) [280] | 80 @ 21 (20) [160] | 130 @ 21 (20) [260] |
| Ochre | 50 @ 30 (10) [100] | 60 @ 30 (10) [120] | 40 @ 21 (10) [80] | 30 @ 21 (15) [60] | 100 @ 21 (15) [200] | 90 @ 30 (15) [180] | 110 @ 21 (20) [220] | 140 @ 21 (20) [280] | 100 @ 21 (20) [200] |
| Kessra | 50 @ 30 (10) [100] | 40 @ 30 (10) [80] | 70 @ 21 (10) [140] | 90 @ 21 (15) [180] | 60 @ 21 (15) [120] | 110 @ 30 (15) [220] | 70 @ 21 (20) [140] | 140 @ 21 (20) [280] | 110 @ 21 (20) [220] |
| Rime | 40 @ 30 (10) [80] | 60 @ 30 (10) [120] | 60 @ 21 (10) [120] | 40 @ 21 (15) [80] | 60 @ 21 (15) [120] | 130 @ 30 (15) [260] | 90 @ 21 (20) [180] | 110 @ 21 (20) [220] | 150 @ 21 (20) [300] |
| Cinder | 20 @ 30 (10) [40] | 100 @ 30 (10) [200] | 50 @ 21 (10) [100] | 50 @ 21 (15) [100] | 120 @ 21 (15) [240] | 70 @ 30 (15) [140] | 100 @ 21 (20) [200] | 150 @ 21 (20) [300] | 150 @ 21 (20) [300] |
| Lumen | 60 @ 30 (10) [120] | 80 @ 30 (10) [160] | 60 @ 21 (10) [120] | 70 @ 21 (15) [140] | 60 @ 21 (15) [120] | 60 @ 30 (15) [120] | 80 @ 21 (20) [160] | 80 @ 21 (20) [160] | 140 @ 21 (20) [280] |
| Xenthe | 70 @ 30 (10) [140] | 70 @ 30 (10) [140] | 60 @ 21 (10) [120] | 90 @ 21 (15) [180] | 110 @ 21 (15) [220] | 100 @ 30 (15) [200] | 120 @ 21 (20) [240] | 120 @ 21 (20) [240] | 120 @ 21 (20) [240] |
| Vexmire | 80 @ 30 (10) [160] | 60 @ 30 (10) [120] | 40 @ 21 (10) [80] | 70 @ 21 (15) [140] | 80 @ 21 (15) [160] | 80 @ 30 (15) [160] | 70 @ 21 (20) [140] | 100 @ 21 (20) [200] | 160 @ 21 (20) [320] |
