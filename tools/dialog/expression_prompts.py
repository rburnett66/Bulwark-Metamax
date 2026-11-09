#!/usr/bin/env python3
"""tools/dialog/expression_prompts.py — the prompt sheet for the characters' expression portraits [MM-task_mw9odkf0_4].

Owner 2026-11-09: "We should make additional portraits that show angry, neutral, and happy expressions". The game
draws content/dialog/portraits/<slug>-<angry|neutral|happy>.png by the player's rating with the character
(save/standings.js moodFor) once the slug is listed in src/data/portraitMoods.js, and the plain <slug>.png until then.

Each prompt is an EDIT of the character's existing portrait (attach it as the reference image), so the face, outfit
and framing stay the same and only the expression changes. A character whose base portrait is still a placeholder is
marked: make its final portrait first. The expression wording follows the character's alignment (a good character's
anger is stern, an evil one's is menacing; an evil character's happiness is a smirk).

Writes, from content/dialog/voicepacks.json and content/missions/missions.json (giver art status):
  docs/16 Bulwark MM/create/portrait-expressions/Portrait-Expression-Prompts.md
  docs/16 Bulwark MM/create/portrait-expressions/prompts.json

Run from the repo root:  python tools/dialog/expression_prompts.py
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.join(HERE, '..', '..')
GAME = os.path.join(REPO, 'prototype', 'test-game')
OUT = os.path.join(REPO, 'docs', '16 Bulwark MM', 'create', 'portrait-expressions')

ALIGN_NAME = {'AG': 'absolute good', 'PG': 'principled good', 'G': 'good', 'CG': 'chaotic good', 'N': 'neutral',
              'CE': 'chaotic evil', 'E': 'evil', 'PE': 'principled evil', 'DE': 'dark evil'}
GOOD, EVIL = {'AG', 'PG', 'G', 'CG'}, {'CE', 'E', 'PE', 'DE'}

EXPRESSION = {
    'angry': {
        'good': 'stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin',
        'neutral': 'cold irritation: brows lowered, eyes narrowed, a tight frown, nostrils slightly flared',
        'evil': 'open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward',
    },
    'neutral': {
        'good': 'calm and attentive: relaxed brows, steady direct gaze, mouth at rest',
        'neutral': 'composed and unreadable: relaxed brows, steady gaze, mouth at rest',
        'evil': 'guarded and watchful: level brows, cool appraising gaze, mouth at rest',
    },
    'happy': {
        'good': 'warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted',
        'neutral': 'quiet approval: a small closed-mouth smile, softened eyes',
        'evil': 'satisfied and sly: a crooked smirk, one brow raised, eyes glinting',
    },
}
STYLE = ('Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or '
         'headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial '
         'expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). '
         'No text, no letters, no border.')


def slug(name):
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', name, flags=re.I)).lower()


def family(align):
    return 'good' if align in GOOD else 'evil' if align in EVIL else 'neutral'


def main():
    packs = json.load(open(os.path.join(GAME, 'content', 'dialog', 'voicepacks.json'), encoding='utf-8'))
    missions = json.load(open(os.path.join(GAME, 'content', 'missions', 'missions.json'), encoding='utf-8'))
    art = {}
    for m in missions.get('missions', []):
        g = m.get('giver') or {}
        if g.get('name'):
            art[g['name']] = g.get('art') or art.get(g['name']) or 'Placeholder'
    rows, md = [], []
    md.append('# Character expression portraits (prompts)\n')
    md.append('Owner 2026-11-09: "We should make additional portraits that show angry, neutral, and happy expressions". '
              'Three per character, 243 in all. Each prompt **edits the character\'s existing portrait**: attach '
              '`content/dialog/portraits/<slug>.png` as the reference image, paste the prompt, and save the result '
              'under the file name shown (864 × 1152 PNG).\n')
    md.append('**To switch a character on:** commit its three files, then add its slug to '
              '`prototype/test-game/src/data/portraitMoods.js` (`portraitMoods.test.mjs` checks the files are there). '
              'The game then shows angry when the player is Wary or Hostile with them, happy when Friendly or Trusted, '
              'neutral otherwise.\n')
    md.append('Characters marked **placeholder** still have a placeholder base portrait: make the final portrait '
              'first, then these.\n')
    md.append(f'**Shared instruction (inside every prompt):** {STYLE}\n')
    for key, fac in packs['factions'].items():
        md.append(f'\n## {fac["name"]}\n')
        for c in fac.get('characters', []):
            name, align = c['name'], c.get('align', 'N')
            status = art.get(name, 'Placeholder')
            md.append(f'\n### {name} · {ALIGN_NAME.get(align, align)}{"" if status == "Final" else " · placeholder"}\n')
            md.append(f'Reference: `content/dialog/portraits/{slug(name)}.png`\n')
            for mood in ('angry', 'neutral', 'happy'):
                expr = EXPRESSION[mood][family(align)]
                prompt = (f'{STYLE} The character is {name}, {fac["name"]} faction, {ALIGN_NAME.get(align, align)}. '
                          f'New expression ({mood}): {expr}.')
                file = f'content/dialog/portraits/{slug(name)}-{mood}.png'
                rows.append({'faction': key, 'name': name, 'slug': slug(name), 'align': align, 'mood': mood,
                             'file': file, 'base': f'content/dialog/portraits/{slug(name)}.png',
                             'baseArt': status, 'prompt': prompt})
                md.append(f'\n**{mood.capitalize()}** → `{file}`\n\n```\n{prompt}\n```\n')
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'Portrait-Expression-Prompts.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(md))
    with open(os.path.join(OUT, 'prompts.json'), 'w', encoding='utf-8') as f:
        json.dump({'style': STYLE, 'expression': EXPRESSION, 'prompts': rows}, f, indent=1, ensure_ascii=False)
    final = len({r['name'] for r in rows if r['baseArt'] == 'Final'})
    print(f'{len(rows)} prompts for {len(rows) // 3} characters ({final} with final base art) -> {OUT}')


if __name__ == '__main__':
    main()
