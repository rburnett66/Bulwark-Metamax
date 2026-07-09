{
  "title": "BULWARK — Vertical Slice (Tower Defense, Ground/Water/Air)",
  "map": [
    {
      "text": "Single ground lane beside a single water lane; same board geometry as the balance-sim harness",
      "concern": "behavioral",
      "refs": [
        "§17",
        "§19.1"
      ]
    },
    {
      "text": "Both lanes end at the player base in a clearing",
      "concern": "behavioral",
      "refs": [
        "§14",
        "§19.1"
      ]
    },
    {
      "text": "Wall/moat terrain piece blocks and reroutes walker paths (moats block walkers; walls rout attack paths)",
      "concern": "behavioral",
      "refs": [
        "§5",
        "§8",
        "§19.1"
      ]
    },
    {
      "text": "One biome rendered with documented faction palette table (ground, shadows, units, effects, clouds, fog, UI)",
      "concern": "presentational",
      "refs": [
        "§15",
        "§19.1"
      ]
    },
    {
      "text": "Ground drawn as low/mid/high bands; water drawn as surface layer plus sub-surface tint so swimmers read submerged vs floaters on top",
      "concern": "presentational",
      "refs": [
        "§5",
        "§15",
        "V§6"
      ]
    },
    {
      "text": "Base hard-point slots: structures snap to fixed slots; slot count scales with base level",
      "concern": "behavioral",
      "refs": [
        "V§8"
      ]
    }
  ],
  "entities": [
    {
      "text": "Player base: position, HP; damaged by attackers; base HP → 0 = lose",
      "concern": "shared",
      "refs": [
        "§19.1"
      ]
    },
    {
      "text": "Attacker faction: Ground/Powder (tutorial faction), 3 units spanning behavior",
      "concern": "shared",
      "refs": [
        "§9",
        "§19.1"
      ]
    },
    {
      "text": "Walker unit: kind, position, hp; ground-only movement, blocked by water/walls/moats",
      "concern": "shared",
      "refs": [
        "§5",
        "§6",
        "§19.1"
      ]
    },
    {
      "text": "Floater/swimmer unit: kind, position, hp; travels the water lane",
      "concern": "shared",
      "refs": [
        "§5",
        "§6",
        "§19.1"
      ]
    },
    {
      "text": "Flyer unit: kind, position, altitude, hp; ignores ground terrain and walls",
      "concern": "shared",
      "refs": [
        "§5",
        "§6",
        "§19.1"
      ]
    },
    {
      "text": "Anti-ground tower: position, hp, tier, target; cannot target air",
      "concern": "shared",
      "refs": [
        "§7",
        "§19.1"
      ]
    },
    {
      "text": "Anti-air tower: position, hp, tier, target; can target air",
      "concern": "shared",
      "refs": [
        "§7",
        "§19.1"
      ]
    },
    {
      "text": "Wall/moat structure: position, footprint, hp; terrain piece that reroutes walkers",
      "concern": "shared",
      "refs": [
        "§8",
        "§19.1"
      ]
    },
    {
      "text": "Structure lifecycle state per structure: Placing → Building → Complete → Damaged → Destroyed, plus Upgrading and Selling",
      "concern": "shared",
      "refs": [
        "§8",
        "§16"
      ]
    },
    {
      "text": "Unit attributes are data-driven from tables: domain, health, dps (sim-derived), cost (from DPS), vision/radarSignature, targetsBase flag",
      "concern": "behavioral",
      "refs": [
        "§6",
        "§18"
      ]
    }
  ],
  "mechanics": [
    {
      "text": "Basic attackers path to the base and attack the base, treating towers/structures as hazards; only flagged units target structures",
      "concern": "behavioral",
      "refs": [
        "§6",
        "§7",
        "§19.1"
      ]
    },
    {
      "text": "Domain pathing: walker uses ground lane, floater/swimmer uses water lane, flyer ignores terrain",
      "concern": "behavioral",
      "refs": [
        "§5",
        "§19.1"
      ]
    },
    {
      "text": "Wall/moat placement recomputes walker paths (visible path change)",
      "concern": "behavioral",
      "refs": [
        "§8",
        "§19.2"
      ]
    },
    {
      "text": "Weapon domain targeting: each weapon declares which domains it can hit (anti-air = can-target Air; anti-ground cannot hit air)",
      "concern": "behavioral",
      "refs": [
        "§7",
        "§19.1"
      ]
    },
    {
      "text": "Structure lifecycle: placement requires space + cost + build time; structures have health, fire a weapon, take damage, can be repaired, upgraded one tier, and sold for partial refund",
      "concern": "behavioral",
      "refs": [
        "§8",
        "§19.1"
      ]
    },
    {
      "text": "Repairs are free but consume troops; repairs take time and a troop must travel to the structure",
      "concern": "behavioral",
      "refs": [
        "V§5"
      ]
    },
    {
      "text": "Real-time economy: money accrues live; kills grant income; spend on build/repair/upgrade; bankruptcy possible",
      "concern": "behavioral",
      "refs": [
        "§13",
        "§19.1"
      ]
    },
    {
      "text": "Waves: survive N waves = win; base HP reaches 0 = lose",
      "concern": "behavioral",
      "refs": [
        "§19.1"
      ]
    },
    {
      "text": "Vision (minimal, or explicitly stubbed): radar sees air not ground; air units see ground at range",
      "concern": "behavioral",
      "refs": [
        "§5",
        "§19.1"
      ]
    },
    {
      "text": "Determinism: seed-stable identical replay; sim core separated from rendering",
      "concern": "behavioral",
      "refs": [
        "§18",
        "§19.1"
      ]
    },
    {
      "text": "Combat core callable headless (same code path as the §17 balance sim)",
      "concern": "behavioral",
      "refs": [
        "§17",
        "§19.1"
      ]
    },
    {
      "text": "Balance sim pricing: unit price = average DPS over 100 automated battles on the fixed harness; prices stabilize across seeds",
      "concern": "behavioral",
      "refs": [
        "§17"
      ]
    },
    {
      "text": "No hardcoded balance: units/structures/costs read from data tables (config.data.tables / bulwark-balance workbook)",
      "concern": "behavioral",
      "refs": [
        "§7",
        "§18"
      ]
    },
    {
      "text": "Deployed troops spawn at the player base and march to the chosen drop location (drop point is a destination order, not a spawn point)",
      "concern": "behavioral",
      "refs": [
        "V§8"
      ]
    },
    {
      "text": "Battle log stream: complete ordered record of inputs + seed + events written during play; replays re-drive the headless core from the log and prove determinism",
      "concern": "behavioral",
      "refs": [
        "§18",
        "V§9"
      ]
    },
    {
      "text": "Deploy validity check: placement blocked by space, terrain, or insufficient cost",
      "concern": "behavioral",
      "refs": [
        "V§8"
      ]
    }
  ],
  "visual_layers": [
    {
      "text": "Layered 2.5D painter's-algorithm z-order back→front: sky, water (surface + sub-surface tint), ground bands, ground shadows, grass/bushes, trees with cast shadows, ground units, structures, projectiles/ground FX, air units + dim altitude shadows, clouds, muzzle/impact FX, fog of war, screen-space HUD",
      "concern": "presentational",
      "refs": [
        "V§1"
      ]
    },
    {
      "text": "Four-layer unit sprite stack (legs/locomotion, body, weapon, head/sensors); weapon rotates independently toward target; air shapes use rotor/thrust layer instead of legs",
      "concern": "presentational",
      "refs": [
        "V§2.1"
      ]
    },
    {
      "text": "Telegraphing rule: head/sensor swings to target first, then weapon rotates with a lock-on wind-up equal to time-to-fire before the projectile launches",
      "concern": "presentational",
      "refs": [
        "V§2.1"
      ]
    },
    {
      "text": "Ground units/structures depth-sorted by ground anchor (screen-projected Y), re-sorted every frame",
      "concern": "presentational",
      "refs": [
        "V§2.2"
      ]
    },
    {
      "text": "Unit animation states: Idle · Moving · Attacking · Death; structure render states: Placing · Building · Damaged · Aiming · Firing · Upgrading 1-2-3 · Selling/Destroying",
      "concern": "presentational",
      "refs": [
        "§8",
        "§16",
        "V§2.2"
      ]
    },
    {
      "text": "Simple soft shadows for all ground units, structures, trees, offset by global sun direction; air units cast dim offset shadows whose distance/fade conveys altitude",
      "concern": "presentational",
      "refs": [
        "§5",
        "§16",
        "V§3"
      ]
    },
    {
      "text": "Dirt/dust trails under moving units, intensity scaled to unit mass",
      "concern": "presentational",
      "refs": [
        "V§3"
      ]
    },
    {
      "text": "Three-part shot: muzzle flash (light + smoke/sparks), visible traveling projectile matching weapon class (ballistic lob vs hitscan beam), impact effect keyed to damage type",
      "concern": "presentational",
      "refs": [
        "V§4"
      ]
    },
    {
      "text": "Structure lifecycle FX: translucent placement ghost with valid/invalid tint, rising construction dust, gold pie-sweep flash on build/repair/upgrade completion, damage smoke scaling with damage, dust + debris + rubble decal on destruction, sell dust puff + gold pickup",
      "concern": "presentational",
      "refs": [
        "V§5"
      ]
    },
    {
      "text": "Structure selection: dashed range circle plus popup with name, damage, level, upgrade button with price, repair, and sell with sell price",
      "concern": "presentational",
      "refs": [
        "V§5"
      ]
    },
    {
      "text": "Environment shaders: trees sway via vertex shader; clouds drift with vapor-cycling shader and dim ground/occlude air; water shader with no transparency/reflection; moving objects create particle ripples and wake",
      "concern": "presentational",
      "refs": [
        "V§6"
      ]
    },
    {
      "text": "Camera rotation as first-class control: rotation re-runs depth sort and re-projects shadow offsets against fixed sun; HUD never rotates; cinematic slow auto-rotate frames base vs incoming threat at battle intro/outro",
      "concern": "presentational",
      "refs": [
        "V§7"
      ]
    },
    {
      "text": "Deploy loop UI: select from list → hover/drag placement preview ghost with valid/invalid tint → drop or cancel; identical mouse/touch, single pointer",
      "concern": "presentational",
      "refs": [
        "V§8"
      ]
    },
    {
      "text": "HUD: gold readout with animated deltas, unit/structure lists with live pricing and dimmed unaffordable state, phase/wave indicator, march line shown during deploy preview",
      "concern": "presentational",
      "refs": [
        "V§8",
        "Menu§3"
      ]
    },
    {
      "text": "Kill reward feedback: simple coin animation with classic-console coin sounds when an attacker dies",
      "concern": "presentational",
      "refs": [
        "V§10"
      ]
    }
  ],
  "acceptance": [
    "Builds and runs with **no manual fixes**.",
    "Both lanes present; **walker uses ground, floater uses water, flyer ignores terrain**.",
    "Basic attackers **path to base and damage it**, ignoring towers unless flagged.",
    "**Wall/moat reroutes walkers** (visible path change).",
    "All 3 towers: **place (space+cost+build time), fire, take damage, repair, upgrade once, sell**.",
    "Real-time economy: **kill→income, spend→build/upgrade/repair**, bankruptcy possible.",
    "**Win** on surviving waves; **lose** on base death.",
    "**Deterministic** under a fixed seed.",
    "**Combat core callable headless.**"
  ],
  "_source_hash": "455f1bb45279fa23"
}