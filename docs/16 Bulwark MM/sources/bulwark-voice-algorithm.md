# BULWARK — Procedural Voice Algorithm

*Companion to the Dialog & Storytelling System doc (§7.3–7.5, "the voice is invented cant; the typed text is the translation"). Describes the engine implemented in `prototype/test-game/src/comm/voice.js`, shared verbatim by the Comm tool (`comm.html`) and the in-battle comm cards (`commCard.js`).*

**Version:** 1.0 · **Last updated:** 2026-07-13

---

## 0. What it is

No speech synthesis and no recordings. Each spoken line is a **melodic stream of synthesized syllables** — an invented language ("cant") whose *rhythm* comes from the real text, whose *melody* is deterministically hashed from the words, whose *intonation* follows the line's intent, and whose *timbre* is the speaking faction's audio identity. The player reads the translation while hearing a voice that is unmistakably Water, or Artillery, or the Greenies — without a single recorded sample. Everything is WebAudio primitives: oscillators, filters, gain envelopes, one shared noise buffer, one convolution reverb.

The pipeline, per utterance:

```
text line ──► beats (syllables + melody + contour + durations)     [pure, seeded]
beat[i]  ──► oscillator stack ► formant bandpasses ► envelope      [per syllable]
all beats ─► faction FX chain (gain·drive·ringmod·lowpass·reverb)  [per utterance]
underneath ► channel-static carrier bed                            [per transmission]
everything ► master gain ► compressor ► speakers
```

---

## 1. Stage 1 — text → beats (`buildBeats`, pure & unit-tested)

### 1.1 Syllabification (`countSyllables`)
Each word's syllable count = the number of **vowel-group runs** (`[aeiouy]+`) after stripping non-letters, minus one if the word is longer than 3 letters and ends in a silent `e`, clamped to **1–6**. `"balanced"` → `a·a·e` → 3 beats; `"kneel"` → 1. Crude by linguistic standards — exactly right for turning prose into speech *rhythm*: long words babble longer, short words punch.

### 1.2 Deterministic melody (FNV-1a hash)
For syllable `i` of `word`, a 32-bit **FNV-1a** hash of the string `word:i:seed` supplies all randomness:

```
h = 2166136261;  for each char:  h ^= code;  h = Math.imul(h, 16777619);  h >>>= 0
```

- **Scale degree:** `[0, 2, 4, 7, 9, 12][h % 6]` — a major-pentatonic-plus-octave set, so any degree sequence sounds musical rather than atonal — then de-tuned by `((h>>4) % 3) − 1` semitones (−1/0/+1) so it never sounds like a keyboard.
- **Timing jitter:** `jit = ((h>>7) % 100) / 100`, used for both duration variance and consonant strength.

The `seed` is `hash(characterName)` — **every character owns a stable melody**: Graf's "Kneel, or be balanced against." sings the same tune every time, on every machine, in every replay (§11 determinism in the dialog doc). Change one word and only that word's beats change.

### 1.3 Intonation contour (intent)
With `pos = idx/(N−1)` running 0→1 across the phrase, a contour is added to each beat's semitone:

| Intent | Contour | Reads as |
|---|---|---|
| `statement` | `−3·pos` — gradual 3-semitone fall | declarative finality |
| `question` | `+5` on the **last two** beats | terminal rise |
| `exclaim` | alternating `+2.5 / −1` | punchy seesaw shout |
| `trail` | `−5·pos` — deep sink | voice dying away ("…") |

Intent comes from the authored line's terminal punctuation (`!` exclaim, `…` trail, `?` question, else statement — `tools/extract_dialog.py`).

### 1.4 Rhythm
`dur = (1/rate) · (0.85 + 0.3·jit)` seconds per beat, where `rate` is the faction's syllables-per-second (3.0 for Dark Energy's dirge up to 9.0 for the Greenies' chittering), scaled ×1.15 for exclaim and ×0.8 for trail. Total utterance duration = Σdur + 0.2 s — returned to the card so the **typewriter text finishes exactly when the voice does**.

---

## 2. Stage 2 — pitch

Base frequency = the faction's `pitchM` or `pitchF` by speaker gender (neutral = their mean × 0.85), times `2^(pitchTrim/12)` for the tool's per-semitone slider. Each beat then sounds at `f = base · 2^(semi/12)`. Gender is inferred from the voice-pack prose (she/he → female/male, else neutral — the Root-Mind and The Signal read as neutral automatically).

---

## 3. Stage 3 — one syllable (`syllable`)

Each beat is a tiny subtractive-synthesis voice:

1. **Oscillator stack** at frequency `f`:
   - main oscillator in the faction's waveform (gain 0.9) — sine (Water's song), triangle (Air's brightness), square (High Tech/Space's machine tone), sawtooth (Ground/Dark's rasp);
   - optional **detune pair** at ±`detune` cents (gain 0.5 each) — chorus shimmer (Air 6, Water 9, Greenies 14);
   - optional **swarm pair** at ±2×detune (gain 0.35) — the Greenies' many-voices-at-once hive effect;
   - optional **+1 octave sine** (gain 0.28) — Arcane's angelic overtone;
   - optional **−1 octave sine sub** (gain 0.4) — Artillery/Dark Energy's chest-cavity gravitas.
2. **Formant filter:** the stack feeds two *parallel* bandpasses at `f1` (Q 6) and `f2` (Q 9) — fixed "vowel" resonances that make a buzzing oscillator read as a *voice*. Each faction owns a vowel: Artillery's 600/900 Hz is a closed "aw" bark; Air's 500/2200 Hz is a bright "ee". Both formants scale ×1.12 for female speakers, ×0.95 for neutral (vocal-tract size).
3. **Envelope (per-faction ADSR-ish):** three faction parameters shape articulation — `attack` (onset ramp, 5 ms bark … 60 ms swell), `sustain` (the vowel's held level as a fraction of peak: 0 plucks, 0.5+ sings — decay reaches the sustain floor at 70% of the beat), and `overlap` (the release tail rings up to 60% **into the next beat**; every syllable owns its own oscillators and envelope, so consecutive syllables crossfade like independent channels — beat *timing* never changes, only the connective tissue). Peak = `0.24 × level` (exclaim 1.15, trail 0.8). Defaults: Water/Arcane/Dark sing legato (attack 40–60 ms, sustain ~0.5, overlap 0.4–0.5); Artillery/Greenies/High Tech keep their percussive bite.
4. **Consonant onset:** a ≤50 ms burst of the shared white-noise buffer through a bandpass at `1800 + 2f` Hz (Q 2), gain `noise · (0.9 + 0.4·jit)`, exponential decay — the fricative "consonant" gating each syllable. Skipped when the faction's `noise` is near zero (High Tech speaks unnervingly clean; Dark Energy at 0.30 rasps).

---

## 4. Stage 4 — the faction FX chain (`buildChain`, per utterance)

All syllables of one utterance pour into a single chain:

```
input gain (VGAIN loudness normalization)
  → [waveshaper drive]        distortion curve (1+k)x / (1+k|x|), k = drive·80   — gravel
  → [ring modulator]          carrier gain × oscillator at `ringmod` Hz          — robotic sidebands (Space: 170 Hz)
  → lowpass (faction cutoff)  2.2 kHz (Dark, muffled) … 9 kHz (Air/Greenies, present)
  → master
  ↘ reverb send               wet = faction reverb × 1.5 global boost, cap 1.2
```

- **VGAIN** is per-faction perceptual leveling: energy-dense timbres (square + sub) are trimmed (Artillery 0.50, Dark 0.60) and soft sine timbres boosted (Water 1.35, Arcane 1.30) so all nine factions land at similar loudness.
- **Reverb** is one shared `ConvolverNode` with a generated impulse: 2.4 s of stereo noise decaying as `(1−t)^3.2`. Water (0.55) and Arcane (0.75) speak in a drowned cathedral; Air (0.10) is dry cockpit radio.

## 5. Stage 5 — the channel-static carrier (`startStatic`, per transmission)

Under the whole call rides a faction-specific noise bed — the "radio channel" the voice arrives on: the shared noise buffer through one filter (Artillery/Dark: **lowpass** 420/300 Hz rumble; Air/High Tech/Space: **highpass** 3.2–5.2 kHz hiss; others bandpass), at level 0.026–0.080, optionally **tremolo'd** by an LFO (Space warbles at 9 Hz, Greenies buzz at 13 Hz — an insect wing-beat), some with their own reverb send. It fades in over 0.4 s, holds under the voice, and fades on sign-off. This is what makes two factions feel like different *frequencies*, not just different voices.

## 6. Stage 6 — bus, SFX, scheduling

- **Master:** one gain (the volume control) → `DynamicsCompressor` → speakers. The compressor glues voice + static + SFX and catches syllable-stack peaks.
- **SFX:** acquire = sawtooth sweep 180→1400 Hz over 0.5 s; sign-off = sine drop 600→60 Hz over 0.4 s.
- **Scheduling:** `playUtterance` walks the beat list once, scheduling every oscillator/envelope at sample-accurate WebAudio timeline times starting `now + 60 ms` — zero per-frame JS during playback. It returns `{ duration, stop() }`; `stop()` disconnects the chain (the card's click-to-skip).

---

## 7. The nine voices at a glance

| Faction | Wave | Pitch M/F | Formants | Rate | Signature tricks | Result |
|---|---|---|---|---|---|---|
| Ground/Powder | saw | 110/175 | 700/1100 | 5.0 | drive 0.35 | parade-ground bark |
| Air | tri | 165/245 | 500/2200 | 7.0 | detune 6 | bright ace-pilot chatter |
| High Tech | sq | 130/200 | 400/1800 | 6.0 | noise 0.03 (clean) | boardroom synthesizer |
| Artillery | sq | 85/150 | 600/900 | 3.5 | sub osc, lowpass 3.4k | slow ordnance rumble |
| Water | sine | 120/190 | 450/1000 | 4.5 | detune 9, reverb 0.55, lowpass 2.6k | drowned cathedral song |
| Arcane | sine | 140/210 | 500/1500 | 4.0 | +octave osc, reverb 0.75 | liturgical ring |
| Space Tech | sq | 120/195 | 400/2000 | 6.0 | ringmod 170 Hz | robotic federation hail |
| Dark Energy | saw | 75/140 | 550/800 | 3.0 | sub, drive 0.35, noise 0.30, lowpass 2.2k | abyssal dirge |
| Greenies | sq | 200/280 | 600/2600 | 9.0 | swarm detune ±28, noise 0.25 | chittering hive chorus |

---

## 8. Worked example

Graf (Ground PE, female, statement): *"Kneel, or be balanced against."*

1. Words → syllables: `kneel`(1) `or`(1) `be`(1) `balanced`(3) `against`(2) = **8 beats**.
2. Each beat hashes `word:i:<hash("Chancellor Wilhelmina Graf")>` → pentatonic degrees, say `[7, 0, 4, 2, 9, 4, 12, 2]`, ±1 jitter each.
3. Statement contour subtracts 0→3 semitones across the 8 beats — the phrase *falls* to its full stop.
4. Base pitch 175 Hz (female Ground); each beat ~0.17–0.23 s (rate 5.0 + jitter) → ~1.6 s utterance.
5. Every syllable: sawtooth (+nothing fancy — Ground is a plain bark) → 700/1100 Hz formants ×1.12 → 12 ms attack, exponential decay, noise-burst consonant at strength 0.15.
6. Chain: VGAIN 0.85 → drive 0.35 waveshaper → lowpass 6 kHz → master, with a 0.15×1.5 reverb whisper; a 2 kHz bandpass static bed underneath.
7. The card types the English translation across exactly those 1.8 s (duration + tail).

Same seed, same tune — in the tool, in the game, and in every replay.

---

## 9. Determinism & purity notes

- Melody, rhythm, contour, channel number: **fully seeded** (FNV-1a of character name / call spec) — replay-identical, cross-machine-identical.
- `Math.random` appears only in the noise buffer, reverb impulse, and visual glyph flicker — *texture*, inaudible as variation, and never touching the sim (the whole engine is render-side; the replay hash is blind to it).
- `hash`, `countSyllables`, `buildBeats`, `utterDuration`, `paramsFor` are pure and covered by `src/comm/comm.test.mjs` (beat determinism, contour direction, duration ordering, 9/9 faction data integrity).

## 10. Tuning guide

Everything audible is a table value in `FACTIONS` / `VGAIN` / `STATIC` (`src/comm/voice.js`) — tune in the Comm tool's sliders, then transcribe:
- **Less punchy / more song:** `attack` up, `sustain` up, `overlap` up — the syllables swell and crossfade instead of plucking.
- **More menace:** pitch down, `rate` down, `noise` up, `reverb` up, add `sub`.
- **More comedy:** `rate` up, pitch up, `detune` up.
- **More machine:** `ringmod` > 0, `noise` → 0, square wave.
- **More holy:** `octave: true`, `reverb` ≥ 0.7, sine wave.
- Keep `VGAIN` in mind after timbre changes — harsher waves carry more energy at equal gain.
