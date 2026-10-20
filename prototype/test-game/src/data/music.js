/**
 * src/data/music.js — each planet's music theme [MM-story_mvgzp51o_8].
 *
 * Owner 2026-10-20: "creating music tracks for each planet … prototype on the Power faction planet" → the
 * Ground / Powder homeworld. Pure data + pure maths (node-tested by music.test.mjs); src/audio/music.js plays it.
 *
 * A theme is a looped score in two LAYERS that run in lock-step and crossfade by intensity:
 *   build — the breather between waves (also the menu mix): drone, bass, a marching pulse
 *   wave  — added on top when a wave starts: snare rudiments, toms, brass stabs, the bugle line
 * plus two STINGS (win / lose) that play once over a fade-out.
 *
 * Score format: `steps` per bar (16 = sixteenth notes), `bars` per loop, one chord per bar. A voice plays its
 * one-bar `pattern` every bar ('x' hit, '>' accented hit, '.' rest) on its `note` ('root' | 'fifth' | 'chord'
 * | a fixed midi number), or a `melody` of [bar, step, midi, lenSteps] over the whole loop.
 * `files` (optional): recorded/AI tracks that REPLACE the synth — { build, wave, win, lose } paths under
 * content/music/, each loop exactly one theme loop long so the two layers stay aligned. Drop them in, set the
 * paths, and the code-generated score steps aside.
 */
const CHORD = { m: [0, 3, 7], M: [0, 4, 7], sus: [0, 5, 7], m7: [0, 3, 7, 10], '7': [0, 4, 7, 10] };
const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

/** 'Dm' / 'Bb' / 'A7' → { root: midi (octave 3), tones: [midi…] } */
export function parseChord(name, octave = 3) {
  const m = /^([A-G](?:#|b)?)(m7|m|7|sus|M)?$/.exec(name);
  if (!m) throw new Error('music: bad chord ' + name);
  const root = 12 * (octave + 1) + NOTE[m[1]];
  return { root, tones: CHORD[m[2] || 'M'].map((i) => root + i) };
}

export const THEMES = Object.freeze({
  // GROUND / POWDER — "Powder and Iron": a minor-key march. Field drums and a low drone between waves; when the
  // wave comes, snare rudiments, timpani-like toms, brass stabs and a bugle call over the top.
  ground: Object.freeze({
    title: 'Powder and Iron',
    bpm: 100, steps: 16, bars: 8,
    chords: ['Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'A', 'A7'],
    mix: { build: 0.55, wave: 1.0, menu: 0.4 },   // the build layer sits back so a wave arriving is felt
    voices: [
      // ── build ──
      { id: 'drone', inst: 'pad',   layer: 'build', note: 'chord', octave: 3, pattern: 'x...............', len: 16, gain: 0.22 },
      { id: 'bass',  inst: 'bass',  layer: 'build', note: 'root',  octave: 2, pattern: 'x.....x.x.......', len: 3,  gain: 0.5 },
      { id: 'kick',  inst: 'kick',  layer: 'build', pattern: 'x.......x.......', gain: 0.75 },
      { id: 'side',  inst: 'snare', layer: 'build', pattern: '....x.......x..x', gain: 0.28 },
      { id: 'tick',  inst: 'hat',   layer: 'build', pattern: 'x.x.x.x.x.x.x.x.', gain: 0.06 },
      // ── wave ──
      { id: 'roll',  inst: 'snare', layer: 'wave', pattern: '>.xx>.x.>.xx>xxx', gain: 0.42 },
      { id: 'kick2', inst: 'kick',  layer: 'wave', pattern: '....x.......x.x.', gain: 0.6 },
      { id: 'tom',   inst: 'tom',   layer: 'wave', note: 'root', octave: 2, pattern: 'x.........x.x.x.', gain: 0.5 },
      { id: 'brass', inst: 'brass', layer: 'wave', note: 'chord', octave: 3, pattern: '>..x..x...>.....', len: 2, gain: 0.3 },
      { id: 'bugle', inst: 'lead',  layer: 'wave', gain: 0.24, melody: [
        // bar 1–2 (Dm): the call — D A D F
        [0, 0, 62, 2], [0, 3, 69, 2], [0, 6, 74, 4], [0, 12, 77, 4], [1, 0, 76, 3], [1, 4, 74, 2], [1, 8, 69, 8],
        // bar 3–4 (Bb): answer
        [2, 0, 70, 2], [2, 3, 74, 2], [2, 6, 77, 4], [2, 12, 74, 4], [3, 0, 72, 4], [3, 6, 70, 2], [3, 8, 69, 8],
        // bar 5–6 (Gm): climb
        [4, 0, 67, 2], [4, 3, 70, 2], [4, 6, 74, 2], [4, 9, 79, 3], [4, 12, 77, 4], [5, 0, 74, 4], [5, 6, 70, 2], [5, 8, 74, 8],
        // bar 7–8 (A → A7): the hold that turns back to D
        [6, 0, 76, 4], [6, 6, 73, 2], [6, 8, 69, 8], [7, 0, 73, 2], [7, 3, 76, 2], [7, 6, 79, 4], [7, 12, 81, 4],
      ] },
    ],
    stings: {
      // victory: a D-major bugle fanfare over a snare roll; defeat: a falling minor line over toms
      win:  { bpm: 120, notes: [[0, 62, 2], [2, 66, 2], [4, 69, 2], [6, 74, 6], [12, 74, 2], [14, 78, 10]], chord: 'D', drum: 'roll' },
      lose: { bpm: 70,  notes: [[0, 69, 4], [4, 65, 4], [8, 62, 4], [12, 61, 12]], chord: 'Dm', drum: 'toms' },
    },
    files: null,
  }),
});

/** The theme for a planet key, or null (no music yet → silence, never an error). */
export const themeFor = (key) => THEMES[key] || null;

/** Seconds per step and per loop. */
export const stepSec = (t) => 60 / t.bpm / (t.steps / 4);
export const loopSec = (t) => stepSec(t) * t.steps * t.bars;

/**
 * Everything that sounds at absolute step `n` (loops forever): [{ voice, inst, layer, midi:[…], len, gain, accent }].
 * Pure — the engine schedules what this returns; the tests read it.
 */
export function stepEvents(t, n) {
  const per = t.steps * t.bars, s = ((n % per) + per) % per, bar = Math.floor(s / t.steps), st = s % t.steps;
  const chord = parseChord(t.chords[bar], 3), out = [];
  for (const v of t.voices) {
    if (v.melody) {
      for (const [b, k, midi, len] of v.melody) if (b === bar && k === st) out.push({ voice: v.id, inst: v.inst, layer: v.layer, midi: [midi], len, gain: v.gain, accent: false });
      continue;
    }
    const c = v.pattern[st];
    if (c !== 'x' && c !== '>') continue;
    const shift = 12 * ((v.octave ?? 3) - 3);
    let midi = [];
    if (v.note === 'root') midi = [chord.root + shift];
    else if (v.note === 'fifth') midi = [chord.root + 7 + shift];
    else if (v.note === 'chord') midi = chord.tones.map((m) => m + shift);
    else if (typeof v.note === 'number') midi = [v.note];
    out.push({ voice: v.id, inst: v.inst, layer: v.layer, midi, len: v.len || 1, gain: v.gain, accent: c === '>' });
  }
  return out;
}

/** The layer gains for an intensity: 'menu' (build only, softer), 'build', 'wave' (both). */
export function layerMix(t, intensity) {
  if (intensity === 'wave') return { build: t.mix.build, wave: t.mix.wave };
  if (intensity === 'menu') return { build: t.mix.menu, wave: 0 };
  return { build: t.mix.build, wave: 0 };
}

export const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
