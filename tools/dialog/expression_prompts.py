#!/usr/bin/env python3
"""tools/dialog/expression_prompts.py — the RELATIONSHIP PORTRAIT tool [MM-story_mwpni0v4_3m] (was MM-task_mw9odkf0_4).

Owner 2026-11-20: "We should also strengthen the character creation tool for images. The character should all have 3
portraits invoking relationship as neutral, friendly, or antagonistic. These can be swapped into dialogs based on
friend level. Even an angry character could appear neutral if given the right info or gift."

The game draws content/dialog/portraits/<slug>-<antagonistic|neutral|friendly>.png by the player's rating with the
character and any mood shift (src/save/standings.js moodFor), once the slug is listed in src/data/portraitMoods.js, and
the plain <slug>.png until then.

What this tool does, from content/dialog/voicepacks.json, content/characters/<faction>.json and the portraits folder:
  1. Two prompts per character, antagonistic and friendly; the base portrait is the neutral one. Each prompt EDITS the character's existing portrait (attach it as the
     reference), so face, outfit and framing stay and only the expression changes. The expression is GENERATED from
     the character's personality (their characters file, else their alignment's primary personality,
     docs/tech-plan/Character-System.md §4) and coloured by alignment: a devoted character's antagonism is stern
     disappointment, a schemer's is a thin smile that does not reach the eyes.
  2. A status for every character: base art final or placeholder, base file format and size, and which of the two
     relationship files exist and are the right size (864 x 1152 PNG).
  2b. PLACEHOLDERS (owner 2026-11-20: "In place of new images copy the current image into the other two slots as new
     images (flag to be replaced) and print the relationship status over the image"): a missing relationship file is
     created as a byte copy of the base portrait. A file that is still byte-identical to its base IS a placeholder:
     flagged here, listed in PLACEHOLDER_PORTRAITS (the game prints NEUTRAL / FRIENDLY / ANTAGONISTIC over it), and
     replaced by saving the final art over it. Git stores identical copies once. --no-placeholders skips the copy.
  3. Writes src/data/portraitMoods.js: every slug whose two files are present, so a committed set switches on with
     no hand edit.

Writes:
  docs/16 Bulwark MM/create/portrait-expressions/Portrait-Expression-Prompts.md   (the prompt sheet)
  docs/16 Bulwark MM/create/portrait-expressions/prompts.json
  prototype/test-game/tools/portraits/prompts.json                                 (read by the review page)
  prototype/test-game/src/data/portraitMoods.js

Run from the repo root:  python tools/dialog/expression_prompts.py
Review page (served):    python serve_prototype.py prototype/test-game/tools/portraits/index.html
"""
import json
import os
import re
import shutil
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.join(HERE, '..', '..')
GAME = os.path.join(REPO, 'prototype', 'test-game')
PORTRAITS = os.path.join(GAME, 'content', 'dialog', 'portraits')
OUT = os.path.join(REPO, 'docs', '16 Bulwark MM', 'create', 'portrait-expressions')
REVIEW = os.path.join(GAME, 'tools', 'portraits')
MOODS_JS = os.path.join(GAME, 'src', 'data', 'portraitMoods.js')

# neutral IS the base portrait (owner 2026-11-20: "Can we assume all current images are neutral?"): only these two are made
MOODS = ('antagonistic', 'friendly')
SIZE = (864, 1152)
ALIGN_NAME = {'AG': 'absolute good', 'PG': 'principled good', 'G': 'good', 'CG': 'chaotic good', 'N': 'neutral',
              'CE': 'chaotic evil', 'E': 'evil', 'PE': 'principled evil', 'DE': 'dark evil'}
GOOD, EVIL = {'AG', 'PG', 'G', 'CG'}, {'CE', 'E', 'PE', 'DE'}
# Character-System.md §4: each alignment's primary personality (used when a character file does not name one)
PRIMARY = {'AG': 'devoted', 'PG': 'devoted', 'G': 'open-hearted', 'CG': 'whimsical', 'N': 'wary',
           'CE': 'cruel', 'E': 'schemer', 'PE': 'schemer', 'DE': 'cruel'}

# How each personality looks at someone it is antagonistic to, neutral with, or friendly with.
EXPRESSION = {
    'devoted': {
        'antagonistic': 'stern, disappointed anger, as at someone who broke faith: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin',
        'neutral': 'dutiful attention: brows level, a steady direct gaze, mouth at rest, posture of someone on watch',
        'friendly': 'solemn warmth, as to a trusted comrade: a small sincere smile, softened eyes, brows relaxed',
    },
    'open-hearted': {
        'antagonistic': 'hurt more than hostile: brows pinched upward, eyes wounded and wary, mouth turned down',
        'neutral': 'open and curious: brows slightly raised, eyes interested, the hint of a ready smile',
        'friendly': 'warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted',
    },
    'wary': {
        'antagonistic': 'cold suspicion: eyes narrowed and sidelong, brows lowered, mouth a flat line, chin tucked',
        'neutral': 'guarded and unreadable: level brows, a measuring gaze, mouth at rest',
        'friendly': 'a reluctant, earned smile: one corner of the mouth up, eyes still watchful but softened',
    },
    'whimsical': {
        'antagonistic': 'mocking scorn: one brow arched high, a lopsided sneer, eyes rolling slightly',
        'neutral': 'amused detachment: a faint private smile, one brow a touch higher than the other',
        'friendly': 'delighted mischief: a wide grin, bright eyes, brows lifted as if sharing a joke',
    },
    'proud': {
        'antagonistic': 'haughty disdain: chin raised, looking down the nose, lids half-lowered, lips thin',
        'neutral': 'composed self-regard: chin level and high, a cool steady gaze, mouth at rest',
        'friendly': 'gracious approval: a restrained smile, a slight approving nod of the head, eyes warm',
    },
    'schemer': {
        'antagonistic': 'quiet threat: a thin smile that does not reach the eyes, eyes cold and fixed, head slightly tilted',
        'neutral': 'polite and calculating: a pleasant mask of a smile, appraising eyes',
        'friendly': 'satisfied and sly: a crooked smirk, one brow raised, eyes glinting, as with a useful ally',
    },
    'cruel': {
        'antagonistic': 'open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head forward',
        'neutral': 'bored contempt: heavy-lidded eyes, mouth slack with disinterest',
        'friendly': 'a predatory grin: teeth showing, eyes bright with appetite, as to a useful tool',
    },
}
TINT = {'good': '', 'neutral': '', 'evil': ' Keep an edge of menace even in warmth.'}
FRAME = {
    'antagonistic': 'looking at someone they consider an enemy',
    'neutral': 'looking at someone they have no feelings about yet',
    'friendly': 'looking at someone they like and trust',
}
STYLE = ('Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or '
         'headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial '
         'expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), '
         'saved as PNG. No text, no letters, no border.')


def slug(name):
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', name, flags=re.I)).lower()


def family(align):
    return 'good' if align in GOOD else 'evil' if align in EVIL else 'neutral'


def image_info(path):
    """→ {'exists', 'format', 'size'} from the file's header (no image library needed)."""
    if not os.path.exists(path):
        return {'exists': False, 'format': None, 'size': None}
    with open(path, 'rb') as f:
        head = f.read(64 * 1024)
    if head[:8] == b'\x89PNG\r\n\x1a\n':
        return {'exists': True, 'format': 'png', 'size': list(struct.unpack('>II', head[16:24]))}
    if head[:3] == b'\xff\xd8\xff':
        i = 2
        while i < len(head) - 9:
            if head[i] != 0xFF:
                i += 1
                continue
            marker = head[i + 1]
            if marker in (0xC0, 0xC1, 0xC2):
                h, w = struct.unpack('>HH', head[i + 5:i + 9])
                return {'exists': True, 'format': 'jpeg', 'size': [w, h]}
            i += 2 + struct.unpack('>H', head[i + 2:i + 4])[0]
        return {'exists': True, 'format': 'jpeg', 'size': None}
    return {'exists': True, 'format': 'unknown', 'size': None}


def problems(info, need_png=True):
    out = []
    if not info['exists']:
        return ['missing']
    if need_png and info['format'] != 'png':
        out.append(f'{info["format"]} saved as .png')
    if info['size'] and tuple(info['size']) != SIZE:
        out.append(f'{info["size"][0]}×{info["size"][1]}, not 864×1152')
    return out


def personality_map():
    out = {}
    folder = os.path.join(GAME, 'content', 'characters')
    for f in os.listdir(folder) if os.path.isdir(folder) else []:
        if not f.endswith('.json') or f == 'threads.json':
            continue
        data = json.load(open(os.path.join(folder, f), encoding='utf-8'))
        for c in data.get('characters', []):
            if c.get('personality'):
                out[c['name']] = c['personality']
    return out


def main():
    packs = json.load(open(os.path.join(GAME, 'content', 'dialog', 'voicepacks.json'), encoding='utf-8'))
    missions = json.load(open(os.path.join(GAME, 'content', 'missions', 'missions.json'), encoding='utf-8'))
    art = {}
    for m in missions.get('missions', []):
        g = m.get('giver') or {}
        if g.get('name'):
            art[g['name']] = g.get('art') or art.get(g['name']) or 'Placeholder'
    pers = personality_map()

    chars, rows = [], []
    for key, fac in packs['factions'].items():
        for c in fac.get('characters', []):
            name, align = c['name'], c.get('align', 'N')
            sl = slug(name)
            personality = pers.get(name) or PRIMARY.get(align, 'wary')
            source = 'character file' if name in pers else f'{align} primary (Character-System §4)'
            base = image_info(os.path.join(PORTRAITS, sl + '.png'))
            entry = {'faction': key, 'factionName': fac['name'], 'name': name, 'slug': sl, 'align': align,
                     'alignName': ALIGN_NAME.get(align, align), 'personality': personality,
                     'personalitySource': source, 'baseArt': art.get(name, 'Placeholder'),
                     'base': f'content/dialog/portraits/{sl}.png', 'baseInfo': base,
                     'baseProblems': problems(base, need_png=False) + (['placeholder base art'] if art.get(name, 'Placeholder') != 'Final' else []),
                     'moods': {}}
            expr_set = EXPRESSION.get(personality, EXPRESSION['wary'])
            base_path = os.path.join(PORTRAITS, sl + '.png')
            base_bytes = open(base_path, 'rb').read() if base['exists'] else None
            for mood in MOODS:
                file = f'content/dialog/portraits/{sl}-{mood}.png'
                path = os.path.join(GAME, file)
                if base_bytes is not None and not os.path.exists(path) and '--no-placeholders' not in sys.argv:
                    shutil.copyfile(base_path, path)
                info = image_info(path)
                placeholder = bool(info['exists'] and base_bytes is not None and open(path, 'rb').read() == base_bytes)
                prompt = (f'{STYLE} The character is {name}, {fac["name"]} faction, {ALIGN_NAME.get(align, align)}, '
                          f'{personality}. Relationship: {mood}, {FRAME[mood]}. New expression: {expr_set[mood]}.'
                          f'{TINT[family(align)] if mood == "friendly" else ""}')
                entry['moods'][mood] = {'file': file, 'info': info, 'placeholder': placeholder,
                                        'problems': ['placeholder: replace'] if placeholder else problems(info), 'prompt': prompt}
                rows.append({'faction': key, 'name': name, 'slug': sl, 'align': align, 'personality': personality,
                             'mood': mood, 'file': file, 'base': entry['base'], 'baseArt': entry['baseArt'],
                             'prompt': prompt})
            entry['ready'] = all(not entry['moods'][m]['problems'] for m in MOODS)
            chars.append(entry)

    ready = sorted(c['slug'] for c in chars if c['ready'])
    present = sorted(c['slug'] for c in chars if all(c['moods'][m]['info']['exists'] for m in MOODS))
    placeholders = sorted(c['slug'] for c in chars if any(c['moods'][m]['placeholder'] for m in MOODS))
    have_any = sum(1 for c in chars if any(c['moods'][m]['info']['exists'] and not c['moods'][m]['placeholder'] for m in MOODS))

    # 1. the prompt sheet
    md = ['# Character relationship portraits (prompts)\n',
          'Owner 2026-11-20: "The character should all have 3 portraits invoking relationship as neutral, friendly, or '
          'antagonistic. These can be swapped into dialogs based on friend level. Even an angry character could appear '
          'neutral if given the right info or gift." … "Can we assume all current images are neutral?" Yes: the base '
          'portrait is the **neutral** one, so two new portraits per character, antagonistic and friendly. A base '
          'portrait that does not read as neutral is replaced as the base. Each prompt **edits the character\'s '
          'existing portrait**: attach `content/dialog/portraits/<slug>.png` as the reference image, paste the prompt, '
          'and save the result under the file name shown (864 × 1152 PNG).\n',
          '**Switching on is automatic:** commit a character\'s two files and re-run '
          '`python tools/dialog/expression_prompts.py`; it lists the slug in `src/data/portraitMoods.js`. The game shows '
          'antagonistic when the player is Wary or Hostile with them, friendly when Friendly or Trusted, neutral '
          'otherwise, shifted one step by a kept or broken promise, a gift or news (save/standings.js).\n',
          '**Review page:** `tools/portraits/index.html` shows every character\'s neutral (base) portrait and its two '
          'other relationship portraits side by side, flags what is missing or the wrong size, and copies each prompt.\n',
          f'**Status:** {len(chars)} characters, {len(ready)} with both final relationship portraits, {have_any} with at '
          f'least one final; {len(placeholders)} still on placeholders (copies of the base, labelled in game).\n',
          '**Placeholders:** a missing portrait is created as a copy of the base portrait and flagged "placeholder: '
          'replace" below; the game prints the relationship status over it. Save the final art over the placeholder file '
          'and re-run this tool.\n',
          f'**Shared instruction (inside every prompt):** {STYLE}\n']
    for key, fac in packs['factions'].items():
        md.append(f'\n## {fac["name"]}\n')
        for c in [x for x in chars if x['faction'] == key]:
            flags = '' if not c['baseProblems'] else ' · ' + ', '.join(c['baseProblems'])
            md.append(f'\n### {c["name"]} · {c["alignName"]} · {c["personality"]}{flags}\n')
            md.append(f'Reference: `{c["base"]}` · personality from {c["personalitySource"]}\n')
            for mood in MOODS:
                mm = c['moods'][mood]
                state = 'done' if not mm['problems'] else ', '.join(mm['problems'])
                md.append(f'\n**{mood.capitalize()}** → `{mm["file"]}` ({state})\n\n```\n{mm["prompt"]}\n```\n')
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'Portrait-Expression-Prompts.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(md))
    with open(os.path.join(OUT, 'prompts.json'), 'w', encoding='utf-8') as f:
        json.dump({'style': STYLE, 'expression': EXPRESSION, 'prompts': rows}, f, indent=1, ensure_ascii=False)

    # 2. the review page's data
    os.makedirs(REVIEW, exist_ok=True)
    with open(os.path.join(REVIEW, 'prompts.json'), 'w', encoding='utf-8') as f:
        json.dump({'moods': list(MOODS), 'size': list(SIZE), 'characters': chars}, f, indent=1, ensure_ascii=False)

    # 3. the switch-on list
    with open(MOODS_JS, 'w', encoding='utf-8', newline='\n') as f:
        f.write('/**\n'
                ' * src/data/portraitMoods.js — GENERATED by tools/dialog/expression_prompts.py; do not edit by hand.\n'
                ' * RELATIONSHIP PORTRAITS [MM-story_mwpni0v4_3m] (owner 2026-11-20: "3 portraits invoking relationship as neutral,\n'
                ' * friendly, or antagonistic"). The base portrait <slug>.png is the neutral one. For a slug listed here the game also\n'
                ' * draws content/dialog/portraits/<slug>-<antagonistic|friendly>.png by the player\'s rating with them and any mood\n'
                ' * shift (save/standings.js moodFor); for any other it keeps the one portrait it has. The tool lists a slug once both\n'
                ' * files are in content/dialog/portraits/; portraitMoods.test.mjs checks they are there and are 864 × 1152.\n'
                ' * PLACEHOLDER_PORTRAITS: slugs whose relationship files are still byte copies of the base portrait (owner\n'
                ' * 2026-11-20: "flag to be replaced"); the game prints the relationship status over them (commCard relationLabel).\n'
                ' * Review page: tools/portraits/index.html.\n'
                ' */\n'
                'export const MOOD_PORTRAITS = new Set([\n')
        for s in present:
            f.write(f"  '{s}',\n")
        f.write(']);\n\nexport const PLACEHOLDER_PORTRAITS = new Set([\n')
        for s in placeholders:
            f.write(f"  '{s}',\n")
        f.write(']);\n')
    print(f'{len(rows)} prompts for {len(chars)} characters; {len(ready)} final, {len(placeholders)} on placeholders, '
          f'{len(present)} switched on -> {OUT}')


if __name__ == '__main__':
    main()
