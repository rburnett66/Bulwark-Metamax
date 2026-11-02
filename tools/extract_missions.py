#!/usr/bin/env python3
"""extract_missions.py — Bulwark-Missions.xlsx -> content/missions/missions.json   [MM-story_mvys6jex_k]

The Missions workbook is the CONTENT source for the Mission Log (epic MLG). Like extract_mapdata.py,
design lives in docs/sources and the game consumes a generated JSON — re-run after any workbook edit:

    python tools/extract_missions.py

Requires openpyxl. Only input columns are read (no formula results), so the workbook does not need
recalculating first. Missions with Status "Cut" are skipped. Every requirement is checked against the
Conditions sheet (known condition, allowed in its stage) and every reward against Reward_Kinds; the
script exits non-zero on any problem so a broken sheet never reaches the game.
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
TIERS = "ABCD"


def norm(v):
    if isinstance(v, float) and v.is_integer():
        return int(v)
    if isinstance(v, str):
        v = v.strip()
        return v or None
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

    conds = {}
    for c in rows(wb["Conditions"], 8):
        conds[c["Condition"]] = {"stages": [s.strip() for s in (c["Stages"] or "").split(",")], "tier": c["Tier"],
                                 "param": c["Param"], "value": c["Value"], "means": c["Meaning"]}
    kinds = {k["Kind"]: {"tier": k["Tier"], "means": k["Meaning"]} for k in rows(wb["Reward_Kinds"], 4)}
    givers = {g["Name"]: {"faction": g["Faction_Key"], "align": g["Align"], "art": g["Portrait_Art"]} for g in rows(wb["Givers"], 9)}

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
        for k_src, k_out in (("Param", "param"), ("Op", "op"), ("Value", "value")):
            if r[k_src] is not None:
                item[k_out] = r[k_src]
        if r["Bonus"] == "Y":
            item["bonus"] = True
        reqs.setdefault(r["Mission_ID"], {s: [] for s in STAGES})[r["Stage"]].append(item)
    for i, w in enumerate(rows(wb["Rewards"], 5), 2):
        if w["Kind"] not in kinds:
            problems.append(f"Rewards row {i}: unknown kind {w['Kind']!r}")
        item = {"kind": w["Kind"], "amount": w["Amount"], "label": w["Player-facing label"]}
        if w["Target"] is not None:
            item["target"] = w["Target"]
        rewards.setdefault(w["Mission_ID"], []).append(item)

    missions, seen = [], set()
    for i, m in enumerate(rows(wb["Missions"], 12), 2):
        mid = m["Mission_ID"]
        if mid in seen:
            problems.append(f"Missions row {i}: duplicate id {mid}")
        seen.add(mid)
        if m["Status"] == "Cut":
            continue
        g = givers.get(m["Giver"])
        if not g:
            problems.append(f"Missions row {i}: giver {m['Giver']!r} not on the Givers sheet")
        st = reqs.get(mid, {s: [] for s in STAGES})
        if not st["Complete"]:
            problems.append(f"Missions row {i}: {mid} has no Complete requirement")
        rw = rewards.get(mid, [])
        tier = max([TIERS.index(conds[q["cond"]]["tier"]) for s in STAGES for q in st[s] if q["cond"] in conds] +
                   [TIERS.index(kinds[w["kind"]]["tier"]) for w in rw if w["kind"] in kinds] + [0])
        missions.append({
            "id": mid, "title": m["Title"], "type": m["Type"].lower(), "planet": m["Planet"], "map": m["Map"],
            "giver": {"name": m["Giver"], **(g or {})}, "briefing": m["Briefing (giver’s words)"],
            "repeatable": m["Repeatable"] == "Y", "status": m["Status"], "tier": TIERS[tier],
            "view": st["View"], "unlock": st["Unlock"], "execute": st["Execute"], "complete": st["Complete"], "fail": st["Fail"],
            "rewards": rw,
        })
    for mid in set(reqs) | set(rewards):
        if mid not in seen:
            problems.append(f"rows reference mission {mid}, which is not on the Missions sheet")

    if problems:
        print("\n".join(problems), file=sys.stderr)
        sys.exit(f"{len(problems)} problem(s) — nothing written")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    data = {"_source": "docs/sources/Bulwark-Missions.xlsx", "_generator": "tools/extract_missions.py",
            "conditions": {k: {"stages": v["stages"], "tier": v["tier"]} for k, v in conds.items()},
            "rewardKinds": {k: {"tier": v["tier"]} for k, v in kinds.items()},
            "missions": missions}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
        f.write("\n")
    by = {t: sum(1 for m in missions if m["tier"] == t) for t in TIERS}
    print(f"wrote {os.path.relpath(OUT, ROOT)}: {len(missions)} missions (tier A {by['A']}, B {by['B']}, C {by['C']}, D {by['D']})")


if __name__ == "__main__":
    main()
