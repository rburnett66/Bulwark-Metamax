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
OUT = os.path.join(ROOT, "prototype", "test-game", "content", "missions", "missions.json")
STAGES = ("View", "Unlock", "Execute", "Complete", "Fail")
LANDING = "Landing craft BS-7"


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


def main():
    wb = openpyxl.load_workbook(XLSX, data_only=False)
    problems = []
    conds = {c["Condition"]: {"stages": [s.strip() for s in (c["Stages"] or "").split(",")], "tier": c["Tier"]} for c in rows(wb["Conditions"], 7)}
    kinds = {k["Kind"]: {"tier": k["Tier"]} for k in rows(wb["Reward_Kinds"], 4)}
    givers = {g["Name"]: {"faction": g["Faction_Key"], "align": g["Align"], "art": g["Portrait_Art"]} for g in rows(wb["Givers"], 9)}
    nodes = {n["Node"]: {"price": n["Gold price (game)"], "cost": [x for x in ((n["Resource cost 1"], n["Qty 1"]), (n["Resource cost 2"], n["Qty 2"])) if x[0]]}
             for n in rows(wb["Tech_Unlocks"], 12)}
    ships = {s["Planet"]: {"ship": s["Capital ship"], "captain": s["Captain (giver)"], "arrives": s["Arrives when"]} for s in rows(wb["Capital_Ships"], 5)}
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
        if ship and ship != LANDING:
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
            "capitalShips": ships, "questLines": lines, "resources": resources,
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
