#!/usr/bin/env python3
"""extract_mapdata.py — Bulwark-Map-Data.xlsx -> content/maps/mapdata.json

The Map Design GDD's companion workbook is the VALUES source (the GDD holds the rules).
This mirrors tools/extract_dialog.py: design lives in docs/sources, the game consumes a
generated JSON — re-run after any workbook edit:

    python tools/extract_mapdata.py

Requires openpyxl. Formula cells are read as their last-computed values (data_only), so
open+save the workbook in Excel after changing inputs, or the derived sheets go stale.
"""
import json
import os
import sys

try:
    import openpyxl
except ImportError:
    sys.exit("pip install openpyxl")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, "docs", "sources", "Bulwark-Map-Data.xlsx")
OUT = os.path.join(ROOT, "prototype", "test-game", "content", "maps", "mapdata.json")


def norm(v):
    """Excel loves floats; the game wants ints where they are ints."""
    if isinstance(v, float) and v.is_integer():
        return int(v)
    if isinstance(v, str):
        s = v.strip()
        if s in ("Yes", "yes"):
            return True
        if s in ("No", "no"):
            return False
        return s
    return v


def _is_int(v):
    return isinstance(v, (int, float)) and float(v).is_integer()


def sheet_rows(ws, key_ok, header_row_probe=("Map_ID", "Wave", "Param", "Star", "Faction_ID",
                                             "Resource", "Level", "Faction", "Map", "Outcome", "Planet_Key")):
    """Find the header row (first cell matches a known header), then yield dicts for every row whose
    KEY cell passes `key_ok` — the sheets carry titles above and prose notes below the data block."""
    rows = list(ws.iter_rows(values_only=True))
    hdr_i = None
    for i, r in enumerate(rows):
        if r and str(r[0]).strip() in header_row_probe:
            hdr_i = i
            break
    if hdr_i is None:
        return []
    headers = [str(h).strip() if h is not None else f"col{j}" for j, h in enumerate(rows[hdr_i])]
    out = []
    for r in rows[hdr_i + 1:]:
        if r is None or r[0] is None or not key_ok(r[0]):
            continue
        d = {}
        for h, v in zip(headers, r):
            if h and not h.startswith("col"):
                d[h] = norm(v)
        out.append(d)
    return out


def params_map(ws):
    """Global_Params: Param/Value/Unit/Notes -> {param: value} (section headers skipped)."""
    out = {}
    for row in sheet_rows(ws, key_ok=lambda v: isinstance(v, str) and v.strip() and not v.isupper(),
                          header_row_probe=("Param",)):
        p, v = row.get("Param"), row.get("Value")
        if p and v is not None:
            out[str(p).strip()] = norm(v)
    return out


# ── MAP-SIZE REWORK (owner, 2026-07-13, rev 2): the whole map is playable from wave 1 (open play),
# so these are the true per-map play areas. Owner specified maps 1-3 (24x16, 30x18, 34x20); the rest
# complete the pattern (width alternates +6/+4, height +2 per map) landing exactly on 64x32 at map 9.
# Lives here rather than in the workbook because openpyxl cannot recompute the derived sheets — fold
# these into the Maps sheet in Excel when convenient (values here win until then).
REWORK_DIMS = {1: (24, 16), 2: (30, 18), 3: (34, 20), 4: (40, 22), 5: (44, 24),
               6: (50, 26), 7: (54, 28), 8: (60, 30), 9: (64, 32)}


def playable_dims(full_w, full_h, fracs):
    """Per-wave playable dims from the growth curve, honoring the GDD's hard rules (§3.1-3.2):
    every wave adds real area (≥2 tiles on an axis), rings never shrink, wave 8 = the full map,
    waves 1-7 always leave something to reveal. Even-rounded so concentric rects stay centered."""
    dims = []
    for i, f in enumerate(fracs):
        w = max(8, 2 * round(full_w * f / 2))
        h = max(6, 2 * round(full_h * f / 2))
        if i:
            pw, ph = dims[-1]
            w, h = max(w, pw), max(h, ph)
            if w < pw + 2 and h < ph + 2:          # no real growth — force the width rule
                if pw + 2 <= full_w:
                    w = pw + 2
                elif ph + 2 <= full_h:
                    h = ph + 2
        w, h = min(w, full_w), min(h, full_h)
        if i < 7 and w >= full_w and h >= full_h:  # waves 1-7 must leave wave 8 a reveal
            w = full_w - 2
        dims.append((w, h))
    dims[7] = (full_w, full_h)                     # wave 8: exactly the full map, no remainder
    return dims


def apply_rework(data):
    gp = data["globalParams"]
    # Owner tuning history: regrow rate halved (75s -> 150s), then reduced another 75%
    # (150s -> 600s). Net: primaries regrow at 1/8 the workbook rate — big merged fields can
    # no longer sustain a perpetual farm ahead of the story-4 time bonus.
    gp["Primary_Respawn_Sec"] = round((gp.get("Primary_Respawn_Sec") or 75) * 8)
    setback = gp.get("Spawn_Setback", 2)
    per100 = gp.get("Par_Time_Per_100_Tiles", 42)
    waves_per_map = gp.get("Waves_Per_Map", 8)
    fracs = [g["Linear_Fraction"] for g in sorted(data["growthCurve"], key=lambda g: g["Wave"])]
    by_map = {}
    for m in data["maps"]:
        w, h = REWORK_DIMS.get(m["Map_ID"], (m["Full_W"], m["Full_H"]))
        m["Full_W"], m["Full_H"] = w, h
        m["Full_Area"] = w * h
        m["Par_Time_Sec"] = round(per100 * m["Full_Area"] / 100 * waves_per_map)
        by_map[m["Map_ID"]] = m
    # recompute the dims-derived Wave_Table columns; budgets / sides / node counts stay authored
    for m in data["maps"]:
        dims = playable_dims(m["Full_W"], m["Full_H"], fracs)
        rows = sorted([r for r in data["waveTable"] if r["Map_ID"] == m["Map_ID"]], key=lambda r: r["Wave"])
        prev_area = 0
        for r, (pw, ph) in zip(rows, dims):
            r["Playable_W"], r["Playable_H"] = pw, ph
            r["Playable_Area"] = pw * ph
            r["Ring_Area_Added"] = pw * ph - prev_area
            prev_area = pw * ph
            r["Spawn_Dist_X"] = pw // 2 + setback
            r["Spawn_Dist_Y"] = ph // 2 + setback
            r["Wave_Par_Sec"] = max(15, round(per100 * pw * ph / 100))
    return data


OUTPOST_KINDS = {"hub", "power", "rig", "storage", "harvesterBay", "upgradeBay", "mg", "cannon", "wall"}
RIG_HEADS = {"auger", "laser", "brine", "crystal", "bore", "shielded"}
# Owner: outposts have no anti-air and no long range. The battle structures an outpost may use; their stats (range
# within 5, ground targets) are checked against STRUCTURES by src/data/outpost.test.mjs.
OUTPOST_BATTLE_STRUCTS = {"STR-MG", "STR-Cannon", "STR-Wall"}
OUTPOST_PARAMS = ("Load_Sec", "Store_Hours", "Deep_Rate_Mult", "Deep_Price_Mult", "Raid_Mean_Hours",
                  "Raid_Min_Gap_Hours", "Breach_Storage_Loss", "First_Raid_Sec", "Away_Cap_Hours", "Replay_Keep",
                  "Far_Buyer_Mult", "Far_Loyalty_Cost", "Defense_Price_Mult", "Repair_Share_Per_HP", "Shuttle_II_Bonus")


def outpost_problems(data):
    """The outpost sheets' rules (tech plan Outpost §3.1). Returns a list of problems."""
    out = []
    ores, planets = data["ores"], {r["Planet_Key"] for r in data["rareContracts"]}
    if len(ores) != 27:
        out.append(f"Ores: expected 27 rows (9 planets x 3 tiers), got {len(ores)}")
    for key in planets:
        tiers = sorted(r.get("Tier") for r in ores if r.get("Planet_Key") == key)
        if tiers != ["common", "rare", "uncommon"]:
            out.append(f"Ores {key}: expected exactly one common, uncommon and rare ore, got {tiers}")
        heads = [r.get("Rig_Head") for r in ores if r.get("Planet_Key") == key]
        if len(set(heads)) != len(heads):
            out.append(f"Ores {key}: two ores share a rig head (design 8.4: three different rigs per outpost)")
    ids = [r.get("Ore_Id") for r in ores]
    for d in sorted({i for i in ids if ids.count(i) > 1}):
        out.append(f"Ores: duplicate Ore_Id {d}")
    wanters = []
    for r in ores:
        tag = f"Ores {r.get('Planet_Key')} {r.get('Ore')}"
        if r.get("Planet_Key") not in planets:
            out.append(f"{tag}: unknown Planet_Key")
        if not all(isinstance(r.get(k), (int, float)) and r[k] > 0 for k in ("Rate_Per_Min", "Price", "Deep_Rate_Mult", "Deep_Price_Mult")):
            out.append(f"{tag}: Rate_Per_Min, Price and the deep multipliers must be positive")
        if r.get("Rig_Head") not in RIG_HEADS:
            out.append(f"{tag}: Rig_Head {r.get('Rig_Head')!r} is not one of {sorted(RIG_HEADS)}")
        w = r.get("Wanted_By") or ""
        if w:
            if r.get("Tier") != "rare":
                out.append(f"{tag}: only rare ores have a far buyer (design 8.5)")
            if w not in planets or w == r.get("Planet_Key"):
                out.append(f"{tag}: Wanted_By {w!r} must be another planet's key")
            wanters.append(w)
    for w in sorted({w for w in wanters if wanters.count(w) > 1}):
        out.append(f"Ores: faction {w} wants more than one rare ore (design 8.5: one want per faction)")
    seen = set()
    for r in data["outpostStructures"]:
        tag = f"Outpost_Structures {r.get('Kind')} tier {r.get('Tier')}"
        if r.get("Kind") not in OUTPOST_KINDS:
            out.append(f"{tag}: unknown kind (the code knows {sorted(OUTPOST_KINDS)})")
        if (r.get("Kind"), r.get("Tier")) in seen:
            out.append(f"{tag}: duplicate row")
        seen.add((r.get("Kind"), r.get("Tier")))
        bs = r.get("Battle_Struct") or ""
        if r.get("Kind") in ("mg", "cannon", "wall") and bs not in OUTPOST_BATTLE_STRUCTS:
            out.append(f"{tag}: Battle_Struct {bs!r} is not an outpost defense (no anti-air, no long range)")
        if bs and r.get("Kind") not in ("mg", "cannon", "wall"):
            out.append(f"{tag}: only defenses take a Battle_Struct")
    for k in ("hub", "power", "rig", "storage", "mg", "cannon", "wall"):
        if (k, 1) not in seen:
            out.append(f"Outpost_Structures: the kit needs {k} tier 1")
    for key in planets:
        rows = sorted((r for r in data["outpostContracts"] if r.get("Planet_Key") == key), key=lambda r: r.get("Step", 0))
        if [r.get("Step") for r in rows] != [1, 2, 3]:
            out.append(f"Outpost_Contracts {key}: expected steps 1, 2, 3")
            continue
        unlocked = {"common"}
        for r in rows:
            if r.get("Ore_Tier") not in unlocked:
                out.append(f"Outpost_Contracts {key} step {r['Step']}: delivers {r.get('Ore_Tier')} ore before it is unlocked")
            if not (isinstance(r.get("Deliver"), int) and r["Deliver"] > 0):
                out.append(f"Outpost_Contracts {key} step {r['Step']}: Deliver must be a positive whole number")
            unlocked |= {u.split(":", 1)[1] for u in str(r.get("Unlocks") or "").split() if u.startswith("ore:")}
    for p in OUTPOST_PARAMS:
        if not isinstance(data["outpostParams"].get(p), (int, float)):
            out.append(f"Outpost_Params: missing or non-numeric {p}")
    return out


def main():
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    data = {
        "_source": "docs/sources/Bulwark-Map-Data.xlsx",
        "_gdd": "docs/sources/Bulwark-Map-GDD.md.docx (v1.2 — rules win over values)",
        "globalParams": params_map(wb["Global_Params"]),
        "growthCurve": sheet_rows(wb["Growth_Curve"], _is_int),
        "maps": sheet_rows(wb["Maps"], _is_int),
        "factions": sheet_rows(wb["Factions"], _is_int),
        "resources": sheet_rows(wb["Resources"], lambda v: v in ("Flowers", "Crystals", "Minerals")),
        "harvesterUpgrades": sheet_rows(wb["Harvester_Upgrades"], _is_int),
        "starRubric": sheet_rows(wb["Star_Rubric"], _is_int),
        "waveTable": sheet_rows(wb["Wave_Table"], _is_int),
        "resourceRoles": sheet_rows(wb["Resource_Roles"], lambda v: isinstance(v, str) and v.startswith("Map_")),
        "techTree": sheet_rows(wb["Tech_Tree"], lambda v: isinstance(v, str) and v.startswith("Faction_")),
        "questContract": sheet_rows(wb["Quest_Contract"], lambda v: isinstance(v, str) and (v.startswith("ACCEPT") or v.startswith("DECLINE"))),
        # the Collective's contracts, one per planet × map, common and uncommon only [MM-story_mw4a1o3p_m]
        "collectiveContracts": sheet_rows(wb["Collective_Contracts"], lambda v: isinstance(v, str) and v.isidentifier(),
                                          header_row_probe=("Planet_Key",)),
        # the optional in-battle rare contracts, one per planet × map [MM-task_mw5h8fxu_d]
        "rareContracts": sheet_rows(wb["Rare_Contracts"], lambda v: isinstance(v, str) and v.isidentifier(),
                                    header_row_probe=("Planet_Key",)),
        # outposts and mining: ores, buildings, contracts, tuning [MM-story_mw5oe4ap_i] (tech plan Outpost §3.1)
        "ores": sheet_rows(wb["Ores"], lambda v: isinstance(v, str) and v.isidentifier(), header_row_probe=("Planet_Key",)),
        "outpostStructures": sheet_rows(wb["Outpost_Structures"], lambda v: isinstance(v, str) and v.isidentifier(),
                                        header_row_probe=("Kind",)),
        "outpostContracts": sheet_rows(wb["Outpost_Contracts"], lambda v: isinstance(v, str) and v.isidentifier(),
                                       header_row_probe=("Planet_Key",)),
        "outpostParams": params_map(wb["Outpost_Params"]),
    }

    apply_rework(data)

    # ── validations the GDD demands (fail loud, never ship broken data) ──
    problems = []
    if len(data["maps"]) != 9:
        problems.append(f"Maps sheet: expected 9 maps, got {len(data['maps'])}")
    if len(data["waveTable"]) != 72:
        problems.append(f"Wave_Table: expected 72 rows (9 maps x 8 waves), got {len(data['waveTable'])}")
    if len(data["resourceRoles"]) != 81:
        problems.append(f"Resource_Roles: expected 81 pairings, got {len(data['resourceRoles'])}")
    broken = [r for r in data["resourceRoles"] if str(r.get("Valid?", "")).lower() != "ok"]
    if broken:
        problems.append(f"Resource_Roles: {len(broken)} BROKEN pairings (GDD 5.2 requires 0)")
    cc = data["collectiveContracts"]
    if len(cc) != 81 or len({(r.get("Planet_Key"), r.get("Map_ID")) for r in cc}) != 81:
        problems.append(f"Collective_Contracts: expected 81 distinct planet x map rows, got {len(cc)}")
    for r in cc:
        if not all(isinstance(r.get(k), int) and r[k] > 0 for k in ("Common", "Uncommon", "Standing")):
            problems.append(f"Collective_Contracts {r.get('Planet_Key')} map {r.get('Map_ID')}: Common, Uncommon and Standing must be positive")
    rc = data["rareContracts"]
    if len(rc) != 81 or len({(r.get("Planet_Key"), r.get("Map_ID")) for r in rc}) != 81:
        problems.append(f"Rare_Contracts: expected 81 distinct planet x map rows, got {len(rc)}")
    for r in rc:
        if not all(isinstance(r.get(k), int) and r[k] > 0 for k in ("Quota", "Price_Per_Unit", "Loyalty")):
            problems.append(f"Rare_Contracts {r.get('Planet_Key')} map {r.get('Map_ID')}: Quota, Price_Per_Unit and Loyalty must be positive")
        elif r["Quota"] > r.get("Rare_Seeded", 0):
            problems.append(f"Rare_Contracts {r.get('Planet_Key')} map {r.get('Map_ID')}: Quota exceeds the rare units the board seeds")
    problems += outpost_problems(data)
    for f in data["factions"]:
        if f.get("Premium_Secondary") == f.get("Premium_Resource"):
            problems.append(f"{f.get('Faction_Name')}: Premium_Secondary == Premium_Resource (GDD 5.2)")
    # every wave must open a real ring (GDD 3.2)
    for r in data["waveTable"]:
        if r.get("Wave") != 1 and isinstance(r.get("Ring_Area_Added"), (int, float)) and r["Ring_Area_Added"] <= 0:
            problems.append(f"Map {r.get('Map_ID')} wave {r.get('Wave')}: ring adds no tiles (GDD 3.2)")
    if problems:
        for p in problems:
            print("BROKEN:", p)
        sys.exit(1)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=1)
    # ES-module twin so the sim (browser) and node tests import the same data with no fetch/fs split.
    with open(OUT[:-2], "w", encoding="utf-8") as fh:   # .json -> .js
        fh.write("// GENERATED by tools/extract_mapdata.py — edit the workbook, not this file.\n")
        fh.write("export const MAPDATA = ")
        json.dump(data, fh, indent=1)
        fh.write(";\n")
    print(f"OK -> {os.path.relpath(OUT, ROOT)} (+ .js module)")
    print(f"   maps={len(data['maps'])} waveRows={len(data['waveTable'])} roles={len(data['resourceRoles'])} "
          f"factions={len(data['factions'])} params={len(data['globalParams'])} "
          f"collectiveContracts={len(data['collectiveContracts'])} rareContracts={len(data['rareContracts'])}")
    print(f"   ores={len(data['ores'])} outpostStructures={len(data['outpostStructures'])} "
          f"outpostContracts={len(data['outpostContracts'])} outpostParams={len(data['outpostParams'])}")


if __name__ == "__main__":
    main()
