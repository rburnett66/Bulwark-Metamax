# Run this prototype

```
python serve_prototype.py "prototype/canvas-game/index.html"
```

Then open the printed `http://localhost:…` URL.

## Playtest URL overrides (2026-07-16)

Jump straight into a specific fight by appending query params to the game URL — local
(`.../prototype/test-game/index.html?...`) or the Pages link (`https://rburnett66.github.io/Bulwark-Metamax/?...`):

| Param | Values | Meaning |
|---|---|---|
| `map` | `0`–`9` | `0` = classic board; `1`–`9` = campaign map. Boots straight in, skipping the menu. |
| `wave` | `1`–`8` | Open on this wave (earlier waves skipped; gold stipend scales with the wave). |
| `faction` | fuzzy name | Enemy faction — substring match: `air`, `greenies`, `dark`, `powder`, `water`, `arcane`, `space`, `tech`, `artillery`. |
| `seed` | integer | Deterministic RNG seed. |

**Examples**
- `?map=6&wave=5&faction=air` — map 6, open on wave 5, vs the Air faction.
- `?map=3&faction=greenies` — map 3 from wave 1 vs Greenies.
- `?map=0&seed=42` — classic board, fixed seed.

No override → boots to the main menu as normal. The top-bar version stamp confirms the build.

## Content naming conventions

- Campaign map overrides (Map Lab edits): `content/maps/overrides/map-<id>.json` (id 1–9).
- Forged terrain maps (Terrain Forge export): `content/maps/terrain/<name>.json` (Stage 2 loader).
- Sprite sheets: `content/sprite-atlas/<name>.{png,json}`; faction unit defs: `content/units/<faction>.units.json` listed in `content/units/index.json`.
