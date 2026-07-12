#!/usr/bin/env python3
"""extract_dialog.py — regenerate content/dialog/voicepacks.json from the dialog-system design doc.

Source of truth: bulwark-dialog-system.md (§10 character voice packs, all 81 heroes).
Same rule as tools/extract_balance.py: content stays canonical in the doc, never hand-edited
in JSON. Re-run after every doc update:

    python tools/extract_dialog.py "path/to/bulwark-dialog-system.md"

Parses per character: alignment, name, motivation, drama tags, signature phrases, and the
signature lines (M0 challenge / win-efficient / win-close / defeat / reward+motive).
Gender is inferred from the voice-profile prose (she/he), neutral when unclear — it drives
the procedural voice's pitch register (src/comm/voice.js). Intent is inferred from the
line's terminal punctuation (! → exclaim, … → trail, ? → question, else statement).
"""
import json
import os
import re
import sys

SRC = sys.argv[1] if len(sys.argv) > 1 else None
if not SRC or not os.path.exists(SRC):
    sys.exit("usage: python tools/extract_dialog.py <bulwark-dialog-system.md>")

OUT = os.path.join(os.path.dirname(__file__), "..", "content", "dialog", "voicepacks.json")

FACTION_KEY = {
    "Ground / Powder": "ground", "Air": "air", "High Tech": "hightech", "Artillery": "artillery",
    "Water": "water", "Arcane / Energy": "arcane", "Space Tech": "space", "Dark Energy": "dark",
    "Greenies (Chem)": "greenies",
}
LINE_KEYS = {   # doc bullet label (lowercased, pre-colon) -> json key
    "m0 challenge": "m0",
    "win (efficient)": "winEfficient",
    "win (close shave)": "winClose",
    "your defeat": "defeat",
}

def infer_gender(profile):
    fem = len(re.findall(r"\b(she|her|hers|herself)\b", profile, re.I))
    masc = len(re.findall(r"\b(he|him|his|himself)\b", profile, re.I))
    if fem > masc: return "female"
    if masc > fem: return "male"
    return "neutral"

def infer_intent(line):
    s = line.rstrip('"” ')
    if s.endswith("!"): return "exclaim"
    if s.endswith("…") or s.endswith("..."): return "trail"
    if s.endswith("?"): return "question"
    return "statement"

text = open(SRC, encoding="utf-8").read()

factions = {}
cur_fac = None
cur_char = None
in_lines = False

for raw in text.splitlines():
    line = raw.strip()
    m = re.match(r"^### 10\.\d ([^—]+) — \*(.+)\*$", line)
    if m:
        name = m.group(1).strip()
        key = FACTION_KEY.get(name)
        if not key:
            sys.exit(f"unknown faction section: {name!r}")
        cur_fac = {"name": name, "trope": m.group(2).strip(), "characters": []}
        factions[key] = cur_fac
        cur_char = None
        continue
    if line.startswith("## ") and cur_fac and not line.startswith("## 10"):
        cur_fac = None          # left §10 — stop consuming (e.g. §11 validation)
        cur_char = None
        continue
    m = re.match(r'^##### (\w+) · (.+?) — \*"(.+)"\*\s*((?:\[\w+\])*)\s*$', line)
    if m and cur_fac is not None:
        cur_char = {
            "align": m.group(1), "name": m.group(2).strip(), "motivation": m.group(3).strip(),
            "tags": re.findall(r"\[(\w+)\]", m.group(4) or ""),
            "gender": "neutral", "phrases": [], "lines": {},
        }
        cur_fac["characters"].append(cur_char)
        in_lines = False
        continue
    if cur_char is None:
        continue
    if line.startswith("**Voice profile:**"):
        cur_char["gender"] = infer_gender(line)
        continue
    if line.startswith("**Signature phrases:**"):
        cur_char["phrases"] = re.findall(r'"([^"]+)"', line)
        continue
    if line.startswith("**Signature lines:**"):
        in_lines = True
        continue
    if in_lines:
        m = re.match(r"^- \*(.+?):\*\s*\"(.+)\"$", line)
        if not m:
            if line and not line.startswith("-"):
                in_lines = False
            continue
        label, spoken = m.group(1).strip(), m.group(2).strip()
        key = LINE_KEYS.get(label.lower())
        entry = {"line": spoken, "intent": infer_intent(spoken)}
        if key:
            cur_char["lines"][key] = entry
        else:
            rm = re.match(r"^Reward \((.+)\)$", label)
            if rm:
                entry["motive"] = rm.group(1)
                cur_char["lines"]["reward"] = entry
            # anything else (drama-thread beats etc.) is ignored for now

# ---- validation (§11 signature audit: every character has M0 + DEFEAT) ----
errors = []
total = 0
for key, fac in factions.items():
    if len(fac["characters"]) != 9:
        errors.append(f"{key}: {len(fac['characters'])} characters (expected 9)")
    aligns = [c["align"] for c in fac["characters"]]
    if len(set(aligns)) != len(aligns):
        errors.append(f"{key}: duplicate alignments {aligns}")
    if "PE" not in aligns:
        errors.append(f"{key}: no PE champion")
    for c in fac["characters"]:
        total += 1
        for req in ("m0", "defeat"):
            if req not in c["lines"]:
                errors.append(f"{key}/{c['align']} {c['name']}: missing {req} line")
if len(factions) != 9:
    errors.append(f"{len(factions)} factions parsed (expected 9)")
if errors:
    sys.exit("EXTRACTION FAILED:\n  " + "\n  ".join(errors))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
data = {
    "source": os.path.basename(SRC),
    "docVersion": (re.search(r"\*\*Version:\*\* ([\d.]+)", text) or [None, "?"])[1],
    "note": "GENERATED by tools/extract_dialog.py — edit the design doc, not this file.",
    "factions": factions,
}
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=1, ensure_ascii=False)
print(f"OK: {total} characters across {len(factions)} factions -> {os.path.normpath(OUT)}")
for key, fac in factions.items():
    n_reward = sum(1 for c in fac["characters"] if "reward" in c["lines"])
    print(f"  {key:10s} {len(fac['characters'])} chars, {n_reward} reward lines")
