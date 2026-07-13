# Bulwark — Map GDD Amendment A: Harvester & Resource System (as built)

**Companion to:** `Bulwark-Map-GDD.md.docx` v1.2 · **Status:** implemented and playable (v2026.07.13-u)
**Rule:** where this amendment conflicts with v1.2, the amendment wins — it records owner decisions made
in playtest after v1.2 shipped. Sections below name the v1.2 sections they supersede.

---

## A1. Open Play (supersedes §3 "The Ring: Map Growth" — player-facing half)

The **whole map is playable from wave 1**: fully visible, buildable anywhere, every resource field
harvestable. There is no reveal veil and no ring gating of the player.

The ring system **survives as the enemy spawn schedule**: each wave's spawns still enter from the
wave's focus side at the ring-scheduled distance, so later waves cross more territory. §3's growth
curve now shapes *where the enemy comes from*, not *where the player may go*.
(Engine keeps a per-map `openPlay` flag — a future special map may re-enable full ring-gating.)

Map play areas (rev 2, owner-corrected):
24×16, 30×18, 34×20, 40×22, 44×24, 50×26, 54×28, 60×30, 64×32.

## A2. Crystal Colors — the resource identity (reshapes §5 "Three Types, Three Roles")

Resources on the board are **crystal fields** — connected clusters of 1–2 cells (a field is ALL
connected same-role cells; touching clusters are one field). Identity is **color**, which the player
reads directly off the art:

| Color | Role (v1.2 term) | Pays | Placement (unchanged from v1.2) |
|---|---|---|---|
| **Blue** | primary | **Gold** | near base, throughout; **regrows** (slow — see A4) |
| **Yellow/Gold** | premium | **Gold** (premium rate) | deep on the wave's spawn side; one-shot |
| **Red** | quest | **Header objective + gold** | far edge, opposite side; one-shot |
| **Green** | quest | **Header objective + gold** | far edge, opposite side; one-shot |

**Change vs v1.2 §5A:** the quest resource is no longer gold-less. Red/green hauls count up as
**quest objectives in the HUD header** (red ● / green ● tallies) *and* pay gold at their type's
base rate. The loyalty conversion of those objective tallies lands with the Quest Contract story —
the header counters are the raw currency the contract will grade (e.g. "12/20 red").
The radial gradient (§5.1) is unchanged: value still reads off distance from base.

## A3. The Harvester (supersedes §8 "The Harvester")

- The base keeps **four docks** just outside its 3×3 footprint — **top, bottom, left, right**.
  **Fleet cap = 4** (one per dock).
- The match starts with **one harvester** at dock 1 (top).
- **Buying more:** the build palette's **Harvestor** structure (500g, 4s build, hotkey 5) is a
  *purchase* — on completion it converts into a new harvester at the **first open dock** and frees
  its build cell. Placement is rejected at the cap (pending bays count) and on boards with no
  resources. This is also the **death-recovery** path: harvesters do not respawn.
- **Orders:** click a harvester, then click any cell of a crystal field — that truck takes the whole
  field as its job. (Clicking a field with no truck selected sends the nearest idle one.)
- **The loop:** drive out → fill cargo → haul home → deposit (gold lands visibly; red/green also
  tick the header) → next unworked cell of the field → repeat.
- **Job end:** when the field is emptied the harvester returns to *its* dock, dumps its last load,
  and **waits for orders**. No auto-redeploy — a regrown blue field must be re-tasked by hand
  (v1.2's anti-farming lever is now the player's own attention plus the slow regrow, ahead of the
  time-bonus system).
- Harvester stats come from the **Factions sheet** (capacity / speed / HP / yield); the baseline row
  drives all trucks until faction choice lands with the campaign shell. Between-map upgrade levels
  (§8's 5 levels) remain future work — note the level-4 "second harvester" perk must be rethought
  against the 4-dock cap (proposal: level 4 raises the *starting* fleet, cap stays 4).
- The harvester is a non-combatant: it has its own unit-info panel (cargo, yield, live status, dock)
  and never fights. Enemies currently ignore it; giving attackers opportunistic shots is planned
  with the star rubric (star 2, "zero harvesters lost").

## A4. Economy (amends §7 assumptions + Global_Params)

- **Resource maps start at 900 gold with NO passive income** — after the opening build, every coin
  is hauled. (Classic board keeps the old timer economy.)
- **Blue regrowth is slow:** 600s (workbook 75s × 8, owner-tuned twice). Yellow/red/green never
  regrow.
- **Crush rule:** placing any structure on a crystal cell **destroys that resource permanently** —
  even a regrowing blue never comes back.
- The §7.1 spend rule (towers full rate, harvester spend half rate) remains the plan for map
  scoring — not yet implemented (story 4).

## A5. Wave rhythm (new — replaces the passive §2.2 flow between waves)

- The game boots to a frozen board with a full-screen **TAP TO START** → wave 1.
- After each wave clears, the speaking character **holds on screen**, the sim freezes completely
  (timer, regrowth, harvesting — no free farming between waves), and the whole screen becomes the
  **TAP TO START NEXT WAVE** target. §2.2's wave-8 delayed-dialog ordering still applies when the
  score screen lands (story 4).

## A6. Bookkeeping deltas for the workbook (fold into Excel when convenient)

- Maps sheet: rev-2 dims (A1 above); par times rescale with area.
- Global_Params: `Primary_Respawn_Sec` effective value 600.
- Resources sheet: quest types need a gold value column acknowledged (currently they reuse their
  type's Primary-tier `Value_Per_Unit`).
- Star rubric (§6, unbuilt): star 4's "premium claimed in the newly-opened ring" needs rewording for
  open play — proposal: "yellow field claimed on the active spawn side during the wave".
