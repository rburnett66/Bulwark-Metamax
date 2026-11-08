# Line of sight — design

Owner, 2026-11-07: waves can't see behind tree lines and mountain obstructions. Build the sight map from the terrain
map; game structures must not affect it.

## Rules (as built, v2026.11.07-d)

- **The sight map** is the terrain map: a cell blocks sight when its terrain is trees or cliff (including their border
  cells). Rocks, brush, dirt, grass and water do not block sight. Towers, walls and every other structure never change
  it. It is built once when the battle starts.
- **Who it limits:** ground attackers (troops, tanks, artillery, scouts). A ground attacker can only target a tower,
  structure, harvester or repair troop when the straight line to it crosses no blocking cell. The shooter's own cell
  and the target's cell don't count.
- **Who it doesn't limit:** flyers see over everything and are seen over everything. Towers and the player's own
  units are unchanged. The base is reached, not sighted: an attacker in reach of the base can always hit it.
- **Losing sight:** an attacker that loses its line to a target drops it and looks again; with nothing in sight it
  keeps advancing on the base.
- **Determinism:** the sight map is a pure function of the map, so replays are unchanged.

## Intended effect

Artillery keeps its range but can only fire at what it can see. Tree lines and ridges shelter towers, so the player can
build behind cover instead of being forced forward.

## Open

- Showing it on screen: marking the cells that block sight, or the area the waves can't see.
- Scout spotting: letting a scout's sight serve the artillery near it (the earlier "artillery needs scouts" idea).
- A play-test pass on wave balance and star scores.

Code: `prototype/test-game/src/sim/sight.js`; tests `sight.test.mjs`.
