# Character relationship portraits (prompts)

Owner 2026-11-20: "The character should all have 3 portraits invoking relationship as neutral, friendly, or antagonistic. These can be swapped into dialogs based on friend level. Even an angry character could appear neutral if given the right info or gift." Three per character. Each prompt **edits the character's existing portrait**: attach `content/dialog/portraits/<slug>.png` as the reference image, paste the prompt, and save the result under the file name shown (864 × 1152 PNG).

**Switching on is automatic:** commit a character's three files and re-run `python tools/dialog/expression_prompts.py`; it lists the slug in `src/data/portraitMoods.js`. The game shows antagonistic when the player is Wary or Hostile with them, friendly when Friendly or Trusted, neutral otherwise, shifted one step by a kept or broken promise, a gift or news (save/standings.js).

**Review page:** `tools/portraits/index.html` shows every character's base portrait and its three relationship portraits side by side, flags what is missing or the wrong size, and copies each prompt.

**Status:** 81 characters, 0 with all three relationship portraits, 0 with at least one.

**Shared instruction (inside every prompt):** Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border.


## Ground / Powder


### Field-Marshal Seraphine von Halbrecht · absolute good · proud

Reference: `content/dialog/portraits/field-marshal-seraphine-von-halbrecht.png` · personality from character file


**Antagonistic** → `content/dialog/portraits/field-marshal-seraphine-von-halbrecht-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Field-Marshal Seraphine von Halbrecht, Ground / Powder faction, absolute good, proud. Relationship: antagonistic, looking at someone they consider an enemy. New expression: haughty disdain: chin raised, looking down the nose, lids half-lowered, lips thin.
```


**Neutral** → `content/dialog/portraits/field-marshal-seraphine-von-halbrecht-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Field-Marshal Seraphine von Halbrecht, Ground / Powder faction, absolute good, proud. Relationship: neutral, looking at someone they have no feelings about yet. New expression: composed self-regard: chin level and high, a cool steady gaze, mouth at rest.
```


**Friendly** → `content/dialog/portraits/field-marshal-seraphine-von-halbrecht-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Field-Marshal Seraphine von Halbrecht, Ground / Powder faction, absolute good, proud. Relationship: friendly, looking at someone they like and trust. New expression: gracious approval: a restrained smile, a slight approving nod of the head, eyes warm.
```


### Colonel Aldric Vane · principled good · devoted

Reference: `content/dialog/portraits/colonel-aldric-vane.png` · personality from character file


**Antagonistic** → `content/dialog/portraits/colonel-aldric-vane-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Colonel Aldric Vane, Ground / Powder faction, principled good, devoted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: stern, disappointed anger, as at someone who broke faith: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/colonel-aldric-vane-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Colonel Aldric Vane, Ground / Powder faction, principled good, devoted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: dutiful attention: brows level, a steady direct gaze, mouth at rest, posture of someone on watch.
```


**Friendly** → `content/dialog/portraits/colonel-aldric-vane-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Colonel Aldric Vane, Ground / Powder faction, principled good, devoted. Relationship: friendly, looking at someone they like and trust. New expression: solemn warmth, as to a trusted comrade: a small sincere smile, softened eyes, brows relaxed.
```


### Captain Otto von Halbrecht · good · open-hearted

Reference: `content/dialog/portraits/captain-otto-von-halbrecht.png` · personality from character file


**Antagonistic** → `content/dialog/portraits/captain-otto-von-halbrecht-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Captain Otto von Halbrecht, Ground / Powder faction, good, open-hearted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: hurt more than hostile: brows pinched upward, eyes wounded and wary, mouth turned down.
```


**Neutral** → `content/dialog/portraits/captain-otto-von-halbrecht-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Captain Otto von Halbrecht, Ground / Powder faction, good, open-hearted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: open and curious: brows slightly raised, eyes interested, the hint of a ready smile.
```


**Friendly** → `content/dialog/portraits/captain-otto-von-halbrecht-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Captain Otto von Halbrecht, Ground / Powder faction, good, open-hearted. Relationship: friendly, looking at someone they like and trust. New expression: warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Sergeant "Bricks" Malloy · chaotic good · whimsical

Reference: `content/dialog/portraits/sergeant-bricks-malloy.png` · personality from character file


**Antagonistic** → `content/dialog/portraits/sergeant-bricks-malloy-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Sergeant "Bricks" Malloy, Ground / Powder faction, chaotic good, whimsical. Relationship: antagonistic, looking at someone they consider an enemy. New expression: mocking scorn: one brow arched high, a lopsided sneer, eyes rolling slightly.
```


**Neutral** → `content/dialog/portraits/sergeant-bricks-malloy-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Sergeant "Bricks" Malloy, Ground / Powder faction, chaotic good, whimsical. Relationship: neutral, looking at someone they have no feelings about yet. New expression: amused detachment: a faint private smile, one brow a touch higher than the other.
```


**Friendly** → `content/dialog/portraits/sergeant-bricks-malloy-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Sergeant "Bricks" Malloy, Ground / Powder faction, chaotic good, whimsical. Relationship: friendly, looking at someone they like and trust. New expression: delighted mischief: a wide grin, bright eyes, brows lifted as if sharing a joke.
```


### Quartermaster Ines Roth · neutral · wary

Reference: `content/dialog/portraits/quartermaster-ines-roth.png` · personality from character file


**Antagonistic** → `content/dialog/portraits/quartermaster-ines-roth-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Quartermaster Ines Roth, Ground / Powder faction, neutral, wary. Relationship: antagonistic, looking at someone they consider an enemy. New expression: cold suspicion: eyes narrowed and sidelong, brows lowered, mouth a flat line, chin tucked.
```


**Neutral** → `content/dialog/portraits/quartermaster-ines-roth-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Quartermaster Ines Roth, Ground / Powder faction, neutral, wary. Relationship: neutral, looking at someone they have no feelings about yet. New expression: guarded and unreadable: level brows, a measuring gaze, mouth at rest.
```


**Friendly** → `content/dialog/portraits/quartermaster-ines-roth-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Quartermaster Ines Roth, Ground / Powder faction, neutral, wary. Relationship: friendly, looking at someone they like and trust. New expression: a reluctant, earned smile: one corner of the mouth up, eyes still watchful but softened.
```


### Freikorps raider Grigor Vosk · chaotic evil · cruel · 1024×1024, not 864×1152

Reference: `content/dialog/portraits/freikorps-raider-grigor-vosk.png` · personality from character file


**Antagonistic** → `content/dialog/portraits/freikorps-raider-grigor-vosk-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Freikorps raider Grigor Vosk, Ground / Powder faction, chaotic evil, cruel. Relationship: antagonistic, looking at someone they consider an enemy. New expression: open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head forward.
```


**Neutral** → `content/dialog/portraits/freikorps-raider-grigor-vosk-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Freikorps raider Grigor Vosk, Ground / Powder faction, chaotic evil, cruel. Relationship: neutral, looking at someone they have no feelings about yet. New expression: bored contempt: heavy-lidded eyes, mouth slack with disinterest.
```


**Friendly** → `content/dialog/portraits/freikorps-raider-grigor-vosk-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Freikorps raider Grigor Vosk, Ground / Powder faction, chaotic evil, cruel. Relationship: friendly, looking at someone they like and trust. New expression: a predatory grin: teeth showing, eyes bright with appetite, as to a useful tool. Keep an edge of menace even in warmth.
```


### General Kord Stahl · evil · proud

Reference: `content/dialog/portraits/general-kord-stahl.png` · personality from character file


**Antagonistic** → `content/dialog/portraits/general-kord-stahl-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is General Kord Stahl, Ground / Powder faction, evil, proud. Relationship: antagonistic, looking at someone they consider an enemy. New expression: haughty disdain: chin raised, looking down the nose, lids half-lowered, lips thin.
```


**Neutral** → `content/dialog/portraits/general-kord-stahl-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is General Kord Stahl, Ground / Powder faction, evil, proud. Relationship: neutral, looking at someone they have no feelings about yet. New expression: composed self-regard: chin level and high, a cool steady gaze, mouth at rest.
```


**Friendly** → `content/dialog/portraits/general-kord-stahl-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is General Kord Stahl, Ground / Powder faction, evil, proud. Relationship: friendly, looking at someone they like and trust. New expression: gracious approval: a restrained smile, a slight approving nod of the head, eyes warm. Keep an edge of menace even in warmth.
```


### Chancellor Wilhelmina Graf · principled evil · cruel

Reference: `content/dialog/portraits/chancellor-wilhelmina-graf.png` · personality from character file


**Antagonistic** → `content/dialog/portraits/chancellor-wilhelmina-graf-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Chancellor Wilhelmina Graf, Ground / Powder faction, principled evil, cruel. Relationship: antagonistic, looking at someone they consider an enemy. New expression: open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head forward.
```


**Neutral** → `content/dialog/portraits/chancellor-wilhelmina-graf-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Chancellor Wilhelmina Graf, Ground / Powder faction, principled evil, cruel. Relationship: neutral, looking at someone they have no feelings about yet. New expression: bored contempt: heavy-lidded eyes, mouth slack with disinterest.
```


**Friendly** → `content/dialog/portraits/chancellor-wilhelmina-graf-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Chancellor Wilhelmina Graf, Ground / Powder faction, principled evil, cruel. Relationship: friendly, looking at someone they like and trust. New expression: a predatory grin: teeth showing, eyes bright with appetite, as to a useful tool. Keep an edge of menace even in warmth.
```


### The Iron Regent (masked) · dark evil · schemer

Reference: `content/dialog/portraits/the-iron-regent-masked.png` · personality from character file


**Antagonistic** → `content/dialog/portraits/the-iron-regent-masked-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Iron Regent (masked), Ground / Powder faction, dark evil, schemer. Relationship: antagonistic, looking at someone they consider an enemy. New expression: quiet threat: a thin smile that does not reach the eyes, eyes cold and fixed, head slightly tilted.
```


**Neutral** → `content/dialog/portraits/the-iron-regent-masked-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Iron Regent (masked), Ground / Powder faction, dark evil, schemer. Relationship: neutral, looking at someone they have no feelings about yet. New expression: polite and calculating: a pleasant mask of a smile, appraising eyes.
```


**Friendly** → `content/dialog/portraits/the-iron-regent-masked-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Iron Regent (masked), Ground / Powder faction, dark evil, schemer. Relationship: friendly, looking at someone they like and trust. New expression: satisfied and sly: a crooked smirk, one brow raised, eyes glinting, as with a useful ally. Keep an edge of menace even in warmth.
```


## Air


### Squadron-Mother Hikari "Dawnwing" Aoi · absolute good · devoted

Reference: `content/dialog/portraits/squadron-mother-hikari-dawnwing-aoi.png` · personality from AG primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/squadron-mother-hikari-dawnwing-aoi-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Squadron-Mother Hikari "Dawnwing" Aoi, Air faction, absolute good, devoted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: stern, disappointed anger, as at someone who broke faith: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/squadron-mother-hikari-dawnwing-aoi-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Squadron-Mother Hikari "Dawnwing" Aoi, Air faction, absolute good, devoted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: dutiful attention: brows level, a steady direct gaze, mouth at rest, posture of someone on watch.
```


**Friendly** → `content/dialog/portraits/squadron-mother-hikari-dawnwing-aoi-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Squadron-Mother Hikari "Dawnwing" Aoi, Air faction, absolute good, devoted. Relationship: friendly, looking at someone they like and trust. New expression: solemn warmth, as to a trusted comrade: a small sincere smile, softened eyes, brows relaxed.
```


### Ace Jun "Halo" Sato · principled good · devoted

Reference: `content/dialog/portraits/ace-jun-halo-sato.png` · personality from PG primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/ace-jun-halo-sato-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Ace Jun "Halo" Sato, Air faction, principled good, devoted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: stern, disappointed anger, as at someone who broke faith: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/ace-jun-halo-sato-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Ace Jun "Halo" Sato, Air faction, principled good, devoted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: dutiful attention: brows level, a steady direct gaze, mouth at rest, posture of someone on watch.
```


**Friendly** → `content/dialog/portraits/ace-jun-halo-sato-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Ace Jun "Halo" Sato, Air faction, principled good, devoted. Relationship: friendly, looking at someone they like and trust. New expression: solemn warmth, as to a trusted comrade: a small sincere smile, softened eyes, brows relaxed.
```


### Rei "Skylark" Tanaka · good · open-hearted · placeholder base art

Reference: `content/dialog/portraits/rei-skylark-tanaka.png` · personality from G primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/rei-skylark-tanaka-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Rei "Skylark" Tanaka, Air faction, good, open-hearted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: hurt more than hostile: brows pinched upward, eyes wounded and wary, mouth turned down.
```


**Neutral** → `content/dialog/portraits/rei-skylark-tanaka-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Rei "Skylark" Tanaka, Air faction, good, open-hearted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: open and curious: brows slightly raised, eyes interested, the hint of a ready smile.
```


**Friendly** → `content/dialog/portraits/rei-skylark-tanaka-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Rei "Skylark" Tanaka, Air faction, good, open-hearted. Relationship: friendly, looking at someone they like and trust. New expression: warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Kaito "Rogue" Minami · chaotic good · whimsical

Reference: `content/dialog/portraits/kaito-rogue-minami.png` · personality from CG primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/kaito-rogue-minami-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Kaito "Rogue" Minami, Air faction, chaotic good, whimsical. Relationship: antagonistic, looking at someone they consider an enemy. New expression: mocking scorn: one brow arched high, a lopsided sneer, eyes rolling slightly.
```


**Neutral** → `content/dialog/portraits/kaito-rogue-minami-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Kaito "Rogue" Minami, Air faction, chaotic good, whimsical. Relationship: neutral, looking at someone they have no feelings about yet. New expression: amused detachment: a faint private smile, one brow a touch higher than the other.
```


**Friendly** → `content/dialog/portraits/kaito-rogue-minami-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Kaito "Rogue" Minami, Air faction, chaotic good, whimsical. Relationship: friendly, looking at someone they like and trust. New expression: delighted mischief: a wide grin, bright eyes, brows lifted as if sharing a joke.
```


### Mechanic Sora Ito · neutral · wary

Reference: `content/dialog/portraits/mechanic-sora-ito.png` · personality from N primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/mechanic-sora-ito-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Mechanic Sora Ito, Air faction, neutral, wary. Relationship: antagonistic, looking at someone they consider an enemy. New expression: cold suspicion: eyes narrowed and sidelong, brows lowered, mouth a flat line, chin tucked.
```


**Neutral** → `content/dialog/portraits/mechanic-sora-ito-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Mechanic Sora Ito, Air faction, neutral, wary. Relationship: neutral, looking at someone they have no feelings about yet. New expression: guarded and unreadable: level brows, a measuring gaze, mouth at rest.
```


**Friendly** → `content/dialog/portraits/mechanic-sora-ito-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Mechanic Sora Ito, Air faction, neutral, wary. Relationship: friendly, looking at someone they like and trust. New expression: a reluctant, earned smile: one corner of the mouth up, eyes still watchful but softened.
```


### Renegade "Viper" Ryu · chaotic evil · cruel · 1024×1024, not 864×1152

Reference: `content/dialog/portraits/renegade-viper-ryu.png` · personality from CE primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/renegade-viper-ryu-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Renegade "Viper" Ryu, Air faction, chaotic evil, cruel. Relationship: antagonistic, looking at someone they consider an enemy. New expression: open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head forward.
```


**Neutral** → `content/dialog/portraits/renegade-viper-ryu-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Renegade "Viper" Ryu, Air faction, chaotic evil, cruel. Relationship: neutral, looking at someone they have no feelings about yet. New expression: bored contempt: heavy-lidded eyes, mouth slack with disinterest.
```


**Friendly** → `content/dialog/portraits/renegade-viper-ryu-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Renegade "Viper" Ryu, Air faction, chaotic evil, cruel. Relationship: friendly, looking at someone they like and trust. New expression: a predatory grin: teeth showing, eyes bright with appetite, as to a useful tool. Keep an edge of menace even in warmth.
```


### Wing-Commander Garret "Ash" Kowalski · evil · schemer · 1024×1024, not 864×1152

Reference: `content/dialog/portraits/wing-commander-garret-ash-kowalski.png` · personality from E primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/wing-commander-garret-ash-kowalski-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Wing-Commander Garret "Ash" Kowalski, Air faction, evil, schemer. Relationship: antagonistic, looking at someone they consider an enemy. New expression: quiet threat: a thin smile that does not reach the eyes, eyes cold and fixed, head slightly tilted.
```


**Neutral** → `content/dialog/portraits/wing-commander-garret-ash-kowalski-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Wing-Commander Garret "Ash" Kowalski, Air faction, evil, schemer. Relationship: neutral, looking at someone they have no feelings about yet. New expression: polite and calculating: a pleasant mask of a smile, appraising eyes.
```


**Friendly** → `content/dialog/portraits/wing-commander-garret-ash-kowalski-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Wing-Commander Garret "Ash" Kowalski, Air faction, evil, schemer. Relationship: friendly, looking at someone they like and trust. New expression: satisfied and sly: a crooked smirk, one brow raised, eyes glinting, as with a useful ally. Keep an edge of menace even in warmth.
```


### Sky-Marshal Reiko Kurogane · principled evil · schemer

Reference: `content/dialog/portraits/sky-marshal-reiko-kurogane.png` · personality from PE primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/sky-marshal-reiko-kurogane-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Sky-Marshal Reiko Kurogane, Air faction, principled evil, schemer. Relationship: antagonistic, looking at someone they consider an enemy. New expression: quiet threat: a thin smile that does not reach the eyes, eyes cold and fixed, head slightly tilted.
```


**Neutral** → `content/dialog/portraits/sky-marshal-reiko-kurogane-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Sky-Marshal Reiko Kurogane, Air faction, principled evil, schemer. Relationship: neutral, looking at someone they have no feelings about yet. New expression: polite and calculating: a pleasant mask of a smile, appraising eyes.
```


**Friendly** → `content/dialog/portraits/sky-marshal-reiko-kurogane-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Sky-Marshal Reiko Kurogane, Air faction, principled evil, schemer. Relationship: friendly, looking at someone they like and trust. New expression: satisfied and sly: a crooked smirk, one brow raised, eyes glinting, as with a useful ally. Keep an edge of menace even in warmth.
```


### The Nightingale (ghost squadron) · dark evil · cruel

Reference: `content/dialog/portraits/the-nightingale-ghost-squadron.png` · personality from DE primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/the-nightingale-ghost-squadron-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Nightingale (ghost squadron), Air faction, dark evil, cruel. Relationship: antagonistic, looking at someone they consider an enemy. New expression: open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head forward.
```


**Neutral** → `content/dialog/portraits/the-nightingale-ghost-squadron-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Nightingale (ghost squadron), Air faction, dark evil, cruel. Relationship: neutral, looking at someone they have no feelings about yet. New expression: bored contempt: heavy-lidded eyes, mouth slack with disinterest.
```


**Friendly** → `content/dialog/portraits/the-nightingale-ghost-squadron-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Nightingale (ghost squadron), Air faction, dark evil, cruel. Relationship: friendly, looking at someone they like and trust. New expression: a predatory grin: teeth showing, eyes bright with appetite, as to a useful tool. Keep an edge of menace even in warmth.
```


## High Tech


### Chief Ethicist Dr. Grace Sterling · absolute good · devoted · placeholder base art

Reference: `content/dialog/portraits/chief-ethicist-dr-grace-sterling.png` · personality from AG primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/chief-ethicist-dr-grace-sterling-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Chief Ethicist Dr. Grace Sterling, High Tech faction, absolute good, devoted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: stern, disappointed anger, as at someone who broke faith: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/chief-ethicist-dr-grace-sterling-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Chief Ethicist Dr. Grace Sterling, High Tech faction, absolute good, devoted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: dutiful attention: brows level, a steady direct gaze, mouth at rest, posture of someone on watch.
```


**Friendly** → `content/dialog/portraits/chief-ethicist-dr-grace-sterling-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Chief Ethicist Dr. Grace Sterling, High Tech faction, absolute good, devoted. Relationship: friendly, looking at someone they like and trust. New expression: solemn warmth, as to a trusted comrade: a small sincere smile, softened eyes, brows relaxed.
```


### R&D Lead Amara Okonkwo · principled good · devoted · placeholder base art

Reference: `content/dialog/portraits/r-d-lead-amara-okonkwo.png` · personality from PG primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/r-d-lead-amara-okonkwo-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is R&D Lead Amara Okonkwo, High Tech faction, principled good, devoted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: stern, disappointed anger, as at someone who broke faith: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/r-d-lead-amara-okonkwo-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is R&D Lead Amara Okonkwo, High Tech faction, principled good, devoted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: dutiful attention: brows level, a steady direct gaze, mouth at rest, posture of someone on watch.
```


**Friendly** → `content/dialog/portraits/r-d-lead-amara-okonkwo-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is R&D Lead Amara Okonkwo, High Tech faction, principled good, devoted. Relationship: friendly, looking at someone they like and trust. New expression: solemn warmth, as to a trusted comrade: a small sincere smile, softened eyes, brows relaxed.
```


### CFO Julian Vance · good · open-hearted · placeholder base art

Reference: `content/dialog/portraits/cfo-julian-vance.png` · personality from G primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/cfo-julian-vance-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is CFO Julian Vance, High Tech faction, good, open-hearted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: hurt more than hostile: brows pinched upward, eyes wounded and wary, mouth turned down.
```


**Neutral** → `content/dialog/portraits/cfo-julian-vance-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is CFO Julian Vance, High Tech faction, good, open-hearted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: open and curious: brows slightly raised, eyes interested, the hint of a ready smile.
```


**Friendly** → `content/dialog/portraits/cfo-julian-vance-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is CFO Julian Vance, High Tech faction, good, open-hearted. Relationship: friendly, looking at someone they like and trust. New expression: warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Hacker "Null" (Priya Nair) · chaotic good · whimsical · placeholder base art

Reference: `content/dialog/portraits/hacker-null-priya-nair.png` · personality from CG primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/hacker-null-priya-nair-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Hacker "Null" (Priya Nair), High Tech faction, chaotic good, whimsical. Relationship: antagonistic, looking at someone they consider an enemy. New expression: mocking scorn: one brow arched high, a lopsided sneer, eyes rolling slightly.
```


**Neutral** → `content/dialog/portraits/hacker-null-priya-nair-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Hacker "Null" (Priya Nair), High Tech faction, chaotic good, whimsical. Relationship: neutral, looking at someone they have no feelings about yet. New expression: amused detachment: a faint private smile, one brow a touch higher than the other.
```


**Friendly** → `content/dialog/portraits/hacker-null-priya-nair-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Hacker "Null" (Priya Nair), High Tech faction, chaotic good, whimsical. Relationship: friendly, looking at someone they like and trust. New expression: delighted mischief: a wide grin, bright eyes, brows lifted as if sharing a joke.
```


### Actuary Devlin Cho · neutral · wary · placeholder base art

Reference: `content/dialog/portraits/actuary-devlin-cho.png` · personality from N primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/actuary-devlin-cho-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Actuary Devlin Cho, High Tech faction, neutral, wary. Relationship: antagonistic, looking at someone they consider an enemy. New expression: cold suspicion: eyes narrowed and sidelong, brows lowered, mouth a flat line, chin tucked.
```


**Neutral** → `content/dialog/portraits/actuary-devlin-cho-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Actuary Devlin Cho, High Tech faction, neutral, wary. Relationship: neutral, looking at someone they have no feelings about yet. New expression: guarded and unreadable: level brows, a measuring gaze, mouth at rest.
```


**Friendly** → `content/dialog/portraits/actuary-devlin-cho-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Actuary Devlin Cho, High Tech faction, neutral, wary. Relationship: friendly, looking at someone they like and trust. New expression: a reluctant, earned smile: one corner of the mouth up, eyes still watchful but softened.
```


### Black-ops broker Sable Reyes · chaotic evil · cruel · placeholder base art

Reference: `content/dialog/portraits/black-ops-broker-sable-reyes.png` · personality from CE primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/black-ops-broker-sable-reyes-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Black-ops broker Sable Reyes, High Tech faction, chaotic evil, cruel. Relationship: antagonistic, looking at someone they consider an enemy. New expression: open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head forward.
```


**Neutral** → `content/dialog/portraits/black-ops-broker-sable-reyes-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Black-ops broker Sable Reyes, High Tech faction, chaotic evil, cruel. Relationship: neutral, looking at someone they have no feelings about yet. New expression: bored contempt: heavy-lidded eyes, mouth slack with disinterest.
```


**Friendly** → `content/dialog/portraits/black-ops-broker-sable-reyes-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Black-ops broker Sable Reyes, High Tech faction, chaotic evil, cruel. Relationship: friendly, looking at someone they like and trust. New expression: a predatory grin: teeth showing, eyes bright with appetite, as to a useful tool. Keep an edge of menace even in warmth.
```


### COO Marcus Thorne · evil · schemer · placeholder base art

Reference: `content/dialog/portraits/coo-marcus-thorne.png` · personality from E primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/coo-marcus-thorne-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is COO Marcus Thorne, High Tech faction, evil, schemer. Relationship: antagonistic, looking at someone they consider an enemy. New expression: quiet threat: a thin smile that does not reach the eyes, eyes cold and fixed, head slightly tilted.
```


**Neutral** → `content/dialog/portraits/coo-marcus-thorne-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is COO Marcus Thorne, High Tech faction, evil, schemer. Relationship: neutral, looking at someone they have no feelings about yet. New expression: polite and calculating: a pleasant mask of a smile, appraising eyes.
```


**Friendly** → `content/dialog/portraits/coo-marcus-thorne-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is COO Marcus Thorne, High Tech faction, evil, schemer. Relationship: friendly, looking at someone they like and trust. New expression: satisfied and sly: a crooked smirk, one brow raised, eyes glinting, as with a useful ally. Keep an edge of menace even in warmth.
```


### CEO Adrian Sterling · principled evil · schemer · placeholder base art

Reference: `content/dialog/portraits/ceo-adrian-sterling.png` · personality from PE primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/ceo-adrian-sterling-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is CEO Adrian Sterling, High Tech faction, principled evil, schemer. Relationship: antagonistic, looking at someone they consider an enemy. New expression: quiet threat: a thin smile that does not reach the eyes, eyes cold and fixed, head slightly tilted.
```


**Neutral** → `content/dialog/portraits/ceo-adrian-sterling-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is CEO Adrian Sterling, High Tech faction, principled evil, schemer. Relationship: neutral, looking at someone they have no feelings about yet. New expression: polite and calculating: a pleasant mask of a smile, appraising eyes.
```


**Friendly** → `content/dialog/portraits/ceo-adrian-sterling-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is CEO Adrian Sterling, High Tech faction, principled evil, schemer. Relationship: friendly, looking at someone they like and trust. New expression: satisfied and sly: a crooked smirk, one brow raised, eyes glinting, as with a useful ally. Keep an edge of menace even in warmth.
```


### The Board (anonymized AI) · dark evil · cruel · placeholder base art

Reference: `content/dialog/portraits/the-board-anonymized-ai.png` · personality from DE primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/the-board-anonymized-ai-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Board (anonymized AI), High Tech faction, dark evil, cruel. Relationship: antagonistic, looking at someone they consider an enemy. New expression: open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head forward.
```


**Neutral** → `content/dialog/portraits/the-board-anonymized-ai-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Board (anonymized AI), High Tech faction, dark evil, cruel. Relationship: neutral, looking at someone they have no feelings about yet. New expression: bored contempt: heavy-lidded eyes, mouth slack with disinterest.
```


**Friendly** → `content/dialog/portraits/the-board-anonymized-ai-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Board (anonymized AI), High Tech faction, dark evil, cruel. Relationship: friendly, looking at someone they like and trust. New expression: a predatory grin: teeth showing, eyes bright with appetite, as to a useful tool. Keep an edge of menace even in warmth.
```


## Artillery


### Chaplain-Gunner Ruth Bellamy · absolute good · devoted · placeholder base art

Reference: `content/dialog/portraits/chaplain-gunner-ruth-bellamy.png` · personality from AG primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/chaplain-gunner-ruth-bellamy-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Chaplain-Gunner Ruth Bellamy, Artillery faction, absolute good, devoted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: stern, disappointed anger, as at someone who broke faith: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/chaplain-gunner-ruth-bellamy-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Chaplain-Gunner Ruth Bellamy, Artillery faction, absolute good, devoted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: dutiful attention: brows level, a steady direct gaze, mouth at rest, posture of someone on watch.
```


**Friendly** → `content/dialog/portraits/chaplain-gunner-ruth-bellamy-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Chaplain-Gunner Ruth Bellamy, Artillery faction, absolute good, devoted. Relationship: friendly, looking at someone they like and trust. New expression: solemn warmth, as to a trusted comrade: a small sincere smile, softened eyes, brows relaxed.
```


### Fire-Director Yusuf Kaya · principled good · devoted · placeholder base art

Reference: `content/dialog/portraits/fire-director-yusuf-kaya.png` · personality from PG primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/fire-director-yusuf-kaya-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Fire-Director Yusuf Kaya, Artillery faction, principled good, devoted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: stern, disappointed anger, as at someone who broke faith: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/fire-director-yusuf-kaya-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Fire-Director Yusuf Kaya, Artillery faction, principled good, devoted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: dutiful attention: brows level, a steady direct gaze, mouth at rest, posture of someone on watch.
```


**Friendly** → `content/dialog/portraits/fire-director-yusuf-kaya-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Fire-Director Yusuf Kaya, Artillery faction, principled good, devoted. Relationship: friendly, looking at someone they like and trust. New expression: solemn warmth, as to a trusted comrade: a small sincere smile, softened eyes, brows relaxed.
```


### Major Elena Ruiz · good · open-hearted · placeholder base art

Reference: `content/dialog/portraits/major-elena-ruiz.png` · personality from G primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/major-elena-ruiz-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Major Elena Ruiz, Artillery faction, good, open-hearted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: hurt more than hostile: brows pinched upward, eyes wounded and wary, mouth turned down.
```


**Neutral** → `content/dialog/portraits/major-elena-ruiz-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Major Elena Ruiz, Artillery faction, good, open-hearted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: open and curious: brows slightly raised, eyes interested, the hint of a ready smile.
```


**Friendly** → `content/dialog/portraits/major-elena-ruiz-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Major Elena Ruiz, Artillery faction, good, open-hearted. Relationship: friendly, looking at someone they like and trust. New expression: warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Spotter "Ricochet" Deacon · chaotic good · whimsical · placeholder base art

Reference: `content/dialog/portraits/spotter-ricochet-deacon.png` · personality from CG primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/spotter-ricochet-deacon-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Spotter "Ricochet" Deacon, Artillery faction, chaotic good, whimsical. Relationship: antagonistic, looking at someone they consider an enemy. New expression: mocking scorn: one brow arched high, a lopsided sneer, eyes rolling slightly.
```


**Neutral** → `content/dialog/portraits/spotter-ricochet-deacon-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Spotter "Ricochet" Deacon, Artillery faction, chaotic good, whimsical. Relationship: neutral, looking at someone they have no feelings about yet. New expression: amused detachment: a faint private smile, one brow a touch higher than the other.
```


**Friendly** → `content/dialog/portraits/spotter-ricochet-deacon-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Spotter "Ricochet" Deacon, Artillery faction, chaotic good, whimsical. Relationship: friendly, looking at someone they like and trust. New expression: delighted mischief: a wide grin, bright eyes, brows lifted as if sharing a joke.
```


### Logistician Bo Farrell · neutral · wary · placeholder base art

Reference: `content/dialog/portraits/logistician-bo-farrell.png` · personality from N primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/logistician-bo-farrell-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Logistician Bo Farrell, Artillery faction, neutral, wary. Relationship: antagonistic, looking at someone they consider an enemy. New expression: cold suspicion: eyes narrowed and sidelong, brows lowered, mouth a flat line, chin tucked.
```


**Neutral** → `content/dialog/portraits/logistician-bo-farrell-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Logistician Bo Farrell, Artillery faction, neutral, wary. Relationship: neutral, looking at someone they have no feelings about yet. New expression: guarded and unreadable: level brows, a measuring gaze, mouth at rest.
```


**Friendly** → `content/dialog/portraits/logistician-bo-farrell-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Logistician Bo Farrell, Artillery faction, neutral, wary. Relationship: friendly, looking at someone they like and trust. New expression: a reluctant, earned smile: one corner of the mouth up, eyes still watchful but softened.
```


### Warlord-Gunner Vex Marrow · chaotic evil · cruel · placeholder base art

Reference: `content/dialog/portraits/warlord-gunner-vex-marrow.png` · personality from CE primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/warlord-gunner-vex-marrow-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Warlord-Gunner Vex Marrow, Artillery faction, chaotic evil, cruel. Relationship: antagonistic, looking at someone they consider an enemy. New expression: open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head forward.
```


**Neutral** → `content/dialog/portraits/warlord-gunner-vex-marrow-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Warlord-Gunner Vex Marrow, Artillery faction, chaotic evil, cruel. Relationship: neutral, looking at someone they have no feelings about yet. New expression: bored contempt: heavy-lidded eyes, mouth slack with disinterest.
```


**Friendly** → `content/dialog/portraits/warlord-gunner-vex-marrow-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Warlord-Gunner Vex Marrow, Artillery faction, chaotic evil, cruel. Relationship: friendly, looking at someone they like and trust. New expression: a predatory grin: teeth showing, eyes bright with appetite, as to a useful tool. Keep an edge of menace even in warmth.
```


### Colonel Hargreave · evil · schemer · placeholder base art

Reference: `content/dialog/portraits/colonel-hargreave.png` · personality from E primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/colonel-hargreave-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Colonel Hargreave, Artillery faction, evil, schemer. Relationship: antagonistic, looking at someone they consider an enemy. New expression: quiet threat: a thin smile that does not reach the eyes, eyes cold and fixed, head slightly tilted.
```


**Neutral** → `content/dialog/portraits/colonel-hargreave-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Colonel Hargreave, Artillery faction, evil, schemer. Relationship: neutral, looking at someone they have no feelings about yet. New expression: polite and calculating: a pleasant mask of a smile, appraising eyes.
```


**Friendly** → `content/dialog/portraits/colonel-hargreave-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Colonel Hargreave, Artillery faction, evil, schemer. Relationship: friendly, looking at someone they like and trust. New expression: satisfied and sly: a crooked smirk, one brow raised, eyes glinting, as with a useful ally. Keep an edge of menace even in warmth.
```


### Grand-Bombardier Seline Voss · principled evil · schemer · placeholder base art

Reference: `content/dialog/portraits/grand-bombardier-seline-voss.png` · personality from PE primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/grand-bombardier-seline-voss-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Grand-Bombardier Seline Voss, Artillery faction, principled evil, schemer. Relationship: antagonistic, looking at someone they consider an enemy. New expression: quiet threat: a thin smile that does not reach the eyes, eyes cold and fixed, head slightly tilted.
```


**Neutral** → `content/dialog/portraits/grand-bombardier-seline-voss-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Grand-Bombardier Seline Voss, Artillery faction, principled evil, schemer. Relationship: neutral, looking at someone they have no feelings about yet. New expression: polite and calculating: a pleasant mask of a smile, appraising eyes.
```


**Friendly** → `content/dialog/portraits/grand-bombardier-seline-voss-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Grand-Bombardier Seline Voss, Artillery faction, principled evil, schemer. Relationship: friendly, looking at someone they like and trust. New expression: satisfied and sly: a crooked smirk, one brow raised, eyes glinting, as with a useful ally. Keep an edge of menace even in warmth.
```


### The Siegemaster · dark evil · cruel · placeholder base art

Reference: `content/dialog/portraits/the-siegemaster.png` · personality from DE primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/the-siegemaster-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Siegemaster, Artillery faction, dark evil, cruel. Relationship: antagonistic, looking at someone they consider an enemy. New expression: open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head forward.
```


**Neutral** → `content/dialog/portraits/the-siegemaster-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Siegemaster, Artillery faction, dark evil, cruel. Relationship: neutral, looking at someone they have no feelings about yet. New expression: bored contempt: heavy-lidded eyes, mouth slack with disinterest.
```


**Friendly** → `content/dialog/portraits/the-siegemaster-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Siegemaster, Artillery faction, dark evil, cruel. Relationship: friendly, looking at someone they like and trust. New expression: a predatory grin: teeth showing, eyes bright with appetite, as to a useful tool. Keep an edge of menace even in warmth.
```


## Water


### Tide-Priestess Marena · absolute good · devoted · placeholder base art

Reference: `content/dialog/portraits/tide-priestess-marena.png` · personality from AG primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/tide-priestess-marena-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Tide-Priestess Marena, Water faction, absolute good, devoted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: stern, disappointed anger, as at someone who broke faith: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/tide-priestess-marena-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Tide-Priestess Marena, Water faction, absolute good, devoted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: dutiful attention: brows level, a steady direct gaze, mouth at rest, posture of someone on watch.
```


**Friendly** → `content/dialog/portraits/tide-priestess-marena-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Tide-Priestess Marena, Water faction, absolute good, devoted. Relationship: friendly, looking at someone they like and trust. New expression: solemn warmth, as to a trusted comrade: a small sincere smile, softened eyes, brows relaxed.
```


### Chieftain Coral of the Reef-Born · principled good · devoted · placeholder base art

Reference: `content/dialog/portraits/chieftain-coral-of-the-reef-born.png` · personality from PG primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/chieftain-coral-of-the-reef-born-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Chieftain Coral of the Reef-Born, Water faction, principled good, devoted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: stern, disappointed anger, as at someone who broke faith: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/chieftain-coral-of-the-reef-born-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Chieftain Coral of the Reef-Born, Water faction, principled good, devoted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: dutiful attention: brows level, a steady direct gaze, mouth at rest, posture of someone on watch.
```


**Friendly** → `content/dialog/portraits/chieftain-coral-of-the-reef-born-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Chieftain Coral of the Reef-Born, Water faction, principled good, devoted. Relationship: friendly, looking at someone they like and trust. New expression: solemn warmth, as to a trusted comrade: a small sincere smile, softened eyes, brows relaxed.
```


### Wavecaller Nerea · good · open-hearted · placeholder base art

Reference: `content/dialog/portraits/wavecaller-nerea.png` · personality from G primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/wavecaller-nerea-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Wavecaller Nerea, Water faction, good, open-hearted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: hurt more than hostile: brows pinched upward, eyes wounded and wary, mouth turned down.
```


**Neutral** → `content/dialog/portraits/wavecaller-nerea-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Wavecaller Nerea, Water faction, good, open-hearted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: open and curious: brows slightly raised, eyes interested, the hint of a ready smile.
```


**Friendly** → `content/dialog/portraits/wavecaller-nerea-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Wavecaller Nerea, Water faction, good, open-hearted. Relationship: friendly, looking at someone they like and trust. New expression: warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Corsair Finn Saltmoor · chaotic good · whimsical · placeholder base art

Reference: `content/dialog/portraits/corsair-finn-saltmoor.png` · personality from CG primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/corsair-finn-saltmoor-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Corsair Finn Saltmoor, Water faction, chaotic good, whimsical. Relationship: antagonistic, looking at someone they consider an enemy. New expression: mocking scorn: one brow arched high, a lopsided sneer, eyes rolling slightly.
```


**Neutral** → `content/dialog/portraits/corsair-finn-saltmoor-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Corsair Finn Saltmoor, Water faction, chaotic good, whimsical. Relationship: neutral, looking at someone they have no feelings about yet. New expression: amused detachment: a faint private smile, one brow a touch higher than the other.
```


**Friendly** → `content/dialog/portraits/corsair-finn-saltmoor-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Corsair Finn Saltmoor, Water faction, chaotic good, whimsical. Relationship: friendly, looking at someone they like and trust. New expression: delighted mischief: a wide grin, bright eyes, brows lifted as if sharing a joke.
```


### Ferryman Old Brack · neutral · wary · placeholder base art

Reference: `content/dialog/portraits/ferryman-old-brack.png` · personality from N primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/ferryman-old-brack-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Ferryman Old Brack, Water faction, neutral, wary. Relationship: antagonistic, looking at someone they consider an enemy. New expression: cold suspicion: eyes narrowed and sidelong, brows lowered, mouth a flat line, chin tucked.
```


**Neutral** → `content/dialog/portraits/ferryman-old-brack-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Ferryman Old Brack, Water faction, neutral, wary. Relationship: neutral, looking at someone they have no feelings about yet. New expression: guarded and unreadable: level brows, a measuring gaze, mouth at rest.
```


**Friendly** → `content/dialog/portraits/ferryman-old-brack-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Ferryman Old Brack, Water faction, neutral, wary. Relationship: friendly, looking at someone they like and trust. New expression: a reluctant, earned smile: one corner of the mouth up, eyes still watchful but softened.
```


### Raider-Chief Drowned Kael · chaotic evil · cruel · placeholder base art

Reference: `content/dialog/portraits/raider-chief-drowned-kael.png` · personality from CE primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/raider-chief-drowned-kael-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Raider-Chief Drowned Kael, Water faction, chaotic evil, cruel. Relationship: antagonistic, looking at someone they consider an enemy. New expression: open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head forward.
```


**Neutral** → `content/dialog/portraits/raider-chief-drowned-kael-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Raider-Chief Drowned Kael, Water faction, chaotic evil, cruel. Relationship: neutral, looking at someone they have no feelings about yet. New expression: bored contempt: heavy-lidded eyes, mouth slack with disinterest.
```


**Friendly** → `content/dialog/portraits/raider-chief-drowned-kael-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Raider-Chief Drowned Kael, Water faction, chaotic evil, cruel. Relationship: friendly, looking at someone they like and trust. New expression: a predatory grin: teeth showing, eyes bright with appetite, as to a useful tool. Keep an edge of menace even in warmth.
```


### Leviathan-Binder Morgause · evil · schemer · placeholder base art

Reference: `content/dialog/portraits/leviathan-binder-morgause.png` · personality from E primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/leviathan-binder-morgause-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Leviathan-Binder Morgause, Water faction, evil, schemer. Relationship: antagonistic, looking at someone they consider an enemy. New expression: quiet threat: a thin smile that does not reach the eyes, eyes cold and fixed, head slightly tilted.
```


**Neutral** → `content/dialog/portraits/leviathan-binder-morgause-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Leviathan-Binder Morgause, Water faction, evil, schemer. Relationship: neutral, looking at someone they have no feelings about yet. New expression: polite and calculating: a pleasant mask of a smile, appraising eyes.
```


**Friendly** → `content/dialog/portraits/leviathan-binder-morgause-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Leviathan-Binder Morgause, Water faction, evil, schemer. Relationship: friendly, looking at someone they like and trust. New expression: satisfied and sly: a crooked smirk, one brow raised, eyes glinting, as with a useful ally. Keep an edge of menace even in warmth.
```


### Abyssal Sovereign Thal · principled evil · schemer · placeholder base art

Reference: `content/dialog/portraits/abyssal-sovereign-thal.png` · personality from PE primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/abyssal-sovereign-thal-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Abyssal Sovereign Thal, Water faction, principled evil, schemer. Relationship: antagonistic, looking at someone they consider an enemy. New expression: quiet threat: a thin smile that does not reach the eyes, eyes cold and fixed, head slightly tilted.
```


**Neutral** → `content/dialog/portraits/abyssal-sovereign-thal-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Abyssal Sovereign Thal, Water faction, principled evil, schemer. Relationship: neutral, looking at someone they have no feelings about yet. New expression: polite and calculating: a pleasant mask of a smile, appraising eyes.
```


**Friendly** → `content/dialog/portraits/abyssal-sovereign-thal-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Abyssal Sovereign Thal, Water faction, principled evil, schemer. Relationship: friendly, looking at someone they like and trust. New expression: satisfied and sly: a crooked smirk, one brow raised, eyes glinting, as with a useful ally. Keep an edge of menace even in warmth.
```


### The Undertow (drowned collective) · dark evil · cruel · placeholder base art

Reference: `content/dialog/portraits/the-undertow-drowned-collective.png` · personality from DE primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/the-undertow-drowned-collective-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Undertow (drowned collective), Water faction, dark evil, cruel. Relationship: antagonistic, looking at someone they consider an enemy. New expression: open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head forward.
```


**Neutral** → `content/dialog/portraits/the-undertow-drowned-collective-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Undertow (drowned collective), Water faction, dark evil, cruel. Relationship: neutral, looking at someone they have no feelings about yet. New expression: bored contempt: heavy-lidded eyes, mouth slack with disinterest.
```


**Friendly** → `content/dialog/portraits/the-undertow-drowned-collective-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Undertow (drowned collective), Water faction, dark evil, cruel. Relationship: friendly, looking at someone they like and trust. New expression: a predatory grin: teeth showing, eyes bright with appetite, as to a useful tool. Keep an edge of menace even in warmth.
```


## Arcane / Energy


### Hierophant Aurelia · absolute good · devoted · placeholder base art

Reference: `content/dialog/portraits/hierophant-aurelia.png` · personality from AG primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/hierophant-aurelia-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Hierophant Aurelia, Arcane / Energy faction, absolute good, devoted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: stern, disappointed anger, as at someone who broke faith: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/hierophant-aurelia-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Hierophant Aurelia, Arcane / Energy faction, absolute good, devoted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: dutiful attention: brows level, a steady direct gaze, mouth at rest, posture of someone on watch.
```


**Friendly** → `content/dialog/portraits/hierophant-aurelia-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Hierophant Aurelia, Arcane / Energy faction, absolute good, devoted. Relationship: friendly, looking at someone they like and trust. New expression: solemn warmth, as to a trusted comrade: a small sincere smile, softened eyes, brows relaxed.
```


### Lightbearer Cassian · principled good · devoted · placeholder base art

Reference: `content/dialog/portraits/lightbearer-cassian.png` · personality from PG primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/lightbearer-cassian-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Lightbearer Cassian, Arcane / Energy faction, principled good, devoted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: stern, disappointed anger, as at someone who broke faith: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/lightbearer-cassian-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Lightbearer Cassian, Arcane / Energy faction, principled good, devoted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: dutiful attention: brows level, a steady direct gaze, mouth at rest, posture of someone on watch.
```


**Friendly** → `content/dialog/portraits/lightbearer-cassian-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Lightbearer Cassian, Arcane / Energy faction, principled good, devoted. Relationship: friendly, looking at someone they like and trust. New expression: solemn warmth, as to a trusted comrade: a small sincere smile, softened eyes, brows relaxed.
```


### Acolyte-Scholar Wen · good · open-hearted · placeholder base art

Reference: `content/dialog/portraits/acolyte-scholar-wen.png` · personality from G primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/acolyte-scholar-wen-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Acolyte-Scholar Wen, Arcane / Energy faction, good, open-hearted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: hurt more than hostile: brows pinched upward, eyes wounded and wary, mouth turned down.
```


**Neutral** → `content/dialog/portraits/acolyte-scholar-wen-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Acolyte-Scholar Wen, Arcane / Energy faction, good, open-hearted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: open and curious: brows slightly raised, eyes interested, the hint of a ready smile.
```


**Friendly** → `content/dialog/portraits/acolyte-scholar-wen-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Acolyte-Scholar Wen, Arcane / Energy faction, good, open-hearted. Relationship: friendly, looking at someone they like and trust. New expression: warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Heretic Isolde · chaotic good · whimsical · placeholder base art

Reference: `content/dialog/portraits/heretic-isolde.png` · personality from CG primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/heretic-isolde-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Heretic Isolde, Arcane / Energy faction, chaotic good, whimsical. Relationship: antagonistic, looking at someone they consider an enemy. New expression: mocking scorn: one brow arched high, a lopsided sneer, eyes rolling slightly.
```


**Neutral** → `content/dialog/portraits/heretic-isolde-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Heretic Isolde, Arcane / Energy faction, chaotic good, whimsical. Relationship: neutral, looking at someone they have no feelings about yet. New expression: amused detachment: a faint private smile, one brow a touch higher than the other.
```


**Friendly** → `content/dialog/portraits/heretic-isolde-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Heretic Isolde, Arcane / Energy faction, chaotic good, whimsical. Relationship: friendly, looking at someone they like and trust. New expression: delighted mischief: a wide grin, bright eyes, brows lifted as if sharing a joke.
```


### Archivist Balthus · neutral · wary · placeholder base art

Reference: `content/dialog/portraits/archivist-balthus.png` · personality from N primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/archivist-balthus-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Archivist Balthus, Arcane / Energy faction, neutral, wary. Relationship: antagonistic, looking at someone they consider an enemy. New expression: cold suspicion: eyes narrowed and sidelong, brows lowered, mouth a flat line, chin tucked.
```


**Neutral** → `content/dialog/portraits/archivist-balthus-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Archivist Balthus, Arcane / Energy faction, neutral, wary. Relationship: neutral, looking at someone they have no feelings about yet. New expression: guarded and unreadable: level brows, a measuring gaze, mouth at rest.
```


**Friendly** → `content/dialog/portraits/archivist-balthus-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Archivist Balthus, Arcane / Energy faction, neutral, wary. Relationship: friendly, looking at someone they like and trust. New expression: a reluctant, earned smile: one corner of the mouth up, eyes still watchful but softened.
```


### Warlock Nyx · chaotic evil · cruel · placeholder base art

Reference: `content/dialog/portraits/warlock-nyx.png` · personality from CE primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/warlock-nyx-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Warlock Nyx, Arcane / Energy faction, chaotic evil, cruel. Relationship: antagonistic, looking at someone they consider an enemy. New expression: open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head forward.
```


**Neutral** → `content/dialog/portraits/warlock-nyx-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Warlock Nyx, Arcane / Energy faction, chaotic evil, cruel. Relationship: neutral, looking at someone they have no feelings about yet. New expression: bored contempt: heavy-lidded eyes, mouth slack with disinterest.
```


**Friendly** → `content/dialog/portraits/warlock-nyx-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Warlock Nyx, Arcane / Energy faction, chaotic evil, cruel. Relationship: friendly, looking at someone they like and trust. New expression: a predatory grin: teeth showing, eyes bright with appetite, as to a useful tool. Keep an edge of menace even in warmth.
```


### Inquisitor Mordane · evil · schemer · placeholder base art

Reference: `content/dialog/portraits/inquisitor-mordane.png` · personality from E primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/inquisitor-mordane-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Inquisitor Mordane, Arcane / Energy faction, evil, schemer. Relationship: antagonistic, looking at someone they consider an enemy. New expression: quiet threat: a thin smile that does not reach the eyes, eyes cold and fixed, head slightly tilted.
```


**Neutral** → `content/dialog/portraits/inquisitor-mordane-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Inquisitor Mordane, Arcane / Energy faction, evil, schemer. Relationship: neutral, looking at someone they have no feelings about yet. New expression: polite and calculating: a pleasant mask of a smile, appraising eyes.
```


**Friendly** → `content/dialog/portraits/inquisitor-mordane-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Inquisitor Mordane, Arcane / Energy faction, evil, schemer. Relationship: friendly, looking at someone they like and trust. New expression: satisfied and sly: a crooked smirk, one brow raised, eyes glinting, as with a useful ally. Keep an edge of menace even in warmth.
```


### The Ordained Prime, Vaelith · principled evil · schemer · placeholder base art

Reference: `content/dialog/portraits/the-ordained-prime-vaelith.png` · personality from PE primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/the-ordained-prime-vaelith-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Ordained Prime, Vaelith, Arcane / Energy faction, principled evil, schemer. Relationship: antagonistic, looking at someone they consider an enemy. New expression: quiet threat: a thin smile that does not reach the eyes, eyes cold and fixed, head slightly tilted.
```


**Neutral** → `content/dialog/portraits/the-ordained-prime-vaelith-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Ordained Prime, Vaelith, Arcane / Energy faction, principled evil, schemer. Relationship: neutral, looking at someone they have no feelings about yet. New expression: polite and calculating: a pleasant mask of a smile, appraising eyes.
```


**Friendly** → `content/dialog/portraits/the-ordained-prime-vaelith-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Ordained Prime, Vaelith, Arcane / Energy faction, principled evil, schemer. Relationship: friendly, looking at someone they like and trust. New expression: satisfied and sly: a crooked smirk, one brow raised, eyes glinting, as with a useful ally. Keep an edge of menace even in warmth.
```


### The Unmade Choir · dark evil · cruel · placeholder base art

Reference: `content/dialog/portraits/the-unmade-choir.png` · personality from DE primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/the-unmade-choir-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Unmade Choir, Arcane / Energy faction, dark evil, cruel. Relationship: antagonistic, looking at someone they consider an enemy. New expression: open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head forward.
```


**Neutral** → `content/dialog/portraits/the-unmade-choir-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Unmade Choir, Arcane / Energy faction, dark evil, cruel. Relationship: neutral, looking at someone they have no feelings about yet. New expression: bored contempt: heavy-lidded eyes, mouth slack with disinterest.
```


**Friendly** → `content/dialog/portraits/the-unmade-choir-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Unmade Choir, Arcane / Energy faction, dark evil, cruel. Relationship: friendly, looking at someone they like and trust. New expression: a predatory grin: teeth showing, eyes bright with appetite, as to a useful tool. Keep an edge of menace even in warmth.
```


## Space Tech


### Envoy Lyra-9 · absolute good · devoted · placeholder base art

Reference: `content/dialog/portraits/envoy-lyra-9.png` · personality from AG primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/envoy-lyra-9-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Envoy Lyra-9, Space Tech faction, absolute good, devoted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: stern, disappointed anger, as at someone who broke faith: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/envoy-lyra-9-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Envoy Lyra-9, Space Tech faction, absolute good, devoted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: dutiful attention: brows level, a steady direct gaze, mouth at rest, posture of someone on watch.
```


**Friendly** → `content/dialog/portraits/envoy-lyra-9-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Envoy Lyra-9, Space Tech faction, absolute good, devoted. Relationship: friendly, looking at someone they like and trust. New expression: solemn warmth, as to a trusted comrade: a small sincere smile, softened eyes, brows relaxed.
```


### Commander Idris Vale · principled good · devoted · placeholder base art

Reference: `content/dialog/portraits/commander-idris-vale.png` · personality from PG primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/commander-idris-vale-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Commander Idris Vale, Space Tech faction, principled good, devoted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: stern, disappointed anger, as at someone who broke faith: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/commander-idris-vale-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Commander Idris Vale, Space Tech faction, principled good, devoted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: dutiful attention: brows level, a steady direct gaze, mouth at rest, posture of someone on watch.
```


**Friendly** → `content/dialog/portraits/commander-idris-vale-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Commander Idris Vale, Space Tech faction, principled good, devoted. Relationship: friendly, looking at someone they like and trust. New expression: solemn warmth, as to a trusted comrade: a small sincere smile, softened eyes, brows relaxed.
```


### Science-Officer Tovah · good · open-hearted · placeholder base art

Reference: `content/dialog/portraits/science-officer-tovah.png` · personality from G primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/science-officer-tovah-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Science-Officer Tovah, Space Tech faction, good, open-hearted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: hurt more than hostile: brows pinched upward, eyes wounded and wary, mouth turned down.
```


**Neutral** → `content/dialog/portraits/science-officer-tovah-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Science-Officer Tovah, Space Tech faction, good, open-hearted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: open and curious: brows slightly raised, eyes interested, the hint of a ready smile.
```


**Friendly** → `content/dialog/portraits/science-officer-tovah-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Science-Officer Tovah, Space Tech faction, good, open-hearted. Relationship: friendly, looking at someone they like and trust. New expression: warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Cadet-Prodigy Ezra "Comet" Lin · chaotic good · whimsical · placeholder base art

Reference: `content/dialog/portraits/cadet-prodigy-ezra-comet-lin.png` · personality from CG primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/cadet-prodigy-ezra-comet-lin-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Cadet-Prodigy Ezra "Comet" Lin, Space Tech faction, chaotic good, whimsical. Relationship: antagonistic, looking at someone they consider an enemy. New expression: mocking scorn: one brow arched high, a lopsided sneer, eyes rolling slightly.
```


**Neutral** → `content/dialog/portraits/cadet-prodigy-ezra-comet-lin-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Cadet-Prodigy Ezra "Comet" Lin, Space Tech faction, chaotic good, whimsical. Relationship: neutral, looking at someone they have no feelings about yet. New expression: amused detachment: a faint private smile, one brow a touch higher than the other.
```


**Friendly** → `content/dialog/portraits/cadet-prodigy-ezra-comet-lin-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Cadet-Prodigy Ezra "Comet" Lin, Space Tech faction, chaotic good, whimsical. Relationship: friendly, looking at someone they like and trust. New expression: delighted mischief: a wide grin, bright eyes, brows lifted as if sharing a joke.
```


### Navigator AI "Vector" · neutral · wary · placeholder base art

Reference: `content/dialog/portraits/navigator-ai-vector.png` · personality from N primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/navigator-ai-vector-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Navigator AI "Vector", Space Tech faction, neutral, wary. Relationship: antagonistic, looking at someone they consider an enemy. New expression: cold suspicion: eyes narrowed and sidelong, brows lowered, mouth a flat line, chin tucked.
```


**Neutral** → `content/dialog/portraits/navigator-ai-vector-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Navigator AI "Vector", Space Tech faction, neutral, wary. Relationship: neutral, looking at someone they have no feelings about yet. New expression: guarded and unreadable: level brows, a measuring gaze, mouth at rest.
```


**Friendly** → `content/dialog/portraits/navigator-ai-vector-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Navigator AI "Vector", Space Tech faction, neutral, wary. Relationship: friendly, looking at someone they like and trust. New expression: a reluctant, earned smile: one corner of the mouth up, eyes still watchful but softened.
```


### Privateer Rax Dune · chaotic evil · cruel · placeholder base art

Reference: `content/dialog/portraits/privateer-rax-dune.png` · personality from CE primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/privateer-rax-dune-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Privateer Rax Dune, Space Tech faction, chaotic evil, cruel. Relationship: antagonistic, looking at someone they consider an enemy. New expression: open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head forward.
```


**Neutral** → `content/dialog/portraits/privateer-rax-dune-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Privateer Rax Dune, Space Tech faction, chaotic evil, cruel. Relationship: neutral, looking at someone they have no feelings about yet. New expression: bored contempt: heavy-lidded eyes, mouth slack with disinterest.
```


**Friendly** → `content/dialog/portraits/privateer-rax-dune-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Privateer Rax Dune, Space Tech faction, chaotic evil, cruel. Relationship: friendly, looking at someone they like and trust. New expression: a predatory grin: teeth showing, eyes bright with appetite, as to a useful tool. Keep an edge of menace even in warmth.
```


### Admiral Sarn · evil · schemer · placeholder base art

Reference: `content/dialog/portraits/admiral-sarn.png` · personality from E primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/admiral-sarn-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Admiral Sarn, Space Tech faction, evil, schemer. Relationship: antagonistic, looking at someone they consider an enemy. New expression: quiet threat: a thin smile that does not reach the eyes, eyes cold and fixed, head slightly tilted.
```


**Neutral** → `content/dialog/portraits/admiral-sarn-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Admiral Sarn, Space Tech faction, evil, schemer. Relationship: neutral, looking at someone they have no feelings about yet. New expression: polite and calculating: a pleasant mask of a smile, appraising eyes.
```


**Friendly** → `content/dialog/portraits/admiral-sarn-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Admiral Sarn, Space Tech faction, evil, schemer. Relationship: friendly, looking at someone they like and trust. New expression: satisfied and sly: a crooked smirk, one brow raised, eyes glinting, as with a useful ally. Keep an edge of menace even in warmth.
```


### Grand-Cartographer Ophir · principled evil · schemer · placeholder base art

Reference: `content/dialog/portraits/grand-cartographer-ophir.png` · personality from PE primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/grand-cartographer-ophir-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Grand-Cartographer Ophir, Space Tech faction, principled evil, schemer. Relationship: antagonistic, looking at someone they consider an enemy. New expression: quiet threat: a thin smile that does not reach the eyes, eyes cold and fixed, head slightly tilted.
```


**Neutral** → `content/dialog/portraits/grand-cartographer-ophir-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Grand-Cartographer Ophir, Space Tech faction, principled evil, schemer. Relationship: neutral, looking at someone they have no feelings about yet. New expression: polite and calculating: a pleasant mask of a smile, appraising eyes.
```


**Friendly** → `content/dialog/portraits/grand-cartographer-ophir-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Grand-Cartographer Ophir, Space Tech faction, principled evil, schemer. Relationship: friendly, looking at someone they like and trust. New expression: satisfied and sly: a crooked smirk, one brow raised, eyes glinting, as with a useful ally. Keep an edge of menace even in warmth.
```


### The Signal · dark evil · cruel · placeholder base art

Reference: `content/dialog/portraits/the-signal.png` · personality from DE primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/the-signal-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Signal, Space Tech faction, dark evil, cruel. Relationship: antagonistic, looking at someone they consider an enemy. New expression: open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head forward.
```


**Neutral** → `content/dialog/portraits/the-signal-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Signal, Space Tech faction, dark evil, cruel. Relationship: neutral, looking at someone they have no feelings about yet. New expression: bored contempt: heavy-lidded eyes, mouth slack with disinterest.
```


**Friendly** → `content/dialog/portraits/the-signal-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Signal, Space Tech faction, dark evil, cruel. Relationship: friendly, looking at someone they like and trust. New expression: a predatory grin: teeth showing, eyes bright with appetite, as to a useful tool. Keep an edge of menace even in warmth.
```


## Dark Energy


### The Reformer Elias · absolute good · devoted · placeholder base art

Reference: `content/dialog/portraits/the-reformer-elias.png` · personality from AG primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/the-reformer-elias-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Reformer Elias, Dark Energy faction, absolute good, devoted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: stern, disappointed anger, as at someone who broke faith: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/the-reformer-elias-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Reformer Elias, Dark Energy faction, absolute good, devoted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: dutiful attention: brows level, a steady direct gaze, mouth at rest, posture of someone on watch.
```


**Friendly** → `content/dialog/portraits/the-reformer-elias-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Reformer Elias, Dark Energy faction, absolute good, devoted. Relationship: friendly, looking at someone they like and trust. New expression: solemn warmth, as to a trusted comrade: a small sincere smile, softened eyes, brows relaxed.
```


### Sister Maren · principled good · devoted · placeholder base art

Reference: `content/dialog/portraits/sister-maren.png` · personality from PG primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/sister-maren-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Sister Maren, Dark Energy faction, principled good, devoted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: stern, disappointed anger, as at someone who broke faith: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/sister-maren-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Sister Maren, Dark Energy faction, principled good, devoted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: dutiful attention: brows level, a steady direct gaze, mouth at rest, posture of someone on watch.
```


**Friendly** → `content/dialog/portraits/sister-maren-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Sister Maren, Dark Energy faction, principled good, devoted. Relationship: friendly, looking at someone they like and trust. New expression: solemn warmth, as to a trusted comrade: a small sincere smile, softened eyes, brows relaxed.
```


### Organizer Tomas · good · open-hearted · placeholder base art

Reference: `content/dialog/portraits/organizer-tomas.png` · personality from G primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/organizer-tomas-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Organizer Tomas, Dark Energy faction, good, open-hearted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: hurt more than hostile: brows pinched upward, eyes wounded and wary, mouth turned down.
```


**Neutral** → `content/dialog/portraits/organizer-tomas-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Organizer Tomas, Dark Energy faction, good, open-hearted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: open and curious: brows slightly raised, eyes interested, the hint of a ready smile.
```


**Friendly** → `content/dialog/portraits/organizer-tomas-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Organizer Tomas, Dark Energy faction, good, open-hearted. Relationship: friendly, looking at someone they like and trust. New expression: warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Firebrand Lux · chaotic good · whimsical · placeholder base art

Reference: `content/dialog/portraits/firebrand-lux.png` · personality from CG primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/firebrand-lux-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Firebrand Lux, Dark Energy faction, chaotic good, whimsical. Relationship: antagonistic, looking at someone they consider an enemy. New expression: mocking scorn: one brow arched high, a lopsided sneer, eyes rolling slightly.
```


**Neutral** → `content/dialog/portraits/firebrand-lux-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Firebrand Lux, Dark Energy faction, chaotic good, whimsical. Relationship: neutral, looking at someone they have no feelings about yet. New expression: amused detachment: a faint private smile, one brow a touch higher than the other.
```


**Friendly** → `content/dialog/portraits/firebrand-lux-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Firebrand Lux, Dark Energy faction, chaotic good, whimsical. Relationship: friendly, looking at someone they like and trust. New expression: delighted mischief: a wide grin, bright eyes, brows lifted as if sharing a joke.
```


### Doctrinist Vera · neutral · wary · placeholder base art

Reference: `content/dialog/portraits/doctrinist-vera.png` · personality from N primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/doctrinist-vera-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Doctrinist Vera, Dark Energy faction, neutral, wary. Relationship: antagonistic, looking at someone they consider an enemy. New expression: cold suspicion: eyes narrowed and sidelong, brows lowered, mouth a flat line, chin tucked.
```


**Neutral** → `content/dialog/portraits/doctrinist-vera-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Doctrinist Vera, Dark Energy faction, neutral, wary. Relationship: neutral, looking at someone they have no feelings about yet. New expression: guarded and unreadable: level brows, a measuring gaze, mouth at rest.
```


**Friendly** → `content/dialog/portraits/doctrinist-vera-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Doctrinist Vera, Dark Energy faction, neutral, wary. Relationship: friendly, looking at someone they like and trust. New expression: a reluctant, earned smile: one corner of the mouth up, eyes still watchful but softened.
```


### Enforcer Grael · chaotic evil · cruel · placeholder base art

Reference: `content/dialog/portraits/enforcer-grael.png` · personality from CE primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/enforcer-grael-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Enforcer Grael, Dark Energy faction, chaotic evil, cruel. Relationship: antagonistic, looking at someone they consider an enemy. New expression: open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head forward.
```


**Neutral** → `content/dialog/portraits/enforcer-grael-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Enforcer Grael, Dark Energy faction, chaotic evil, cruel. Relationship: neutral, looking at someone they have no feelings about yet. New expression: bored contempt: heavy-lidded eyes, mouth slack with disinterest.
```


**Friendly** → `content/dialog/portraits/enforcer-grael-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Enforcer Grael, Dark Energy faction, chaotic evil, cruel. Relationship: friendly, looking at someone they like and trust. New expression: a predatory grin: teeth showing, eyes bright with appetite, as to a useful tool. Keep an edge of menace even in warmth.
```


### The Vanguard, Corin · evil · schemer · placeholder base art

Reference: `content/dialog/portraits/the-vanguard-corin.png` · personality from E primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/the-vanguard-corin-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Vanguard, Corin, Dark Energy faction, evil, schemer. Relationship: antagonistic, looking at someone they consider an enemy. New expression: quiet threat: a thin smile that does not reach the eyes, eyes cold and fixed, head slightly tilted.
```


**Neutral** → `content/dialog/portraits/the-vanguard-corin-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Vanguard, Corin, Dark Energy faction, evil, schemer. Relationship: neutral, looking at someone they have no feelings about yet. New expression: polite and calculating: a pleasant mask of a smile, appraising eyes.
```


**Friendly** → `content/dialog/portraits/the-vanguard-corin-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Vanguard, Corin, Dark Energy faction, evil, schemer. Relationship: friendly, looking at someone they like and trust. New expression: satisfied and sly: a crooked smirk, one brow raised, eyes glinting, as with a useful ally. Keep an edge of menace even in warmth.
```


### The Architect, Malis · principled evil · schemer · placeholder base art

Reference: `content/dialog/portraits/the-architect-malis.png` · personality from PE primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/the-architect-malis-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Architect, Malis, Dark Energy faction, principled evil, schemer. Relationship: antagonistic, looking at someone they consider an enemy. New expression: quiet threat: a thin smile that does not reach the eyes, eyes cold and fixed, head slightly tilted.
```


**Neutral** → `content/dialog/portraits/the-architect-malis-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Architect, Malis, Dark Energy faction, principled evil, schemer. Relationship: neutral, looking at someone they have no feelings about yet. New expression: polite and calculating: a pleasant mask of a smile, appraising eyes.
```


**Friendly** → `content/dialog/portraits/the-architect-malis-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Architect, Malis, Dark Energy faction, principled evil, schemer. Relationship: friendly, looking at someone they like and trust. New expression: satisfied and sly: a crooked smirk, one brow raised, eyes glinting, as with a useful ally. Keep an edge of menace even in warmth.
```


### The Hollow Prophet · dark evil · cruel · placeholder base art

Reference: `content/dialog/portraits/the-hollow-prophet.png` · personality from DE primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/the-hollow-prophet-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Hollow Prophet, Dark Energy faction, dark evil, cruel. Relationship: antagonistic, looking at someone they consider an enemy. New expression: open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head forward.
```


**Neutral** → `content/dialog/portraits/the-hollow-prophet-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Hollow Prophet, Dark Energy faction, dark evil, cruel. Relationship: neutral, looking at someone they have no feelings about yet. New expression: bored contempt: heavy-lidded eyes, mouth slack with disinterest.
```


**Friendly** → `content/dialog/portraits/the-hollow-prophet-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Hollow Prophet, Dark Energy faction, dark evil, cruel. Relationship: friendly, looking at someone they like and trust. New expression: a predatory grin: teeth showing, eyes bright with appetite, as to a useful tool. Keep an edge of menace even in warmth.
```


## Greenies (Chem)


### Mother-Spore Ilya · absolute good · devoted

Reference: `content/dialog/portraits/mother-spore-ilya.png` · personality from AG primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/mother-spore-ilya-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Mother-Spore Ilya, Greenies (Chem) faction, absolute good, devoted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: stern, disappointed anger, as at someone who broke faith: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/mother-spore-ilya-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Mother-Spore Ilya, Greenies (Chem) faction, absolute good, devoted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: dutiful attention: brows level, a steady direct gaze, mouth at rest, posture of someone on watch.
```


**Friendly** → `content/dialog/portraits/mother-spore-ilya-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Mother-Spore Ilya, Greenies (Chem) faction, absolute good, devoted. Relationship: friendly, looking at someone they like and trust. New expression: solemn warmth, as to a trusted comrade: a small sincere smile, softened eyes, brows relaxed.
```


### Steward Bractus · principled good · devoted

Reference: `content/dialog/portraits/steward-bractus.png` · personality from PG primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/steward-bractus-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Steward Bractus, Greenies (Chem) faction, principled good, devoted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: stern, disappointed anger, as at someone who broke faith: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/steward-bractus-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Steward Bractus, Greenies (Chem) faction, principled good, devoted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: dutiful attention: brows level, a steady direct gaze, mouth at rest, posture of someone on watch.
```


**Friendly** → `content/dialog/portraits/steward-bractus-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Steward Bractus, Greenies (Chem) faction, principled good, devoted. Relationship: friendly, looking at someone they like and trust. New expression: solemn warmth, as to a trusted comrade: a small sincere smile, softened eyes, brows relaxed.
```


### Delegate Fenn · good · open-hearted

Reference: `content/dialog/portraits/delegate-fenn.png` · personality from G primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/delegate-fenn-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Delegate Fenn, Greenies (Chem) faction, good, open-hearted. Relationship: antagonistic, looking at someone they consider an enemy. New expression: hurt more than hostile: brows pinched upward, eyes wounded and wary, mouth turned down.
```


**Neutral** → `content/dialog/portraits/delegate-fenn-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Delegate Fenn, Greenies (Chem) faction, good, open-hearted. Relationship: neutral, looking at someone they have no feelings about yet. New expression: open and curious: brows slightly raised, eyes interested, the hint of a ready smile.
```


**Friendly** → `content/dialog/portraits/delegate-fenn-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Delegate Fenn, Greenies (Chem) faction, good, open-hearted. Relationship: friendly, looking at someone they like and trust. New expression: warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Splinter "Wildseed" Ovo · chaotic good · whimsical

Reference: `content/dialog/portraits/splinter-wildseed-ovo.png` · personality from CG primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/splinter-wildseed-ovo-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Splinter "Wildseed" Ovo, Greenies (Chem) faction, chaotic good, whimsical. Relationship: antagonistic, looking at someone they consider an enemy. New expression: mocking scorn: one brow arched high, a lopsided sneer, eyes rolling slightly.
```


**Neutral** → `content/dialog/portraits/splinter-wildseed-ovo-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Splinter "Wildseed" Ovo, Greenies (Chem) faction, chaotic good, whimsical. Relationship: neutral, looking at someone they have no feelings about yet. New expression: amused detachment: a faint private smile, one brow a touch higher than the other.
```


**Friendly** → `content/dialog/portraits/splinter-wildseed-ovo-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Splinter "Wildseed" Ovo, Greenies (Chem) faction, chaotic good, whimsical. Relationship: friendly, looking at someone they like and trust. New expression: delighted mischief: a wide grin, bright eyes, brows lifted as if sharing a joke.
```


### Composter Null-7 · neutral · wary

Reference: `content/dialog/portraits/composter-null-7.png` · personality from N primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/composter-null-7-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Composter Null-7, Greenies (Chem) faction, neutral, wary. Relationship: antagonistic, looking at someone they consider an enemy. New expression: cold suspicion: eyes narrowed and sidelong, brows lowered, mouth a flat line, chin tucked.
```


**Neutral** → `content/dialog/portraits/composter-null-7-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Composter Null-7, Greenies (Chem) faction, neutral, wary. Relationship: neutral, looking at someone they have no feelings about yet. New expression: guarded and unreadable: level brows, a measuring gaze, mouth at rest.
```


**Friendly** → `content/dialog/portraits/composter-null-7-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Composter Null-7, Greenies (Chem) faction, neutral, wary. Relationship: friendly, looking at someone they like and trust. New expression: a reluctant, earned smile: one corner of the mouth up, eyes still watchful but softened.
```


### Blight-Agitator Sear · chaotic evil · cruel

Reference: `content/dialog/portraits/blight-agitator-sear.png` · personality from CE primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/blight-agitator-sear-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Blight-Agitator Sear, Greenies (Chem) faction, chaotic evil, cruel. Relationship: antagonistic, looking at someone they consider an enemy. New expression: open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head forward.
```


**Neutral** → `content/dialog/portraits/blight-agitator-sear-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Blight-Agitator Sear, Greenies (Chem) faction, chaotic evil, cruel. Relationship: neutral, looking at someone they have no feelings about yet. New expression: bored contempt: heavy-lidded eyes, mouth slack with disinterest.
```


**Friendly** → `content/dialog/portraits/blight-agitator-sear-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Blight-Agitator Sear, Greenies (Chem) faction, chaotic evil, cruel. Relationship: friendly, looking at someone they like and trust. New expression: a predatory grin: teeth showing, eyes bright with appetite, as to a useful tool. Keep an edge of menace even in warmth.
```


### Overseer Thax · evil · schemer · placeholder base art

Reference: `content/dialog/portraits/overseer-thax.png` · personality from E primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/overseer-thax-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Overseer Thax, Greenies (Chem) faction, evil, schemer. Relationship: antagonistic, looking at someone they consider an enemy. New expression: quiet threat: a thin smile that does not reach the eyes, eyes cold and fixed, head slightly tilted.
```


**Neutral** → `content/dialog/portraits/overseer-thax-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Overseer Thax, Greenies (Chem) faction, evil, schemer. Relationship: neutral, looking at someone they have no feelings about yet. New expression: polite and calculating: a pleasant mask of a smile, appraising eyes.
```


**Friendly** → `content/dialog/portraits/overseer-thax-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is Overseer Thax, Greenies (Chem) faction, evil, schemer. Relationship: friendly, looking at someone they like and trust. New expression: satisfied and sly: a crooked smirk, one brow raised, eyes glinting, as with a useful ally. Keep an edge of menace even in warmth.
```


### The Root-Mind · principled evil · schemer

Reference: `content/dialog/portraits/the-root-mind.png` · personality from PE primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/the-root-mind-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Root-Mind, Greenies (Chem) faction, principled evil, schemer. Relationship: antagonistic, looking at someone they consider an enemy. New expression: quiet threat: a thin smile that does not reach the eyes, eyes cold and fixed, head slightly tilted.
```


**Neutral** → `content/dialog/portraits/the-root-mind-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Root-Mind, Greenies (Chem) faction, principled evil, schemer. Relationship: neutral, looking at someone they have no feelings about yet. New expression: polite and calculating: a pleasant mask of a smile, appraising eyes.
```


**Friendly** → `content/dialog/portraits/the-root-mind-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Root-Mind, Greenies (Chem) faction, principled evil, schemer. Relationship: friendly, looking at someone they like and trust. New expression: satisfied and sly: a crooked smirk, one brow raised, eyes glinting, as with a useful ally. Keep an edge of menace even in warmth.
```


### The Rot · dark evil · cruel · 1024×1024, not 864×1152

Reference: `content/dialog/portraits/the-rot.png` · personality from DE primary (Character-System §4)


**Antagonistic** → `content/dialog/portraits/the-rot-antagonistic.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Rot, Greenies (Chem) faction, dark evil, cruel. Relationship: antagonistic, looking at someone they consider an enemy. New expression: open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head forward.
```


**Neutral** → `content/dialog/portraits/the-rot-neutral.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Rot, Greenies (Chem) faction, dark evil, cruel. Relationship: neutral, looking at someone they have no feelings about yet. New expression: bored contempt: heavy-lidded eyes, mouth slack with disinterest.
```


**Friendly** → `content/dialog/portraits/the-rot-friendly.png` (missing)

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152), saved as PNG. No text, no letters, no border. The character is The Rot, Greenies (Chem) faction, dark evil, cruel. Relationship: friendly, looking at someone they like and trust. New expression: a predatory grin: teeth showing, eyes bright with appetite, as to a useful tool. Keep an edge of menace even in warmth.
```
