#!/usr/bin/env python3
"""extract_missions.py — Bulwark-Missions.xlsx -> content/missions/missions.json
[MM-story_mvys6jex_k] [MM-story_mvzkd2t8_1k] [MM-story_mvzkd148_1j] [MM-story_mvzkdvrl_1l]

The Missions workbook is the CONTENT source for the Mission Log (epic MLG). Like extract_mapdata.py, design lives
in docs/sources and the game consumes a generated JSON — re-run after any workbook edit:

    python tools/extract_missions.py

Owner flow (2026-11-02): one PRIMARY per planet × map; an optional SECONDARY per planet × map in a Light and a
Shadow version chosen by alignment history, unlocked by a replay that beats the best result; gates by level,
alignment and tech node; capital ships grant missions and collect rewards; linked missions form QUEST LINES;
missions unlock tech nodes, which must still be bought.

The extractor turns the Missions columns into the VIEW and UNLOCK stages (the Requirements sheet holds EXECUTE,
COMPLETE and FAIL) and refuses anything inconsistent: unknown conditions or reward kinds, a condition in a stage
it is not allowed in, a missing objective, an unknown giver, a gate node that is not in the tech tree, a node
unlocked by two missions, or a quest line with a gap in its steps. Only input columns are read (no formula
results), so the workbook does not need recalculating first. Missions with Status "Cut" are skipped.
"""
import json
import os
import sys

try:
    import openpyxl
except ImportError:
    sys.exit("pip install openpyxl")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, "docs", "sources", "Bulwark-Missions.xlsx")
MAP_XLSX = os.path.join(ROOT, "docs", "sources", "Bulwark-Map-Data.xlsx")   # Outpost_Contracts + Ores (outpost missions)
FORGE = os.path.join(ROOT, "prototype", "test-game", "content", "maps", "forge")
# The outpost contracts' conditions (Outpost tech plan §5.2) [MM-story_mw5oe8km_k]: read from the save, not a battle.
OUTPOST_CONDS = {
    "outpost_online": {"stages": ["Unlock", "Complete"], "tier": "A"},
    "ore_sold": {"stages": ["Unlock", "Complete"], "tier": "A"},
    "raids_held": {"stages": ["Unlock", "Complete"], "tier": "A"},
    "outpost_contract_step": {"stages": ["View", "Unlock"], "tier": "A"},
}
OUT = os.path.join(ROOT, "prototype", "test-game", "content", "missions", "missions.json")
STAGES = ("View", "Unlock", "Execute", "Complete", "Fail")
LANDING = "Landing craft BS-7"
COLLECTIVE = "(Collective)"   # Capital_Ships row for the Collective ship: always present, handles maps 1-3


def norm(v):
    if isinstance(v, float) and v.is_integer():
        return int(v)
    if isinstance(v, str):
        v = v.strip()
        return None if v in ("", "—") else v
    return v


def rows(ws, ncols):
    head = [c.value for c in ws[1]][:ncols]
    for r in ws.iter_rows(min_row=2, max_col=ncols, values_only=True):
        if r[0] is None or str(r[0]).strip() == "":
            continue
        yield dict(zip(head, (norm(v) for v in r)))


def sheet_from(ws, probe):
    """Rows of a map-data sheet whose header row starts with `probe` (those sheets carry a title and a note first)."""
    it = ws.iter_rows(values_only=True)
    for head in it:
        if head and head[0] == probe:
            break
    else:
        return []
    out = []
    for r in it:
        if r[0] is None or str(r[0]).strip() == "":
            continue
        out.append(dict(zip(head, (norm(v) for v in r))))
    return out


def outpost_missions(ships, givers, problems):
    """
    The outpost contracts as missions (Outpost tech plan §5.2): one per planet × step from the map-data workbook's
    Outpost_Contracts, quest line QL-<PLA>-O, granted and collected aboard the planet's capital ship. A planet's contracts
    are written only once its outpost map exists (content/maps/forge/<planet key>-outpost.json), so a planet is never
    offered an outpost it has no ground for. → (missions, quest lines).
    """
    wb = openpyxl.load_workbook(MAP_XLSX, data_only=True)
    ores = sheet_from(wb["Ores"], "Planet_Key")
    contracts = sheet_from(wb["Outpost_Contracts"], "Planet_Key")
    missions, lines = [], {}
    for c in contracts:
        key, step = c["Planet_Key"], c["Step"]
        if not os.path.exists(os.path.join(FORGE, f"{key}-outpost.json")):
            continue
        ore = next((o for o in ores if o["Planet_Key"] == key and o["Tier"] == c["Ore_Tier"]), None)
        if not ore:
            problems.append(f"Outpost_Contracts {key} step {step}: no {c['Ore_Tier']} ore on the Ores sheet")
            continue
        planet = ore["Planet"]
        ship = ships.get(planet)
        if not ship:
            problems.append(f"Outpost_Contracts {key}: {planet} has no capital ship on Capital_Ships")
            continue
        g = givers.get(ship["captain"])
        if not g:
            problems.append(f"Outpost_Contracts {key}: captain {ship['captain']!r} is not on the Givers sheet")
        abbr = planet[:3].upper()
        ql = f"QL-{abbr}-O"
        lines[ql] = {"name": f"{planet} outpost", "planet": planet, "role": "Primary", "variant": None, "ship": ship["ship"]}
        complete = []
        if step == 1:
            complete.append({"cond": "outpost_online", "param": key, "op": "≥", "value": 1, "text": f"Establish the outpost on {planet}: build power, a mining station on the {ore['Ore'].lower()} and storage, all powered"})
        complete.append({"cond": "ore_sold", "param": ore["Ore_Id"], "op": "≥", "value": c["Deliver"], "text": f"Deliver {c['Deliver']} {ore['Ore']} to {ship['ship']}"})
        if c["Raids_Held"]:
            n = c["Raids_Held"]
            complete.append({"cond": "raids_held", "param": key, "op": "≥", "value": n, "text": "Hold the outpost through a raid" if n == 1 else f"Hold the outpost through {n} raids"})
        view = [] if step == 1 else [{"cond": "quest_step_collected", "param": ql, "value": step - 1, "text": "The previous contract was collected"}]
        unlock = [{"cond": "capital_ship_arrived", "param": planet, "text": f"{ship['ship']} is in orbit"}]
        rewards = [{"kind": "gold", "amount": c["Gold"], "label": "Gold"}, {"kind": "xp", "amount": c["XP"], "label": "Commander XP"}]
        missions.append({
            "id": f"OC-{abbr}-{step}", "questLine": ql, "step": step, "role": "primary", "variant": None,
            "planet": planet, "map": None, "title": c["Title"], "type": "outpost",
            "giver": {"name": ship["captain"], **(g or {})}, "grantedAt": ship["ship"], "collectAt": ship["ship"],
            "briefing": f"Outpost contract {step} of 3. Run it from OUTPOST on the main menu; every sale pays as it lands.",
            "status": "Draft", "impact": {"loyaltyPlanet": c["Loyalty"]},
            "view": view, "unlock": unlock, "execute": [], "complete": complete, "fail": [], "rewards": rewards,
            "outpost": {"planetKey": key, "unlocks": str(c["Unlocks"] or "").split()},
        })
    return missions, lines


def main():
    wb = openpyxl.load_workbook(XLSX, data_only=False)
    problems = []
    conds = {c["Condition"]: {"stages": [s.strip() for s in (c["Stages"] or "").split(",")], "tier": c["Tier"]} for c in rows(wb["Conditions"], 7)}
    kinds = {k["Kind"]: {"tier": k["Tier"]} for k in rows(wb["Reward_Kinds"], 4)}
    givers = {g["Name"]: {"faction": g["Faction_Key"], "align": g["Align"], "art": g["Portrait_Art"]} for g in rows(wb["Givers"], 9)}
    nodes = {n["Node"]: {"price": n["Gold price (game)"], "cost": [x for x in ((n["Resource cost 1"], n["Qty 1"]), (n["Resource cost 2"], n["Qty 2"])) if x[0]]}
             for n in rows(wb["Tech_Unlocks"], 12)}
    ship_rows = list(rows(wb["Capital_Ships"], 5))
    ships = {s["Planet"]: {"ship": s["Capital ship"], "captain": s["Captain (giver)"], "arrives": s["Arrives when"]} for s in ship_rows if s["Planet"] != COLLECTIVE}
    coll = [s for s in ship_rows if s["Planet"] == COLLECTIVE]
    if len(coll) != 1:
        problems.append("Capital_Ships: needs exactly one (Collective) row")
    collective = {"ship": coll[0]["Capital ship"], "arrives": coll[0]["Arrives when"]} if coll else None
    lines = {q["Quest_Line"]: {"name": q["Name"], "planet": q["Planet"], "role": q["Role"], "variant": q["Variant"], "ship": q["Capital ship"]} for q in rows(wb["Quest_Lines"], 7)}
    resources = [{"id": r["Resource_ID"], "name": r["Name"], "tier": r["Tier"].lower(), "planet": r["Planet"], "faction": r["Faction"], "value": r["Gold value"]}
                 for r in rows(wb["Resources"], 6)]
    res_names = {r["name"] for r in resources}

    reqs, rewards = {}, {}
    for i, r in enumerate(rows(wb["Requirements"], 8), 2):
        c = conds.get(r["Condition"])
        if r["Stage"] not in STAGES:
            problems.append(f"Requirements row {i}: unknown stage {r['Stage']!r}")
        elif not c:
            problems.append(f"Requirements row {i}: unknown condition {r['Condition']!r}")
        elif r["Stage"] not in c["stages"]:
            problems.append(f"Requirements row {i}: {r['Condition']} is not allowed in stage {r['Stage']}")
        item = {"cond": r["Condition"], "text": r["Player-facing text"]}
        for src, out in (("Param", "param"), ("Op", "op"), ("Value", "value")):
            if r[src] is not None:
                item[out] = r[src]
        if r["Bonus"] == "Y":
            item["bonus"] = True
        reqs.setdefault(r["Mission_ID"], {s: [] for s in STAGES})[r["Stage"]].append(item)
    unlocked_by = {}
    for i, w in enumerate(rows(wb["Rewards"], 5), 2):
        if w["Kind"] not in kinds:
            problems.append(f"Rewards row {i}: unknown kind {w['Kind']!r}")
        if w["Kind"] == "tech_unlock":
            if w["Target"] not in nodes:
                problems.append(f"Rewards row {i}: node {w['Target']!r} is not in the tech tree")
            elif w["Target"] in unlocked_by:
                problems.append(f"Rewards row {i}: node {w['Target']} is already unlocked by {unlocked_by[w['Target']]}")
            unlocked_by[w["Target"]] = w["Mission_ID"]
        if w["Kind"] == "resource" and w["Target"] not in res_names:
            problems.append(f"Rewards row {i}: resource {w['Target']!r} is not on the Resources sheet")
        item = {"kind": w["Kind"], "amount": w["Amount"], "label": w["Player-facing label"]}
        if w["Target"] is not None:
            item["target"] = w["Target"]
        rewards.setdefault(w["Mission_ID"], []).append(item)

    missions, seen, steps = [], set(), {}
    for i, m in enumerate(rows(wb["Missions"], 27), 2):
        mid = m["Mission_ID"]
        if mid in seen:
            problems.append(f"Missions row {i}: duplicate id {mid}")
        seen.add(mid)
        if m["Status"] == "Cut":
            continue
        g = givers.get(m["Giver"])
        if not g:
            problems.append(f"Missions row {i}: giver {m['Giver']!r} not on the Givers sheet")
        if m["Quest_Line"] not in lines:
            problems.append(f"Missions row {i}: quest line {m['Quest_Line']!r} not on the Quest_Lines sheet")
        if m["Gate_Tech_Node"] and m["Gate_Tech_Node"] not in nodes:
            problems.append(f"Missions row {i}: gate node {m['Gate_Tech_Node']!r} is not in the tech tree")
        st = reqs.get(mid, {s: [] for s in STAGES})
        if not st["Complete"]:
            problems.append(f"Missions row {i}: {mid} has no Complete requirement")
        steps.setdefault((m["Quest_Line"], m["Variant"]), []).append(m["Step"])
        P, ship = m["Planet"], m["Granted_At"]

        # VIEW: the quest line reached this step, and the alignment band of the variant
        view = list(st["View"])
        if m["Step"] and m["Step"] > 1:
            # either variant of the previous step counts, so an alignment flip never strands a line
            view.append({"cond": "quest_step_collected", "param": m["Quest_Line"], "value": m["Step"] - 1, "text": "The previous step was collected"})
        # UNLOCK: gates + trigger + capital ship in orbit
        unlock = list(st["Unlock"])
        if m["Gate_Align_Min"] is not None:
            band = {"cond": "alignment", "op": "≥", "value": m["Gate_Align_Min"], "text": f"Alignment history ≥ {m['Gate_Align_Min']}"}
            view.append(band); unlock.append(band)
        if m["Gate_Align_Max"] is not None:
            band = {"cond": "alignment", "op": "≤", "value": m["Gate_Align_Max"], "text": f"Alignment history ≤ {m['Gate_Align_Max']}"}
            view.append(band); unlock.append(band)
        if m["Gate_Min_Level"]:
            unlock.append({"cond": "rank_at_least", "op": "≥", "value": m["Gate_Min_Level"], "text": f"Commander level {m['Gate_Min_Level']}"})
        if m["Gate_Tech_Node"]:
            unlock.append({"cond": "tech_node", "param": m["Gate_Tech_Node"], "text": "Own the tech node " + m["Gate_Tech_Node"]})
        trig = m["Unlock_Trigger"]
        if trig == "planet_open":
            unlock.append({"cond": "planet_open", "param": P, "text": f"{P} is open"})
        elif trig == "replay_improves":
            unlock.append({"cond": "replay_improves", "param": P, "value": m["Map"], "text": f"Replay {P} map {m['Map']} and beat your best stars"})
        if ship and ship != LANDING and not (collective and ship == collective["ship"]):
            unlock.append({"cond": "capital_ship_arrived", "param": P, "text": f"{ship} is in orbit"})
        impact = {k: m[c] for k, c in (("loyaltyPlanet", "Loyalty_Planet"), ("loyaltyRival", "Loyalty_Rival"), ("alignment", "Alignment_Shift"), ("brokenPenalty", "Broken_Penalty")) if m[c] is not None}
        missions.append({
            "id": mid, "questLine": m["Quest_Line"], "step": m["Step"], "role": m["Role"].lower(), "variant": (m["Variant"] or "").lower() or None,
            "planet": P, "map": m["Map"], "title": m["Title"], "type": (m["Type"] or "").lower(),
            "giver": {"name": m["Giver"], **(g or {})}, "grantedAt": ship, "collectAt": m["Collect_At"],
            "briefing": m["Briefing"], "status": m["Status"], "impact": impact,
            "view": view, "unlock": unlock, "execute": st["Execute"], "complete": st["Complete"], "fail": st["Fail"],
            "rewards": rewards.get(mid, []),
        })
    om, olines = outpost_missions(ships, givers, problems)
    for m in om:
        if m["id"] in seen:
            problems.append(f"outpost mission {m['id']} duplicates a Missions row")
    missions += om
    lines.update(olines)
    # the Outpost tech nodes (story O10) are unlocked by the outpost contracts, not by a tech_unlock reward: a node's
    # mission is the first contract step (campaign order) whose Unlocks name it; gold still buys it (tech plan D7)
    for m in om:
        for u in m["outpost"]["unlocks"]:
            if u.startswith("tech:") and u[5:] not in unlocked_by:
                if u[5:] not in nodes:
                    problems.append(f"{m['id']}: unlocks tech {u[5:]}, which is not on Tech_Unlocks")
                else:
                    unlocked_by[u[5:]] = m["id"]
    conds.update(OUTPOST_CONDS)
    for (ql, var), ss in steps.items():   # each variant of a line must cover steps 1..n once
        if sorted(ss) != list(range(1, len(ss) + 1)):
            problems.append(f"quest line {ql} ({var or 'primary'}): steps {sorted(ss)} are not 1..{len(ss)}")
    for mid in set(reqs) | set(rewards):
        if mid not in seen:
            problems.append(f"rows reference mission {mid}, which is not on the Missions sheet")

    if problems:
        print("\n".join(problems[:60]), file=sys.stderr)
        sys.exit(f"{len(problems)} problem(s) — nothing written")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    data = {"_source": "docs/sources/Bulwark-Missions.xlsx", "_generator": "tools/extract_missions.py",
            "capitalShips": ships, "collective": collective, "questLines": lines, "resources": resources,
            "techUnlocks": {n: {"by": unlocked_by.get(n), **nodes[n]} for n in nodes},
            "conditions": conds, "rewardKinds": kinds, "missions": missions}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    roles = {r: sum(1 for m in missions if m["role"] == r) for r in ("primary", "secondary")}
    print(f"wrote {os.path.relpath(OUT, ROOT)}: {len(missions)} missions ({roles['primary']} primary, {roles['secondary']} secondary), "
          f"{len(lines)} quest lines, {len(ships)} capital ships, {len(resources)} resources, {len(unlocked_by)} tech unlocks")


if __name__ == "__main__":
    main()
