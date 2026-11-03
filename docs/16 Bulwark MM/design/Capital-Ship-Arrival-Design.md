# Capital Ship Arrival — first sight and return coast-in

Tracking: [MM-story_mw05b8th_6] · Status: design for review · 2026-11-02
Builds on: `Capital-Ship-Scale-Research.md` (lenses, HDR chain, scale rules), `Mission-Log-Design.md` §11
(the ship arrives at 3★ on map 1; missions are granted and collected aboard).

## 1. The moment

Earning a faction's capital ship is the biggest reward on a planet. The first time the player sees it, the game
stops and gives it a 22-second arrival: the ship tears in from deep space behind the planet, roars past the
camera on a full story burn, brakes hard, powers down and settles into orbit above the planet. The captain hails
the player and the Mission Log opens aboard.

It happens **once per ship**. On every later visit to that planet the ship is already part of the scene: it
coasts quietly into its corner above the planet in about 3.5 seconds and idles there.

Three rules shape every beat:

1. **Scale first.** Everything we learned in the scale research applies: long or very wide lenses, slow
   motion of big things, low camera looking up, tugs for reference, haze, a single sun. The ship must read as
   two kilometres of steel, not a model.
2. **Sound tells the physics.** The music carries the emotion, the engines carry the mass. The roar rises,
   Doppler-drops as the ship passes, then winds down through a braking burn to an idle hum. The player should
   be able to close their eyes and hear the ship arrive, pass, brake and stop.
3. **Earned, not forced.** It never interrupts play. It waits for the planet screen, can be skipped after the
   first two seconds, and can be replayed from the ship.

## 2. When it plays

| Situation | What happens |
|---|---|
| Map 1 cleared at 3★ (`recordPlanetMap` sets `capitalShips[planet].arrived` and queues `{kind:'ship', planet}`) | Nothing yet. The results screen gains one line: "A capital ship is inbound to <Planet>." Assets start preloading. |
| Player next lands on that planet's screen (globe visible) and `arrived && !introSeen` | **First-sight arrival** plays before any other menu toast. The queued mission-log toast is consumed by the cinematic's end card instead. |
| Planet screen opened later (`introSeen`) | **Return coast-in** (§6). |
| Player taps "Replay arrival" on the ship panel | First-sight arrival plays again; it changes no state. |
| Several ships unlocked before visiting (possible through skips or save import) | Each plays on its own planet's screen. Never two in a row on one screen. |

**Persistence.** Add `introSeen: true` to `s.capitalShips[planet]`. It is written when the cinematic reaches the
title card (beat 6) or when the player skips. If the app closes before then, the arrival plays again next time.
Old saves migrate with `introSeen` absent, so players who already earned ships get their arrival once.

## 3. First-sight beat sheet

Times are seconds from start. All camera, ship and effect values are a pure function of `t` (see §8), so the
whole sequence is deterministic, testable and scrubbable.

| # | Time | Picture | Ship and VFX | Music | Engines and SFX | UI |
|---|---|---|---|---|---|---|
| 0 | 0.0–1.5 | Menu UI fades out; letterbox (2.39:1, landscape) slides in. Camera eases from the menu framing to a 135 mm wide on the planet limb with the sun just behind it. | Backdrop stars brighten 15 %. Haze up. | Planet theme ducks to its pad layer (−9 dB over 1.2 s). | A comm static ping (`playSweep`), then silence. | Caption: "Long-range contact — <Planet> orbit". |
| 1 | 1.5–3.5 | **Arrival.** A point of light opens beyond the limb, flares and resolves into the ship's silhouette, far away. | Faction-coloured arrival flash (§5): one bloom spike to 6× then decays; lens flare from the flash point; chromatic aberration pulses 0.002 → 0.006 → 0.002. Engines at 2.0. | Sub-bass swell into the first hit of the arrival cue at **t = 2.0**. | Low thunder of displaced space: filtered noise burst, 40 Hz sine bloom, long tail. | — |
| 2 | 3.5–8.0 | **Approach on story burn.** Stern-quarter 85 mm shot (shots.js `stern`, reversed so the ship closes on the camera). The ship grows from a quarter of the frame to filling it. Planet lit below. | Engine plumes at full story burn (`setIntensity(2.0)`), point lights on. Haze softens the far hull. | Cue builds: ostinato and brass/synth motif in the faction theme's key. | **Roar** rises (§4): distance-filtered rumble opening up, crackle layer entering past 50 % of the frame. | — |
| 3 | 8.0–10.5 | **The pass.** Cut to the 24 mm `bow` shot under the keel: the ship slides overhead bow first, engines pass the lens at **t = 9.2**. | Plume light washes the lens: bloom and flare peak, CA at 0.006 for 0.4 s, a very slight camera rumble (≤ 0.15°, the only shake in the game, 0.6 s). | Full-orchestra hit on the pass, then the motif drops an octave. | **Doppler drop**: pitch of the engine layers falls about 5 semitones over 0.8 s; pan sweeps across the stereo field; peak loudness here. Haptic pulse on mobile (`navigator.vibrate(120)` where supported). | — |
| 4 | 10.5–14.0 | **Braking burn.** 35 mm `flyby` along the hull while the ship decelerates. Bow retro-thrusters fire in four short pulses; the main plumes shorten. | Engines 2.0 → 0.8. Retro-thruster flashes at the bow (glow mesh pulses, small sprite bursts). | Strings hold; percussion thins out. | Roar pitch winds down; four **retro thumps** with metallic ring; hull **creak** layer (low filtered groans) sells the stress. | Ship name plate types on, lower left: "<Ship name>". |
| 5 | 14.0–18.0 | **Power-down into orbit.** Pull back to the 135 mm `orbit` shot with the planet below; the ship drifts to its orbit station in the upper third of the frame. Tugs (§ scale research) launch from the hull and fan out. | Engines 0.8 → 0.35 (idle), point lights dim. Running lights blink on in sequence along the hull, bow to stern. | Cue resolves into the faction planet theme's cadence; theme layer returns at full. | **Power-down whine** (descending sine glide 900 → 120 Hz with turbine harmonics), RCS hiss puffs as the ship trims attitude, idle hum settles at −24 dB. | — |
| 6 | 18.0–22.0 | Held orbit shot, slow 1.2°/s drift. | Idle. Tugs orbit. | Theme continues. | Idle hum and occasional RCS puffs. | **Title card**: ship name in display type, "Commanded by <Captain>" beneath, faction crest. `introSeen` is written. |
| 7 | 22.0– | Letterbox retracts; camera eases to the resting composition of §6 (the same end frame as the return coast-in, so the two paths agree). | — | Theme at menu intensity. | Hum fades to the menu idle level. | **Captain's hail**: comm card with the captain's synthesized voice (`playUtterance`) and caption; then "Board <ship name>" opens the Mission Log aboard. "Later" dismisses. |

Total runtime before the hail: **22 s**. The hail is player-paced.

### Camera grammar

- Reuse the `shots.js` recipes rather than invent new ones; add four timeline wrappers (`arrive`, `approach`,
  `pass`, `settle`) that place the shared recipes relative to the planet and blend between them.
- **Cuts, not swoops,** between beats 1→2, 2→3 and 3→4. Each cut follows the 180° rule (the ship always travels
  left to right on screen). Beat 4→5 is the only long camera move: a 3-second ease-out pull back.
- Portrait phones: no letterbox; lenses keep horizontal coverage (`lensFov`), so the ship stays the same size
  across the width and the planet fills the lower half.

## 4. Audio design

### Mix and buses

- **Music** plays on the music bus (`getMusicBus`). **Engines, SFX and voice** play on the game bus
  (`getGameBus`) so the player's channel volumes apply.
- During beats 2–3 the music is **sidechain-ducked** by the roar: −4 dB when roar loudness passes −12 LUFS
  short-term, 80 ms attack, 400 ms release. Music stays audible; the pass hit is the one moment where both
  peak together, and that is deliberate.
- True peak ceiling −1 dBFS; target −16 LUFS integrated for the cinematic (about 2 LU above the menu).

### Arrival music cue

- One **arrival cue per faction**, 22 s, written in the key and tempo of that planet's theme
  (`src/data/music.js`), so it can resolve into the theme at t = 14–18 without a seam.
- Fixed **hit points** shared by every faction cue: 2.0 (arrival), 9.2 (pass), 14.0 (power-down), 18.0 (title).
  Composers hit these; the timeline listens for them, never the other way round.
- Until commissioned cues exist, `music.js` plays a **synthesized fallback**: the planet theme's pad, plus a
  four-note motif on a brass-like detuned saw and timpani-style noise hits on the four hit points. It needs no
  assets and is good enough to review the timing.
- Add `musicCue(key, cue, startAt)` to `music.js`; it supports file tracks (OGG/M4A, about 350 KB each) with
  the fallback when a file is missing.

### Engine roar (synthesized, per faction)

Built in Web Audio from the shared noise buffer (`getNoiseBuf`) so there are no large files and it can follow
`engineFx` intensity exactly:

| Layer | Source | Role |
|---|---|---|
| Sub | 2 detuned saws at 32–45 Hz → lowpass 120 Hz | The weight. Felt more than heard. |
| Rumble | Noise → bandpass 80–300 Hz | Body of the roar. |
| Crackle | Noise → waveshaper → highpass 2 kHz, amplitude-modulated by slow random LFO | The "tearing" texture up close. Gated in only when the ship is near. |
| Turbine | Sine + 3 harmonics, 180–600 Hz | Gives the Doppler something tonal to drop. |

- **Intensity** (`engineFx.intensity`) drives gain and lowpass cutoff of every layer, so the burn, braking and
  idle all come from one control.
- **Distance** drives a lowpass (far ships lose the top end) and the crackle gate.
- **Doppler** uses the ship's radial velocity to the camera to detune the turbine and rumble layers;
  **pan** follows the ship's screen-space X.
- **Faction timbre**: a small table of offsets — Arcane deeper and choral (formant filter), Tech cleaner and
  more turbine, Collective heavier sub, Lumen brighter, Dark with a ring-mod shimmer — so each ship sounds like
  its propulsion colour looks.

### Other cues

Comm static ping (exists: `playSweep`), arrival thunder, retro thumps ×4, hull creaks, power-down whine,
RCS hiss puffs, running-lights tick, title impact (soft, under the music), captain's hail (exists:
`playUtterance` via the captain's faction voice). Every cue is captioned when captions are on.

## 5. Per-faction variation

The structure and timings are identical for all nine ships; the dressing changes.

| Planet (key) | Ship | Captain | Model | Engine colour | Arrival flash |
|---|---|---|---|---|---|
| Verdance (ground) | Halbrecht's Oath | Colonel Aldric Vane | powder | ember red | Shockwave ring, ember sparks |
| Florael (air) | Dawnwing Carrier | Squadron-Mother Hikari "Dawnwing" Aoi | air | pale blue-white | Clean white flash, escort fighters peel off in beat 5 |
| Ochre (hightech) | Sterling Meridian | R&D Lead Amara Okonkwo | tech *(confirm)* | gold | Gold lattice that unfolds into the hull |
| Kessra (artillery) | Siegeholm | Fire-Director Yusuf Kaya | artillery | orange | Heavy orange flash, gun turrets traverse during braking |
| Rime (water) | Reefmother Leviathan | Chieftain Coral of the Reef-Born | water | teal | Teal ripple, like surfacing |
| Cinder (arcane) | Cathedral of the Lamp | Lightbearer Cassian | arcane | magenta *(blood red? confirm)* | Blood-red rift that bleeds light |
| Lumen (space) | Vale's Horizon | Commander Idris Vale | lumen | cyan | Cyan collar rings light up one by one |
| Xenthe (dark) | The Manifesto | Sister Maren | dark | violet | The stars go out around it, then it is there |
| Vexmire (greenies) | Hivemother Ark | Steward Bractus | green | chem green | Green bio-glow pulse; cargo pods unlatch tugs |

## 6. Return coast-in

On every later visit the ship is simply present, with a small arrival so it feels alive.

- **Resting composition.** Upper-right of the planet, above the lit limb, bow pointing left and slightly down
  toward the planet. The ship spans about **24 % of the screen width** (landscape) or **55 %** (portrait, in the
  band above the globe). It must not overlap the planet's menu buttons; the anchor is a DOM element
  (`data-ship-anchor`) like the globe's `data-survey`, so layout owns the space.
- **Coast-in (3.5 s).** The ship enters from just off the top-right edge travelling bow-first along its
  heading, ease-out cubic, engines 0.6 → 0.35, and ends in the resting composition with a short RCS puff.
  No letterbox, no music change; the engine hum plays at −24 dB, panned to the ship's side.
- **Idle.** Slow ±0.3° roll and 1 % bob, running lights blink, one or two tugs circle. Tapping the ship opens
  the ship panel (Mission Log aboard, "Replay arrival").
- **Reduced motion:** the ship fades in at rest over 0.5 s.

## 7. Skip, accessibility, safety

- **Skip:** after 2 s, a "Hold to skip" ring appears bottom-right on input. Hold 0.6 s (tap-and-hold, Space,
  Esc or gamepad B). Skipping jumps to beat 7 (title card and hail), so the player still learns the ship's
  name and captain. Accidental taps never skip.
- **Captions:** comm lines always captioned; SFX captions (`[engines roar]`, `[engines power down]`) follow
  the existing captions setting.
- **Reduced motion** (OS setting or the game's own option): a cut-only version — three held shots (approach,
  orbit, title) with crossfades, no camera moves, no shake, no CA, flash replaced by a fade.
- **Photosensitivity:** the arrival flash is a single luminance rise over ≥ 200 ms and decays over ≥ 600 ms;
  never more than 3 flashes in any second (WCAG 2.3.1). Retro-thruster pulses are small in frame.
- **Audio off / muted:** the cinematic still plays; captions carry the sound story.
- **Interruption:** app backgrounded → pause timeline and audio; on return resume from the start of the
  current beat.

## 8. Technical plan

### Modules

| Module | Responsibility |
|---|---|
| `src/render3d/ships/arrival.js` *(new)* | Pure timeline: `arrivalAt(t, {box, planet, aspect, reducedMotion})` → camera (position, target, fov), ship transform, engine intensity, fx params (bloom gain, CA, flare, letterbox, haze), tug launch, UI events. `coastAt(t, …)` for the return path. No three.js state — tested with `node --test` like `shots.test.mjs`. |
| `src/render3d/ships/arrivalStage.js` *(new)* | Full-screen takeover: its own canvas, renderer and HDR chain (`hdrBloom`, `tonemapPass`, lens pass, `createLensFlare`), backdrop, the planet (reusing the globe module), the ship (`prepareShip`), `createEngineFx`, `createTugs`. Created on demand and disposed after the hail, so the menu pays nothing at rest. |
| `src/audio/engineRoar.js` *(new)* | The synthesized roar of §4, driven each frame by `{intensity, distance, radialVelocity, pan}`; faction timbre table. |
| `src/audio/music.js` | Add `musicCue()` with hit-point metadata and the synthesized fallback. |
| `src/menu/shipPresence.js` *(new)* | Decides arrival vs coast-in on planet screen open; owns `introSeen`; drives the return coast-in inside `menuStage` (LOD1 ship, no composer, engines at idle, one tug). |
| `src/menu/missionLog.js` | A `ship` queue entry is consumed by the arrival's end card instead of the toast when the cinematic plays. |
| `src/save/missionFlow.js` | `introSeen` flag and migration. |

### Loading

The ship GLB (LOD0, about 200 KB), its textures and the music cue start loading on the results screen that
awards the ship. If they are not ready when the planet screen opens, the sequence starts with the comm
static and "Long-range contact" caption (beat 0 is asset-free) and holds there up to 3 s; after that it
falls back to the coast-in and tries the arrival again next visit.

### Performance budget

| Tier | Ship | Post | Target |
|---|---|---|---|
| Desktop / high | LOD0, point lights, 6 tugs | Full HDR chain: bloom, flare, CA, grain, haze | 60 fps |
| Mobile / mid | LOD0 (5.9k tris max is fine), no point lights, 4 tugs | Half-res bloom, flare sprites only, no CA, no grain | 60 fps, floor 30 |
| Low | LOD1, 2 tugs | Bloom only | 30 fps |

The cinematic owns the GPU while it runs (the menu canvas pauses), so this is the one place the full effects
stack is affordable. Draw calls: ship 2, engines 2, tugs 3, planet 2–3, backdrop 3, post 4–5 — under 20.

### Review prototype

`tools/ships/arrival.html?ship=<slug>&first=1` plays the full sequence with a scrub bar, beat markers,
`?reduced=1`, `?tier=low|mid|high` and `?mute=1`, so the owner can review timing and sound outside the game.

## 9. Open decisions

1. **Ochre (hightech) model** — tech or collective? The collective model is otherwise unused.
2. **Arcane propulsion colour** — keep magenta, or match the new blood-red hull lights?
3. **Skip counts as seen?** Proposed yes (a skipper chose to skip). Replay stays available.
4. **Music** — commission nine 22-second cues against the hit points, or ship with the synthesized fallback
   and commission later?
5. **Captain hail lines** — one line each, ≤ 12 words, written by the narrative owner. Placeholder:
   "<Captain>, <ship> reporting. We hold orbit — your missions await aboard."

## 10. Story breakdown

| # | Story | Done when |
|---|---|---|
| 1 | Arrival timeline (`arrival.js`) | `arrivalAt`/`coastAt` return the §3/§6 values; tests cover beat boundaries, hit points, portrait framing and reduced motion. |
| 2 | Arrival stage and review prototype | `tools/ships/arrival.html` plays all nine ships at the three tiers with the scrub bar. |
| 3 | Engine roar synth | Roar follows intensity, distance, Doppler and pan; faction timbres audibly differ; mixed per §4. |
| 4 | Arrival music cue | `musicCue` with hit points and synthesized fallback; resolves into each planet theme without a seam. |
| 5 | Trigger, persistence and hand-off | First visit after unlock plays once; `introSeen` saved; skip and replay work; mission-log toast replaced by the hail. |
| 6 | Return coast-in | Ship coasts to the DOM anchor on every later visit, idles, opens the ship panel on tap. |
| 7 | Accessibility and mobile pass | Captions, reduced-motion cut, flash limits, backgrounding, mobile tier holds 30 fps floor on the reference phone. |
