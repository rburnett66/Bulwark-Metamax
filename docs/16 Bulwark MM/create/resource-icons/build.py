"""Resource icon prompts for Grok + the named icon sheet. [MM-story_mw173qyb_3]

    python3 build.py        # -> prompts.json, Resource-Icon-Prompts.md, sheet.html (render sheet.png from it)

Subjects are written from each resource's in-game description (src/data/planets.js). The shared style block keeps
all 36 icons one family; the tier line sets how much light and finish each gets.
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))

STYLE = ("Square 1:1 game inventory icon for a stylized sci-fi strategy game. One single object, centered, three-quarter "
         "view, filling about 70% of the frame, with a clean, instantly readable silhouette. Painterly semi-realistic "
         "rendering with crisp edges, soft key light from the upper left and a thin rim light. Plain dark slate background "
         "(#0d121a) with a soft circular vignette. No text, no letters, no border, no frame, no hands, no table, no extra objects.")

TIER = {
    "common":   ("Common", "#58a6ff", "Humble and matte: plain natural materials, no inner light. A faint cool blue glow (#58a6ff) behind the object."),
    "uncommon": ("Uncommon", "#ffd76a", "Richer materials with a soft sheen and a few highlights. A warm gold glow (#ffd76a) behind the object."),
    "rare":     ("Rare", "#ff7a6a", "Luminous accents inside the object and a few small floating motes. A coral-red glow (#ff7a6a) behind the object."),
    "epic":     ("Epic", "#7ae08a", "Radiant and the most detailed of the set: strong inner light, fine detail, small drifting particles. A vivid green glow (#7ae08a) behind the object."),
}

PLANETS = [
  ("Verdance", "Ground / Powder", "lush river plains and ancient forests; warm greens and golden light", [
    ("loam-grain", "Loam Grain", "common", "a small tied burlap sack spilling plump golden grain kernels, with two ripe wheat ears leaning against it"),
    ("heartwood-amber", "Heartwood Amber", "uncommon", "a rounded chunk of polished honey-coloured amber with wood-grain swirls and a tiny leaf trapped inside, warm light passing through it"),
    ("rootsong-seeds", "Rootsong Seeds", "rare", "three dark teardrop seed pods with faint glowing vein patterns, fine root tendrils curling from them, and soft concentric hum-ripples in the air around them"),
    ("elder-bloom", "Elder Bloom", "epic", "a large ancient flower with layered ivory and pale-green petals on a short mossy stem, a glowing golden heart of pollen at its centre"),
  ]),
  ("Florael", "Air", "a blooming sky garden; soft pinks, lilacs and dawn light", [
    ("petal-silk", "Petal Silk", "common", "a loosely folded bolt of soft pink-lilac silk woven from flower petals, a few loose petal-strands floating off it"),
    ("skyhoney", "Skyhoney", "uncommon", "a small round glass jar of thick golden honey with a slow drip over the rim, a pale blue sky reflected in the glass"),
    ("dawnpollen", "Dawnpollen", "rare", "a stoppered glass vial of glowing peach-gold pollen dust, tiny motes rising from it like sunrise light"),
    ("choir-lily", "Choir Lily", "epic", "a white and lavender lily with several trumpet-shaped blooms, faint rings of light rippling outward from them like visible chords of music"),
  ]),
  ("Ochre", "High Tech", "an arid desert of salt pans and dunes; bleached whites, sand golds", [
    ("sunsalt", "Sunsalt", "common", "a cluster of coarse white salt crystals on a cracked, sun-bleached slab of salt pan"),
    ("dune-quartz", "Dune Quartz", "uncommon", "a cluster of wind-polished translucent sand-gold quartz prisms with smooth frosted edges"),
    ("mirage-oil", "Mirage Oil", "rare", "a sealed teardrop glass flask of slick oil with a shifting rainbow sheen and a ripple of heat-haze distortion around it"),
    ("solar-pearl", "Solar Pearl", "epic", "a glass orb fused from lightning, branching fulgurite glass around it, a tiny blazing noon sun held inside"),
  ]),
  ("Kessra", "Artillery", "a shelled dust wasteland; rust, copper and scorched ochre", [
    ("slag-iron", "Slag Iron", "common", "a rough chunk of rusted scrap iron with pitted slag and jagged shrapnel edges"),
    ("mesa-copper", "Mesa Copper", "uncommon", "a nugget of red rock split open to show bright metallic copper veins and green patina"),
    ("ghost-brass", "Ghost Brass", "rare", "a small bundle of tarnished ancient brass shell casings with pale spectral wisps curling out of their mouths"),
    ("dreadnought-core", "Dreadnought Core", "epic", "a heavy armoured cylindrical reactor core with riveted, cracked plating and a glowing orange-white heart showing through the cracks"),
  ]),
  ("Rime", "Water", "a frozen sea under ice shelves; pale blues, frost white, deep teal", [
    ("brine-ice", "Brine Ice", "common", "a cut block of pale blue sea ice crusted with salt, frosted edges"),
    ("frost-pearl", "Frost Pearl", "uncommon", "a half-open icy shellfish shell holding a pale blue-white pearl, frost crystals on the shell"),
    ("glacier-breath", "Glacier Breath", "rare", "a sealed frosted glass ampoule holding swirling ancient pale-blue mist"),
    ("leviathan-scale", "Leviathan Scale", "epic", "a single huge ridged scale in iridescent deep teal, sharp-edged, with frost along one rim"),
  ]),
  ("Cinder", "Arcane / Energy", "volcanic ash fields; charcoal, ember and deep blood red", [
    ("ash-basalt", "Ash Basalt", "common", "a chunk of dark grey porous basalt dusted with fine ash, faint warm cracks"),
    ("ember-obsidian", "Ember Obsidian", "uncommon", "a shard of glossy black volcanic glass with edges glowing deep red, as if still warm"),
    ("phoenix-glass", "Phoenix Glass", "rare", "a shard of red-gold glass caught mid-reforming, molten edges fusing back together, tiny flame shapes like feathers"),
    ("heartflame", "Heartflame", "epic", "a living ember floating inside a small ornate reliquary cage of dark iron and gold, burning deep blood-red at the core"),
  ]),
  ("Lumen", "Space Tech", "an airless moon; grey regolith, cold white light, cyan instruments", [
    ("regolith", "Regolith", "common", "a small heap of grey moon dust and metallic rubble pebbles"),
    ("helium-3", "Helium-3", "uncommon", "a sleek cylindrical fuel canister with a cyan glowing sight window and a wisp of cold vapour"),
    ("starfall-iron", "Starfall Iron", "rare", "a meteorite chunk with a scorched black crust and one polished face showing a crosshatched Widmanstatten pattern"),
    ("void-lens", "Void Lens", "epic", "a flawless circular crystal lens floating upright, a deep starfield and nebula visible inside the lens rather than behind it"),
  ]),
  ("Xenthe", "Dark Energy", "a fungal alien forest at twilight; violets, magentas, cold cyan glow", [
    ("glowcap-spores", "Glowcap Spores", "common", "a small cluster of mushroom caps with softly glowing violet gills, a few luminous spores drifting up"),
    ("duskmoss-resin", "Duskmoss Resin", "uncommon", "a drop-shaped chunk of translucent dark violet resin with fine moss fibres trapped inside"),
    ("dreamspore", "Dreamspore", "rare", "a single large floating spore pod, its translucent skin showing a swirling purple-pink dream haze inside"),
    ("mycelial-heart", "Mycelial Heart", "epic", "a pulsing knot of glowing violet mycelium threads woven into the shape of a heart, fine filaments trailing from it"),
  ]),
  ("Vexmire", "Greenies (Chem)", "a toxic hive swamp; murky olive, acid green, waxy amber", [
    ("mire-peat", "Mire Peat", "common", "a cut block of dark wet peat streaked with toxic yellow-green, a few small bubbles on its surface"),
    ("venom-sap", "Venom Sap", "uncommon", "a corked glass vial of thick acid-green sap with one drip down the side and a thin curl of fumes"),
    ("hive-jelly", "Hive Jelly", "rare", "a few waxy hexagonal honeycomb cells brimming with glowing amber-green royal jelly"),
    ("broodqueen-egg", "Broodqueen Egg", "epic", "a large ridged leathery egg with bioluminescent green veins, resting in a nest of hardened hive resin"),
  ]),
]

items = []
for planet, faction, mood, res in PLANETS:
    for rid, name, tier, subject in res:
        tl, col, finish = TIER[tier]
        prompt = (f"{subject}. A resource from {planet}, {mood}. {finish} {STYLE}")
        items.append({"id": rid, "name": name, "tier": tier, "tierLabel": tl, "color": col, "planet": planet,
                      "faction": faction, "file": f"content/icons/resources/{rid}.png", "prompt": prompt})
json.dump({"style": STYLE, "tiers": TIER, "items": items}, open(os.path.join(HERE, "prompts.json"), "w"), indent=1)

md = ["# Resource icon prompts (Grok)", "",
      "36 icons, one per resource (9 planets × 4 tiers). Each prompt is self-contained: paste it into Grok Imagine as is.",
      "Save each result as the file named under it (512 × 512 PNG or larger), so the game can pick it up by id.", "",
      "**Shared style (already inside every prompt):** " + STYLE, ""]
for planet, faction, mood, res in PLANETS:
    md += [f"## {planet} — {faction}", ""]
    for it in [i for i in items if i["planet"] == planet]:
        md += [f"### {it['name']} · {it['tierLabel']}", f"`{it['file']}`", "", "```", it["prompt"], "```", ""]
open(os.path.join(HERE, "Resource-Icon-Prompts.md"), "w").write("\n".join(md))
print(len(items), "prompts")

# ── the named icon sheet: planets across, tiers down; each slot shows where its icon goes ──
TIERS = ["common", "uncommon", "rare", "epic"]
cells = []
for t in TIERS:
    tl, col, _ = TIER[t]
    row = f'<div class="tier" style="--c:{col}"><b>{tl}</b></div>'
    for planet, *_ in PLANETS:
        it = next(i for i in items if i["planet"] == planet and i["tier"] == t)
        row += (f'<div class="cell" style="--c:{col}"><div class="slot"><span>{it["id"]}.png</span></div>'
                f'<div class="nm">{it["name"]}</div></div>')
    cells.append(row)
head = '<div></div>' + "".join(f'<div class="pl"><b>{p}</b><span>{f}</span></div>' for p, f, *_ in PLANETS)
sheet = f'''<!doctype html><meta charset="utf-8"><title>Resource Icon Sheet</title>
<style>
 body {{ margin:0; background:#0b0f16; color:#dfe7ef; font-family:Rajdhani,"Segoe UI",system-ui,sans-serif; }}
 .wrap {{ padding:40px 44px 36px; width:max-content; }}
 h1 {{ margin:0 0 4px; font:800 30px/1 Orbitron,Rajdhani,sans-serif; letter-spacing:.12em; color:#D9A441; }}
 .sub {{ color:#8A97A8; letter-spacing:.14em; font-size:15px; margin-bottom:26px; }}
 .grid {{ display:grid; grid-template-columns:120px repeat(9, 210px); gap:14px 14px; }}
 .pl {{ text-align:center; padding-bottom:6px; border-bottom:1px solid #2a3340; }}
 .pl b {{ display:block; font-size:20px; letter-spacing:.08em; color:#f4f7fb; }}
 .pl span {{ font-size:12px; letter-spacing:.12em; color:#6d7a8a; }}
 .tier {{ display:flex; align-items:center; justify-content:flex-end; padding-right:8px; border-right:2px solid var(--c); }}
 .tier b {{ font-size:15px; letter-spacing:.22em; text-transform:uppercase; color:var(--c); }}
 .slot {{ width:210px; height:210px; position:relative; background:radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--c) 14%, #0d121a), #0d121a 70%);
   border:1px dashed color-mix(in srgb, var(--c) 55%, #2a3340); display:flex; align-items:flex-end; justify-content:center; }}
 .slot span {{ font:600 11px/1 "JetBrains Mono",ui-monospace,monospace; color:#5c6878; margin-bottom:8px; }}
 .nm {{ text-align:center; font-size:17px; font-weight:700; margin-top:7px; color:#e8eef5; }}
</style>
<div class="wrap"><h1>BULWARK RESOURCES</h1><div class="sub">36 inventory icons · 9 planets × 4 tiers · save each as content/icons/resources/&lt;id&gt;.png</div>
<div class="grid">{head}{"".join(cells)}</div></div>'''
open(os.path.join(HERE, "sheet.html"), "w").write(sheet)
