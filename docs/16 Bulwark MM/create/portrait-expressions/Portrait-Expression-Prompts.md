# Character expression portraits (prompts)

Owner 2026-11-09: "We should make additional portraits that show angry, neutral, and happy expressions". Three per character, 243 in all. Each prompt **edits the character's existing portrait**: attach `content/dialog/portraits/<slug>.png` as the reference image, paste the prompt, and save the result under the file name shown (864 × 1152 PNG).

**To switch a character on:** commit its three files, then add its slug to `prototype/test-game/src/data/portraitMoods.js` (`portraitMoods.test.mjs` checks the files are there). The game then shows angry when the player is Wary or Hostile with them, happy when Friendly or Trusted, neutral otherwise.

Characters marked **placeholder** still have a placeholder base portrait: make the final portrait first, then these.

**Shared instruction (inside every prompt):** Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border.


## Ground / Powder


### Field-Marshal Seraphine von Halbrecht · absolute good

Reference: `content/dialog/portraits/field-marshal-seraphine-von-halbrecht.png`


**Angry** → `content/dialog/portraits/field-marshal-seraphine-von-halbrecht-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Field-Marshal Seraphine von Halbrecht, Ground / Powder faction, absolute good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/field-marshal-seraphine-von-halbrecht-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Field-Marshal Seraphine von Halbrecht, Ground / Powder faction, absolute good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/field-marshal-seraphine-von-halbrecht-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Field-Marshal Seraphine von Halbrecht, Ground / Powder faction, absolute good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Colonel Aldric Vane · principled good

Reference: `content/dialog/portraits/colonel-aldric-vane.png`


**Angry** → `content/dialog/portraits/colonel-aldric-vane-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Colonel Aldric Vane, Ground / Powder faction, principled good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/colonel-aldric-vane-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Colonel Aldric Vane, Ground / Powder faction, principled good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/colonel-aldric-vane-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Colonel Aldric Vane, Ground / Powder faction, principled good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Captain Otto von Halbrecht · good

Reference: `content/dialog/portraits/captain-otto-von-halbrecht.png`


**Angry** → `content/dialog/portraits/captain-otto-von-halbrecht-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Captain Otto von Halbrecht, Ground / Powder faction, good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/captain-otto-von-halbrecht-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Captain Otto von Halbrecht, Ground / Powder faction, good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/captain-otto-von-halbrecht-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Captain Otto von Halbrecht, Ground / Powder faction, good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Sergeant "Bricks" Malloy · chaotic good

Reference: `content/dialog/portraits/sergeant-bricks-malloy.png`


**Angry** → `content/dialog/portraits/sergeant-bricks-malloy-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Sergeant "Bricks" Malloy, Ground / Powder faction, chaotic good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/sergeant-bricks-malloy-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Sergeant "Bricks" Malloy, Ground / Powder faction, chaotic good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/sergeant-bricks-malloy-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Sergeant "Bricks" Malloy, Ground / Powder faction, chaotic good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Quartermaster Ines Roth · neutral

Reference: `content/dialog/portraits/quartermaster-ines-roth.png`


**Angry** → `content/dialog/portraits/quartermaster-ines-roth-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Quartermaster Ines Roth, Ground / Powder faction, neutral. New expression (angry): cold irritation: brows lowered, eyes narrowed, a tight frown, nostrils slightly flared.
```


**Neutral** → `content/dialog/portraits/quartermaster-ines-roth-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Quartermaster Ines Roth, Ground / Powder faction, neutral. New expression (neutral): composed and unreadable: relaxed brows, steady gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/quartermaster-ines-roth-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Quartermaster Ines Roth, Ground / Powder faction, neutral. New expression (happy): quiet approval: a small closed-mouth smile, softened eyes.
```


### Freikorps raider Grigor Vosk · chaotic evil

Reference: `content/dialog/portraits/freikorps-raider-grigor-vosk.png`


**Angry** → `content/dialog/portraits/freikorps-raider-grigor-vosk-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Freikorps raider Grigor Vosk, Ground / Powder faction, chaotic evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/freikorps-raider-grigor-vosk-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Freikorps raider Grigor Vosk, Ground / Powder faction, chaotic evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/freikorps-raider-grigor-vosk-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Freikorps raider Grigor Vosk, Ground / Powder faction, chaotic evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### General Kord Stahl · evil

Reference: `content/dialog/portraits/general-kord-stahl.png`


**Angry** → `content/dialog/portraits/general-kord-stahl-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is General Kord Stahl, Ground / Powder faction, evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/general-kord-stahl-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is General Kord Stahl, Ground / Powder faction, evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/general-kord-stahl-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is General Kord Stahl, Ground / Powder faction, evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### Chancellor Wilhelmina Graf · principled evil

Reference: `content/dialog/portraits/chancellor-wilhelmina-graf.png`


**Angry** → `content/dialog/portraits/chancellor-wilhelmina-graf-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Chancellor Wilhelmina Graf, Ground / Powder faction, principled evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/chancellor-wilhelmina-graf-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Chancellor Wilhelmina Graf, Ground / Powder faction, principled evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/chancellor-wilhelmina-graf-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Chancellor Wilhelmina Graf, Ground / Powder faction, principled evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### The Iron Regent (masked) · dark evil

Reference: `content/dialog/portraits/the-iron-regent-masked.png`


**Angry** → `content/dialog/portraits/the-iron-regent-masked-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Iron Regent (masked), Ground / Powder faction, dark evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/the-iron-regent-masked-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Iron Regent (masked), Ground / Powder faction, dark evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/the-iron-regent-masked-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Iron Regent (masked), Ground / Powder faction, dark evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


## Air


### Squadron-Mother Hikari "Dawnwing" Aoi · absolute good

Reference: `content/dialog/portraits/squadron-mother-hikari-dawnwing-aoi.png`


**Angry** → `content/dialog/portraits/squadron-mother-hikari-dawnwing-aoi-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Squadron-Mother Hikari "Dawnwing" Aoi, Air faction, absolute good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/squadron-mother-hikari-dawnwing-aoi-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Squadron-Mother Hikari "Dawnwing" Aoi, Air faction, absolute good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/squadron-mother-hikari-dawnwing-aoi-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Squadron-Mother Hikari "Dawnwing" Aoi, Air faction, absolute good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Ace Jun "Halo" Sato · principled good

Reference: `content/dialog/portraits/ace-jun-halo-sato.png`


**Angry** → `content/dialog/portraits/ace-jun-halo-sato-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Ace Jun "Halo" Sato, Air faction, principled good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/ace-jun-halo-sato-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Ace Jun "Halo" Sato, Air faction, principled good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/ace-jun-halo-sato-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Ace Jun "Halo" Sato, Air faction, principled good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Rei "Skylark" Tanaka · good · placeholder

Reference: `content/dialog/portraits/rei-skylark-tanaka.png`


**Angry** → `content/dialog/portraits/rei-skylark-tanaka-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Rei "Skylark" Tanaka, Air faction, good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/rei-skylark-tanaka-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Rei "Skylark" Tanaka, Air faction, good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/rei-skylark-tanaka-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Rei "Skylark" Tanaka, Air faction, good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Kaito "Rogue" Minami · chaotic good

Reference: `content/dialog/portraits/kaito-rogue-minami.png`


**Angry** → `content/dialog/portraits/kaito-rogue-minami-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Kaito "Rogue" Minami, Air faction, chaotic good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/kaito-rogue-minami-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Kaito "Rogue" Minami, Air faction, chaotic good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/kaito-rogue-minami-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Kaito "Rogue" Minami, Air faction, chaotic good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Mechanic Sora Ito · neutral

Reference: `content/dialog/portraits/mechanic-sora-ito.png`


**Angry** → `content/dialog/portraits/mechanic-sora-ito-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Mechanic Sora Ito, Air faction, neutral. New expression (angry): cold irritation: brows lowered, eyes narrowed, a tight frown, nostrils slightly flared.
```


**Neutral** → `content/dialog/portraits/mechanic-sora-ito-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Mechanic Sora Ito, Air faction, neutral. New expression (neutral): composed and unreadable: relaxed brows, steady gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/mechanic-sora-ito-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Mechanic Sora Ito, Air faction, neutral. New expression (happy): quiet approval: a small closed-mouth smile, softened eyes.
```


### Renegade "Viper" Ryu · chaotic evil

Reference: `content/dialog/portraits/renegade-viper-ryu.png`


**Angry** → `content/dialog/portraits/renegade-viper-ryu-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Renegade "Viper" Ryu, Air faction, chaotic evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/renegade-viper-ryu-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Renegade "Viper" Ryu, Air faction, chaotic evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/renegade-viper-ryu-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Renegade "Viper" Ryu, Air faction, chaotic evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### Wing-Commander Garret "Ash" Kowalski · evil

Reference: `content/dialog/portraits/wing-commander-garret-ash-kowalski.png`


**Angry** → `content/dialog/portraits/wing-commander-garret-ash-kowalski-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Wing-Commander Garret "Ash" Kowalski, Air faction, evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/wing-commander-garret-ash-kowalski-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Wing-Commander Garret "Ash" Kowalski, Air faction, evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/wing-commander-garret-ash-kowalski-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Wing-Commander Garret "Ash" Kowalski, Air faction, evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### Sky-Marshal Reiko Kurogane · principled evil

Reference: `content/dialog/portraits/sky-marshal-reiko-kurogane.png`


**Angry** → `content/dialog/portraits/sky-marshal-reiko-kurogane-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Sky-Marshal Reiko Kurogane, Air faction, principled evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/sky-marshal-reiko-kurogane-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Sky-Marshal Reiko Kurogane, Air faction, principled evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/sky-marshal-reiko-kurogane-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Sky-Marshal Reiko Kurogane, Air faction, principled evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### The Nightingale (ghost squadron) · dark evil

Reference: `content/dialog/portraits/the-nightingale-ghost-squadron.png`


**Angry** → `content/dialog/portraits/the-nightingale-ghost-squadron-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Nightingale (ghost squadron), Air faction, dark evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/the-nightingale-ghost-squadron-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Nightingale (ghost squadron), Air faction, dark evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/the-nightingale-ghost-squadron-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Nightingale (ghost squadron), Air faction, dark evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


## High Tech


### Chief Ethicist Dr. Grace Sterling · absolute good · placeholder

Reference: `content/dialog/portraits/chief-ethicist-dr-grace-sterling.png`


**Angry** → `content/dialog/portraits/chief-ethicist-dr-grace-sterling-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Chief Ethicist Dr. Grace Sterling, High Tech faction, absolute good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/chief-ethicist-dr-grace-sterling-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Chief Ethicist Dr. Grace Sterling, High Tech faction, absolute good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/chief-ethicist-dr-grace-sterling-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Chief Ethicist Dr. Grace Sterling, High Tech faction, absolute good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### R&D Lead Amara Okonkwo · principled good · placeholder

Reference: `content/dialog/portraits/r-d-lead-amara-okonkwo.png`


**Angry** → `content/dialog/portraits/r-d-lead-amara-okonkwo-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is R&D Lead Amara Okonkwo, High Tech faction, principled good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/r-d-lead-amara-okonkwo-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is R&D Lead Amara Okonkwo, High Tech faction, principled good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/r-d-lead-amara-okonkwo-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is R&D Lead Amara Okonkwo, High Tech faction, principled good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### CFO Julian Vance · good · placeholder

Reference: `content/dialog/portraits/cfo-julian-vance.png`


**Angry** → `content/dialog/portraits/cfo-julian-vance-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is CFO Julian Vance, High Tech faction, good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/cfo-julian-vance-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is CFO Julian Vance, High Tech faction, good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/cfo-julian-vance-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is CFO Julian Vance, High Tech faction, good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Hacker "Null" (Priya Nair) · chaotic good · placeholder

Reference: `content/dialog/portraits/hacker-null-priya-nair.png`


**Angry** → `content/dialog/portraits/hacker-null-priya-nair-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Hacker "Null" (Priya Nair), High Tech faction, chaotic good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/hacker-null-priya-nair-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Hacker "Null" (Priya Nair), High Tech faction, chaotic good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/hacker-null-priya-nair-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Hacker "Null" (Priya Nair), High Tech faction, chaotic good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Actuary Devlin Cho · neutral · placeholder

Reference: `content/dialog/portraits/actuary-devlin-cho.png`


**Angry** → `content/dialog/portraits/actuary-devlin-cho-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Actuary Devlin Cho, High Tech faction, neutral. New expression (angry): cold irritation: brows lowered, eyes narrowed, a tight frown, nostrils slightly flared.
```


**Neutral** → `content/dialog/portraits/actuary-devlin-cho-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Actuary Devlin Cho, High Tech faction, neutral. New expression (neutral): composed and unreadable: relaxed brows, steady gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/actuary-devlin-cho-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Actuary Devlin Cho, High Tech faction, neutral. New expression (happy): quiet approval: a small closed-mouth smile, softened eyes.
```


### Black-ops broker Sable Reyes · chaotic evil · placeholder

Reference: `content/dialog/portraits/black-ops-broker-sable-reyes.png`


**Angry** → `content/dialog/portraits/black-ops-broker-sable-reyes-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Black-ops broker Sable Reyes, High Tech faction, chaotic evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/black-ops-broker-sable-reyes-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Black-ops broker Sable Reyes, High Tech faction, chaotic evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/black-ops-broker-sable-reyes-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Black-ops broker Sable Reyes, High Tech faction, chaotic evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### COO Marcus Thorne · evil · placeholder

Reference: `content/dialog/portraits/coo-marcus-thorne.png`


**Angry** → `content/dialog/portraits/coo-marcus-thorne-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is COO Marcus Thorne, High Tech faction, evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/coo-marcus-thorne-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is COO Marcus Thorne, High Tech faction, evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/coo-marcus-thorne-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is COO Marcus Thorne, High Tech faction, evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### CEO Adrian Sterling · principled evil · placeholder

Reference: `content/dialog/portraits/ceo-adrian-sterling.png`


**Angry** → `content/dialog/portraits/ceo-adrian-sterling-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is CEO Adrian Sterling, High Tech faction, principled evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/ceo-adrian-sterling-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is CEO Adrian Sterling, High Tech faction, principled evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/ceo-adrian-sterling-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is CEO Adrian Sterling, High Tech faction, principled evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### The Board (anonymized AI) · dark evil · placeholder

Reference: `content/dialog/portraits/the-board-anonymized-ai.png`


**Angry** → `content/dialog/portraits/the-board-anonymized-ai-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Board (anonymized AI), High Tech faction, dark evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/the-board-anonymized-ai-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Board (anonymized AI), High Tech faction, dark evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/the-board-anonymized-ai-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Board (anonymized AI), High Tech faction, dark evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


## Artillery


### Chaplain-Gunner Ruth Bellamy · absolute good · placeholder

Reference: `content/dialog/portraits/chaplain-gunner-ruth-bellamy.png`


**Angry** → `content/dialog/portraits/chaplain-gunner-ruth-bellamy-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Chaplain-Gunner Ruth Bellamy, Artillery faction, absolute good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/chaplain-gunner-ruth-bellamy-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Chaplain-Gunner Ruth Bellamy, Artillery faction, absolute good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/chaplain-gunner-ruth-bellamy-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Chaplain-Gunner Ruth Bellamy, Artillery faction, absolute good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Fire-Director Yusuf Kaya · principled good · placeholder

Reference: `content/dialog/portraits/fire-director-yusuf-kaya.png`


**Angry** → `content/dialog/portraits/fire-director-yusuf-kaya-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Fire-Director Yusuf Kaya, Artillery faction, principled good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/fire-director-yusuf-kaya-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Fire-Director Yusuf Kaya, Artillery faction, principled good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/fire-director-yusuf-kaya-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Fire-Director Yusuf Kaya, Artillery faction, principled good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Major Elena Ruiz · good · placeholder

Reference: `content/dialog/portraits/major-elena-ruiz.png`


**Angry** → `content/dialog/portraits/major-elena-ruiz-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Major Elena Ruiz, Artillery faction, good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/major-elena-ruiz-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Major Elena Ruiz, Artillery faction, good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/major-elena-ruiz-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Major Elena Ruiz, Artillery faction, good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Spotter "Ricochet" Deacon · chaotic good · placeholder

Reference: `content/dialog/portraits/spotter-ricochet-deacon.png`


**Angry** → `content/dialog/portraits/spotter-ricochet-deacon-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Spotter "Ricochet" Deacon, Artillery faction, chaotic good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/spotter-ricochet-deacon-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Spotter "Ricochet" Deacon, Artillery faction, chaotic good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/spotter-ricochet-deacon-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Spotter "Ricochet" Deacon, Artillery faction, chaotic good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Logistician Bo Farrell · neutral · placeholder

Reference: `content/dialog/portraits/logistician-bo-farrell.png`


**Angry** → `content/dialog/portraits/logistician-bo-farrell-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Logistician Bo Farrell, Artillery faction, neutral. New expression (angry): cold irritation: brows lowered, eyes narrowed, a tight frown, nostrils slightly flared.
```


**Neutral** → `content/dialog/portraits/logistician-bo-farrell-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Logistician Bo Farrell, Artillery faction, neutral. New expression (neutral): composed and unreadable: relaxed brows, steady gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/logistician-bo-farrell-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Logistician Bo Farrell, Artillery faction, neutral. New expression (happy): quiet approval: a small closed-mouth smile, softened eyes.
```


### Warlord-Gunner Vex Marrow · chaotic evil · placeholder

Reference: `content/dialog/portraits/warlord-gunner-vex-marrow.png`


**Angry** → `content/dialog/portraits/warlord-gunner-vex-marrow-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Warlord-Gunner Vex Marrow, Artillery faction, chaotic evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/warlord-gunner-vex-marrow-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Warlord-Gunner Vex Marrow, Artillery faction, chaotic evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/warlord-gunner-vex-marrow-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Warlord-Gunner Vex Marrow, Artillery faction, chaotic evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### Colonel Hargreave · evil · placeholder

Reference: `content/dialog/portraits/colonel-hargreave.png`


**Angry** → `content/dialog/portraits/colonel-hargreave-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Colonel Hargreave, Artillery faction, evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/colonel-hargreave-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Colonel Hargreave, Artillery faction, evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/colonel-hargreave-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Colonel Hargreave, Artillery faction, evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### Grand-Bombardier Seline Voss · principled evil · placeholder

Reference: `content/dialog/portraits/grand-bombardier-seline-voss.png`


**Angry** → `content/dialog/portraits/grand-bombardier-seline-voss-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Grand-Bombardier Seline Voss, Artillery faction, principled evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/grand-bombardier-seline-voss-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Grand-Bombardier Seline Voss, Artillery faction, principled evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/grand-bombardier-seline-voss-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Grand-Bombardier Seline Voss, Artillery faction, principled evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### The Siegemaster · dark evil · placeholder

Reference: `content/dialog/portraits/the-siegemaster.png`


**Angry** → `content/dialog/portraits/the-siegemaster-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Siegemaster, Artillery faction, dark evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/the-siegemaster-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Siegemaster, Artillery faction, dark evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/the-siegemaster-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Siegemaster, Artillery faction, dark evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


## Water


### Tide-Priestess Marena · absolute good · placeholder

Reference: `content/dialog/portraits/tide-priestess-marena.png`


**Angry** → `content/dialog/portraits/tide-priestess-marena-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Tide-Priestess Marena, Water faction, absolute good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/tide-priestess-marena-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Tide-Priestess Marena, Water faction, absolute good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/tide-priestess-marena-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Tide-Priestess Marena, Water faction, absolute good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Chieftain Coral of the Reef-Born · principled good · placeholder

Reference: `content/dialog/portraits/chieftain-coral-of-the-reef-born.png`


**Angry** → `content/dialog/portraits/chieftain-coral-of-the-reef-born-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Chieftain Coral of the Reef-Born, Water faction, principled good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/chieftain-coral-of-the-reef-born-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Chieftain Coral of the Reef-Born, Water faction, principled good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/chieftain-coral-of-the-reef-born-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Chieftain Coral of the Reef-Born, Water faction, principled good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Wavecaller Nerea · good · placeholder

Reference: `content/dialog/portraits/wavecaller-nerea.png`


**Angry** → `content/dialog/portraits/wavecaller-nerea-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Wavecaller Nerea, Water faction, good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/wavecaller-nerea-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Wavecaller Nerea, Water faction, good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/wavecaller-nerea-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Wavecaller Nerea, Water faction, good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Corsair Finn Saltmoor · chaotic good · placeholder

Reference: `content/dialog/portraits/corsair-finn-saltmoor.png`


**Angry** → `content/dialog/portraits/corsair-finn-saltmoor-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Corsair Finn Saltmoor, Water faction, chaotic good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/corsair-finn-saltmoor-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Corsair Finn Saltmoor, Water faction, chaotic good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/corsair-finn-saltmoor-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Corsair Finn Saltmoor, Water faction, chaotic good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Ferryman Old Brack · neutral · placeholder

Reference: `content/dialog/portraits/ferryman-old-brack.png`


**Angry** → `content/dialog/portraits/ferryman-old-brack-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Ferryman Old Brack, Water faction, neutral. New expression (angry): cold irritation: brows lowered, eyes narrowed, a tight frown, nostrils slightly flared.
```


**Neutral** → `content/dialog/portraits/ferryman-old-brack-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Ferryman Old Brack, Water faction, neutral. New expression (neutral): composed and unreadable: relaxed brows, steady gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/ferryman-old-brack-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Ferryman Old Brack, Water faction, neutral. New expression (happy): quiet approval: a small closed-mouth smile, softened eyes.
```


### Raider-Chief Drowned Kael · chaotic evil · placeholder

Reference: `content/dialog/portraits/raider-chief-drowned-kael.png`


**Angry** → `content/dialog/portraits/raider-chief-drowned-kael-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Raider-Chief Drowned Kael, Water faction, chaotic evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/raider-chief-drowned-kael-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Raider-Chief Drowned Kael, Water faction, chaotic evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/raider-chief-drowned-kael-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Raider-Chief Drowned Kael, Water faction, chaotic evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### Leviathan-Binder Morgause · evil · placeholder

Reference: `content/dialog/portraits/leviathan-binder-morgause.png`


**Angry** → `content/dialog/portraits/leviathan-binder-morgause-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Leviathan-Binder Morgause, Water faction, evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/leviathan-binder-morgause-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Leviathan-Binder Morgause, Water faction, evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/leviathan-binder-morgause-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Leviathan-Binder Morgause, Water faction, evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### Abyssal Sovereign Thal · principled evil · placeholder

Reference: `content/dialog/portraits/abyssal-sovereign-thal.png`


**Angry** → `content/dialog/portraits/abyssal-sovereign-thal-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Abyssal Sovereign Thal, Water faction, principled evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/abyssal-sovereign-thal-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Abyssal Sovereign Thal, Water faction, principled evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/abyssal-sovereign-thal-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Abyssal Sovereign Thal, Water faction, principled evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### The Undertow (drowned collective) · dark evil · placeholder

Reference: `content/dialog/portraits/the-undertow-drowned-collective.png`


**Angry** → `content/dialog/portraits/the-undertow-drowned-collective-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Undertow (drowned collective), Water faction, dark evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/the-undertow-drowned-collective-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Undertow (drowned collective), Water faction, dark evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/the-undertow-drowned-collective-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Undertow (drowned collective), Water faction, dark evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


## Arcane / Energy


### Hierophant Aurelia · absolute good · placeholder

Reference: `content/dialog/portraits/hierophant-aurelia.png`


**Angry** → `content/dialog/portraits/hierophant-aurelia-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Hierophant Aurelia, Arcane / Energy faction, absolute good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/hierophant-aurelia-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Hierophant Aurelia, Arcane / Energy faction, absolute good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/hierophant-aurelia-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Hierophant Aurelia, Arcane / Energy faction, absolute good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Lightbearer Cassian · principled good · placeholder

Reference: `content/dialog/portraits/lightbearer-cassian.png`


**Angry** → `content/dialog/portraits/lightbearer-cassian-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Lightbearer Cassian, Arcane / Energy faction, principled good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/lightbearer-cassian-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Lightbearer Cassian, Arcane / Energy faction, principled good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/lightbearer-cassian-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Lightbearer Cassian, Arcane / Energy faction, principled good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Acolyte-Scholar Wen · good · placeholder

Reference: `content/dialog/portraits/acolyte-scholar-wen.png`


**Angry** → `content/dialog/portraits/acolyte-scholar-wen-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Acolyte-Scholar Wen, Arcane / Energy faction, good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/acolyte-scholar-wen-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Acolyte-Scholar Wen, Arcane / Energy faction, good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/acolyte-scholar-wen-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Acolyte-Scholar Wen, Arcane / Energy faction, good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Heretic Isolde · chaotic good · placeholder

Reference: `content/dialog/portraits/heretic-isolde.png`


**Angry** → `content/dialog/portraits/heretic-isolde-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Heretic Isolde, Arcane / Energy faction, chaotic good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/heretic-isolde-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Heretic Isolde, Arcane / Energy faction, chaotic good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/heretic-isolde-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Heretic Isolde, Arcane / Energy faction, chaotic good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Archivist Balthus · neutral · placeholder

Reference: `content/dialog/portraits/archivist-balthus.png`


**Angry** → `content/dialog/portraits/archivist-balthus-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Archivist Balthus, Arcane / Energy faction, neutral. New expression (angry): cold irritation: brows lowered, eyes narrowed, a tight frown, nostrils slightly flared.
```


**Neutral** → `content/dialog/portraits/archivist-balthus-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Archivist Balthus, Arcane / Energy faction, neutral. New expression (neutral): composed and unreadable: relaxed brows, steady gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/archivist-balthus-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Archivist Balthus, Arcane / Energy faction, neutral. New expression (happy): quiet approval: a small closed-mouth smile, softened eyes.
```


### Warlock Nyx · chaotic evil · placeholder

Reference: `content/dialog/portraits/warlock-nyx.png`


**Angry** → `content/dialog/portraits/warlock-nyx-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Warlock Nyx, Arcane / Energy faction, chaotic evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/warlock-nyx-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Warlock Nyx, Arcane / Energy faction, chaotic evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/warlock-nyx-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Warlock Nyx, Arcane / Energy faction, chaotic evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### Inquisitor Mordane · evil · placeholder

Reference: `content/dialog/portraits/inquisitor-mordane.png`


**Angry** → `content/dialog/portraits/inquisitor-mordane-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Inquisitor Mordane, Arcane / Energy faction, evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/inquisitor-mordane-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Inquisitor Mordane, Arcane / Energy faction, evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/inquisitor-mordane-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Inquisitor Mordane, Arcane / Energy faction, evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### The Ordained Prime, Vaelith · principled evil · placeholder

Reference: `content/dialog/portraits/the-ordained-prime-vaelith.png`


**Angry** → `content/dialog/portraits/the-ordained-prime-vaelith-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Ordained Prime, Vaelith, Arcane / Energy faction, principled evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/the-ordained-prime-vaelith-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Ordained Prime, Vaelith, Arcane / Energy faction, principled evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/the-ordained-prime-vaelith-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Ordained Prime, Vaelith, Arcane / Energy faction, principled evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### The Unmade Choir · dark evil · placeholder

Reference: `content/dialog/portraits/the-unmade-choir.png`


**Angry** → `content/dialog/portraits/the-unmade-choir-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Unmade Choir, Arcane / Energy faction, dark evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/the-unmade-choir-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Unmade Choir, Arcane / Energy faction, dark evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/the-unmade-choir-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Unmade Choir, Arcane / Energy faction, dark evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


## Space Tech


### Envoy Lyra-9 · absolute good · placeholder

Reference: `content/dialog/portraits/envoy-lyra-9.png`


**Angry** → `content/dialog/portraits/envoy-lyra-9-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Envoy Lyra-9, Space Tech faction, absolute good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/envoy-lyra-9-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Envoy Lyra-9, Space Tech faction, absolute good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/envoy-lyra-9-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Envoy Lyra-9, Space Tech faction, absolute good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Commander Idris Vale · principled good · placeholder

Reference: `content/dialog/portraits/commander-idris-vale.png`


**Angry** → `content/dialog/portraits/commander-idris-vale-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Commander Idris Vale, Space Tech faction, principled good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/commander-idris-vale-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Commander Idris Vale, Space Tech faction, principled good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/commander-idris-vale-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Commander Idris Vale, Space Tech faction, principled good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Science-Officer Tovah · good · placeholder

Reference: `content/dialog/portraits/science-officer-tovah.png`


**Angry** → `content/dialog/portraits/science-officer-tovah-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Science-Officer Tovah, Space Tech faction, good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/science-officer-tovah-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Science-Officer Tovah, Space Tech faction, good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/science-officer-tovah-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Science-Officer Tovah, Space Tech faction, good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Cadet-Prodigy Ezra "Comet" Lin · chaotic good · placeholder

Reference: `content/dialog/portraits/cadet-prodigy-ezra-comet-lin.png`


**Angry** → `content/dialog/portraits/cadet-prodigy-ezra-comet-lin-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Cadet-Prodigy Ezra "Comet" Lin, Space Tech faction, chaotic good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/cadet-prodigy-ezra-comet-lin-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Cadet-Prodigy Ezra "Comet" Lin, Space Tech faction, chaotic good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/cadet-prodigy-ezra-comet-lin-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Cadet-Prodigy Ezra "Comet" Lin, Space Tech faction, chaotic good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Navigator AI "Vector" · neutral · placeholder

Reference: `content/dialog/portraits/navigator-ai-vector.png`


**Angry** → `content/dialog/portraits/navigator-ai-vector-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Navigator AI "Vector", Space Tech faction, neutral. New expression (angry): cold irritation: brows lowered, eyes narrowed, a tight frown, nostrils slightly flared.
```


**Neutral** → `content/dialog/portraits/navigator-ai-vector-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Navigator AI "Vector", Space Tech faction, neutral. New expression (neutral): composed and unreadable: relaxed brows, steady gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/navigator-ai-vector-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Navigator AI "Vector", Space Tech faction, neutral. New expression (happy): quiet approval: a small closed-mouth smile, softened eyes.
```


### Privateer Rax Dune · chaotic evil · placeholder

Reference: `content/dialog/portraits/privateer-rax-dune.png`


**Angry** → `content/dialog/portraits/privateer-rax-dune-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Privateer Rax Dune, Space Tech faction, chaotic evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/privateer-rax-dune-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Privateer Rax Dune, Space Tech faction, chaotic evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/privateer-rax-dune-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Privateer Rax Dune, Space Tech faction, chaotic evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### Admiral Sarn · evil · placeholder

Reference: `content/dialog/portraits/admiral-sarn.png`


**Angry** → `content/dialog/portraits/admiral-sarn-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Admiral Sarn, Space Tech faction, evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/admiral-sarn-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Admiral Sarn, Space Tech faction, evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/admiral-sarn-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Admiral Sarn, Space Tech faction, evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### Grand-Cartographer Ophir · principled evil · placeholder

Reference: `content/dialog/portraits/grand-cartographer-ophir.png`


**Angry** → `content/dialog/portraits/grand-cartographer-ophir-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Grand-Cartographer Ophir, Space Tech faction, principled evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/grand-cartographer-ophir-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Grand-Cartographer Ophir, Space Tech faction, principled evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/grand-cartographer-ophir-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Grand-Cartographer Ophir, Space Tech faction, principled evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### The Signal · dark evil · placeholder

Reference: `content/dialog/portraits/the-signal.png`


**Angry** → `content/dialog/portraits/the-signal-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Signal, Space Tech faction, dark evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/the-signal-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Signal, Space Tech faction, dark evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/the-signal-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Signal, Space Tech faction, dark evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


## Dark Energy


### The Reformer Elias · absolute good · placeholder

Reference: `content/dialog/portraits/the-reformer-elias.png`


**Angry** → `content/dialog/portraits/the-reformer-elias-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Reformer Elias, Dark Energy faction, absolute good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/the-reformer-elias-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Reformer Elias, Dark Energy faction, absolute good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/the-reformer-elias-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Reformer Elias, Dark Energy faction, absolute good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Sister Maren · principled good · placeholder

Reference: `content/dialog/portraits/sister-maren.png`


**Angry** → `content/dialog/portraits/sister-maren-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Sister Maren, Dark Energy faction, principled good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/sister-maren-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Sister Maren, Dark Energy faction, principled good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/sister-maren-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Sister Maren, Dark Energy faction, principled good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Organizer Tomas · good · placeholder

Reference: `content/dialog/portraits/organizer-tomas.png`


**Angry** → `content/dialog/portraits/organizer-tomas-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Organizer Tomas, Dark Energy faction, good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/organizer-tomas-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Organizer Tomas, Dark Energy faction, good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/organizer-tomas-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Organizer Tomas, Dark Energy faction, good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Firebrand Lux · chaotic good · placeholder

Reference: `content/dialog/portraits/firebrand-lux.png`


**Angry** → `content/dialog/portraits/firebrand-lux-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Firebrand Lux, Dark Energy faction, chaotic good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/firebrand-lux-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Firebrand Lux, Dark Energy faction, chaotic good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/firebrand-lux-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Firebrand Lux, Dark Energy faction, chaotic good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Doctrinist Vera · neutral · placeholder

Reference: `content/dialog/portraits/doctrinist-vera.png`


**Angry** → `content/dialog/portraits/doctrinist-vera-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Doctrinist Vera, Dark Energy faction, neutral. New expression (angry): cold irritation: brows lowered, eyes narrowed, a tight frown, nostrils slightly flared.
```


**Neutral** → `content/dialog/portraits/doctrinist-vera-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Doctrinist Vera, Dark Energy faction, neutral. New expression (neutral): composed and unreadable: relaxed brows, steady gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/doctrinist-vera-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Doctrinist Vera, Dark Energy faction, neutral. New expression (happy): quiet approval: a small closed-mouth smile, softened eyes.
```


### Enforcer Grael · chaotic evil · placeholder

Reference: `content/dialog/portraits/enforcer-grael.png`


**Angry** → `content/dialog/portraits/enforcer-grael-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Enforcer Grael, Dark Energy faction, chaotic evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/enforcer-grael-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Enforcer Grael, Dark Energy faction, chaotic evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/enforcer-grael-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Enforcer Grael, Dark Energy faction, chaotic evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### The Vanguard, Corin · evil · placeholder

Reference: `content/dialog/portraits/the-vanguard-corin.png`


**Angry** → `content/dialog/portraits/the-vanguard-corin-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Vanguard, Corin, Dark Energy faction, evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/the-vanguard-corin-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Vanguard, Corin, Dark Energy faction, evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/the-vanguard-corin-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Vanguard, Corin, Dark Energy faction, evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### The Architect, Malis · principled evil · placeholder

Reference: `content/dialog/portraits/the-architect-malis.png`


**Angry** → `content/dialog/portraits/the-architect-malis-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Architect, Malis, Dark Energy faction, principled evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/the-architect-malis-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Architect, Malis, Dark Energy faction, principled evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/the-architect-malis-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Architect, Malis, Dark Energy faction, principled evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### The Hollow Prophet · dark evil · placeholder

Reference: `content/dialog/portraits/the-hollow-prophet.png`


**Angry** → `content/dialog/portraits/the-hollow-prophet-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Hollow Prophet, Dark Energy faction, dark evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/the-hollow-prophet-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Hollow Prophet, Dark Energy faction, dark evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/the-hollow-prophet-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Hollow Prophet, Dark Energy faction, dark evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


## Greenies (Chem)


### Mother-Spore Ilya · absolute good

Reference: `content/dialog/portraits/mother-spore-ilya.png`


**Angry** → `content/dialog/portraits/mother-spore-ilya-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Mother-Spore Ilya, Greenies (Chem) faction, absolute good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/mother-spore-ilya-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Mother-Spore Ilya, Greenies (Chem) faction, absolute good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/mother-spore-ilya-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Mother-Spore Ilya, Greenies (Chem) faction, absolute good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Steward Bractus · principled good

Reference: `content/dialog/portraits/steward-bractus.png`


**Angry** → `content/dialog/portraits/steward-bractus-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Steward Bractus, Greenies (Chem) faction, principled good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/steward-bractus-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Steward Bractus, Greenies (Chem) faction, principled good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/steward-bractus-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Steward Bractus, Greenies (Chem) faction, principled good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Delegate Fenn · good

Reference: `content/dialog/portraits/delegate-fenn.png`


**Angry** → `content/dialog/portraits/delegate-fenn-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Delegate Fenn, Greenies (Chem) faction, good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/delegate-fenn-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Delegate Fenn, Greenies (Chem) faction, good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/delegate-fenn-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Delegate Fenn, Greenies (Chem) faction, good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Splinter "Wildseed" Ovo · chaotic good

Reference: `content/dialog/portraits/splinter-wildseed-ovo.png`


**Angry** → `content/dialog/portraits/splinter-wildseed-ovo-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Splinter "Wildseed" Ovo, Greenies (Chem) faction, chaotic good. New expression (angry): stern, disappointed anger: brows drawn down and together, eyes hard and level, jaw set, lips pressed thin.
```


**Neutral** → `content/dialog/portraits/splinter-wildseed-ovo-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Splinter "Wildseed" Ovo, Greenies (Chem) faction, chaotic good. New expression (neutral): calm and attentive: relaxed brows, steady direct gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/splinter-wildseed-ovo-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Splinter "Wildseed" Ovo, Greenies (Chem) faction, chaotic good. New expression (happy): warm, open pleasure: a genuine smile showing a little teeth, eyes crinkled at the corners, brows lifted.
```


### Composter Null-7 · neutral

Reference: `content/dialog/portraits/composter-null-7.png`


**Angry** → `content/dialog/portraits/composter-null-7-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Composter Null-7, Greenies (Chem) faction, neutral. New expression (angry): cold irritation: brows lowered, eyes narrowed, a tight frown, nostrils slightly flared.
```


**Neutral** → `content/dialog/portraits/composter-null-7-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Composter Null-7, Greenies (Chem) faction, neutral. New expression (neutral): composed and unreadable: relaxed brows, steady gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/composter-null-7-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Composter Null-7, Greenies (Chem) faction, neutral. New expression (happy): quiet approval: a small closed-mouth smile, softened eyes.
```


### Blight-Agitator Sear · chaotic evil

Reference: `content/dialog/portraits/blight-agitator-sear.png`


**Angry** → `content/dialog/portraits/blight-agitator-sear-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Blight-Agitator Sear, Greenies (Chem) faction, chaotic evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/blight-agitator-sear-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Blight-Agitator Sear, Greenies (Chem) faction, chaotic evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/blight-agitator-sear-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Blight-Agitator Sear, Greenies (Chem) faction, chaotic evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### Overseer Thax · evil · placeholder

Reference: `content/dialog/portraits/overseer-thax.png`


**Angry** → `content/dialog/portraits/overseer-thax-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Overseer Thax, Greenies (Chem) faction, evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/overseer-thax-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Overseer Thax, Greenies (Chem) faction, evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/overseer-thax-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is Overseer Thax, Greenies (Chem) faction, evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### The Root-Mind · principled evil

Reference: `content/dialog/portraits/the-root-mind.png`


**Angry** → `content/dialog/portraits/the-root-mind-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Root-Mind, Greenies (Chem) faction, principled evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/the-root-mind-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Root-Mind, Greenies (Chem) faction, principled evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/the-root-mind-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Root-Mind, Greenies (Chem) faction, principled evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```


### The Rot · dark evil

Reference: `content/dialog/portraits/the-rot.png`


**Angry** → `content/dialog/portraits/the-rot-angry.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Rot, Greenies (Chem) faction, dark evil. New expression (angry): open menace: eyes narrowed to slits, a snarl baring the teeth, brows sharply knitted, head tilted forward.
```


**Neutral** → `content/dialog/portraits/the-rot-neutral.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Rot, Greenies (Chem) faction, dark evil. New expression (neutral): guarded and watchful: level brows, cool appraising gaze, mouth at rest.
```


**Happy** → `content/dialog/portraits/the-rot-happy.png`

```
Edit the attached portrait. Keep exactly the same person: face, age, skin, hair, scars, outfit, helmet or headgear, pose, framing, camera angle, lighting, colour palette and background. Change only the facial expression. Same painterly semi-realistic rendering as the original, same 3:4 portrait size (864 × 1152). No text, no letters, no border. The character is The Rot, Greenies (Chem) faction, dark evil. New expression (happy): satisfied and sly: a crooked smirk, one brow raised, eyes glinting.
```
