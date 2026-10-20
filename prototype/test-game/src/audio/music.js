/**
 * src/audio/music.js — plays a planet's theme (data/music.js) on the music bus [MM-story_mvgzp51o_8].
 *
 * One player at a time. Both layers (build, wave) are always scheduled, in lock-step, into their own gain; the
 * INTENSITY only moves those gains, so a wave starting brings the battle layer in on the beat it's already on —
 * never a restart. A different planet crossfades (the old player fades out while the new one fades in).
 *
 *   musicPlay(key, intensity)   'menu' | 'build' | 'wave' — start / switch planet / change intensity
 *   musicIntensity(intensity)
 *   musicSting('win' | 'lose')  fade the loop and play the stinger once
 *   musicStop(fadeSec)
 *   musicResume()               call after the AudioContext exists (a user gesture) — starts what was asked for
 *   musicState()                { key, intensity, playing, mode } (diagnostics / tests)
 *
 * Presentation only — nothing here touches the sim, so Math.random-free determinism isn't at stake; the score
 * itself is fixed data, so a theme sounds the same every time anyway. The scheduler is the standard Web Audio
 * lookahead: a 25 ms timer queues every step that falls inside the next 120 ms on the audio clock.
 */
import { getAudioCtx, getMusicBus, getNoiseBuf, audioReady } from '../comm/voice.js';
import { themeFor, stepEvents, stepSec, loopSec, layerMix, parseChord, midiHz } from '../data/music.js';

const LOOKAHEAD = 0.12, TICK_MS = 25, XFADE = 1.4, LAYER_FADE = 0.9;

// the live game plays through voice.js's context + music bus; renderOffline swaps in an OfflineAudioContext
let offline = null;
const ac = () => (offline ? offline.ctx : getAudioCtx());
const outBus = () => (offline ? offline.bus : getMusicBus());
const nb = () => (offline ? offline.noise : getNoiseBuf());

let cur = null;            // the live player
let want = null;           // { key, intensity } asked for before audio existed
const bufCache = new Map();

export function musicState() {
  return cur ? { key: cur.key, intensity: cur.intensity, playing: true, mode: cur.files ? 'files' : 'synth' }
    : { key: want && want.key, intensity: want && want.intensity, playing: false, mode: null };
}

export function musicPlay(key, intensity = 'build') {
  const theme = themeFor(key);
  want = { key, intensity };
  if (!theme) { musicStop(XFADE); return false; }                  // no theme for this planet yet → silence
  if (!audioReady() || !outBus()) return false;               // musicResume() starts it after the first gesture
  if (cur && cur.key === key && !cur.ending) { musicIntensity(intensity); return true; }
  if (cur) fadeOut(cur, XFADE);
  cur = startPlayer(key, theme, intensity);
  return true;
}

export function musicIntensity(intensity) {
  if (want) want.intensity = intensity;
  if (!cur || cur.ending) return;
  cur.intensity = intensity;
  const AC = ac(), mix = layerMix(cur.theme, intensity), now = AC.currentTime;
  for (const L of ['build', 'wave']) ramp(cur.layers[L].gain, mix[L], now, LAYER_FADE);
}

export function musicStop(fadeSec = 1) {
  if (cur) fadeOut(cur, fadeSec);
  cur = null;
}

export function musicResume() {
  if (!want || cur || !audioReady()) return;
  musicPlay(want.key, want.intensity);
}

export function musicSting(kind) {
  const p = cur;
  if (!p || p.ending) return;
  const AC = ac(), t0 = AC.currentTime + 0.05;
  fadeOut(p, 0.6);
  cur = null;
  want = null;                                                     // the match is over; the next screen asks again
  const out = AC.createGain(); out.gain.value = 0.9; out.connect(outBus());
  if (p.files && p.files[kind]) playBuffer(p.files[kind], out, t0, false);
  else stingVoices(p.theme, kind, out, t0);
}

/** The synthesized stinger: the fanfare / falling line, a held chord, and a snare roll or toms under it. */
function stingVoices(theme, kind, out, t0) {
  const s = theme.stings && theme.stings[kind];
  if (!s) return;
  const sp = 60 / s.bpm / 4;                                       // sixteenths at the sting's tempo
  for (const [k, midi, len] of s.notes) lead(out, t0 + k * sp, midi, len * sp, 0.3);
  const ch = parseChord(s.chord, 3), end = Math.max(...s.notes.map(([k, , l]) => k + l)) * sp;
  pad(out, t0, ch.tones, end, 0.28);
  if (s.drum === 'roll') for (let i = 0; i < 12; i++) snare(out, t0 + i * sp * 0.5, 0.18 + i * 0.02, false);
  else for (let i = 0; i < 4; i++) tom(out, t0 + i * sp * 4, ch.root - 12, 0.5);
}

/* ── player ─────────────────────────────────────────────────────────────────────────────────────────── */
function startPlayer(key, theme, intensity) {
  const AC = ac(), now = AC.currentTime;
  const out = AC.createGain(); out.gain.value = 0; out.connect(outBus());
  ramp(out.gain, 1, now, XFADE);
  const mix = layerMix(theme, intensity);
  const layers = {};
  for (const L of ['build', 'wave']) { const g = AC.createGain(); g.gain.value = mix[L]; g.connect(out); layers[L] = g; }
  const p = { key, theme, intensity, out, layers, n: 0, next: now + 0.1, timer: null, ending: false, files: null, sources: [] };
  if (theme.files && theme.files.build) {
    loadFiles(theme.files).then((files) => {
      if (p.ending || !files) return;
      p.files = files;
      const t = Math.max(AC.currentTime + 0.05, p.next);
      clearInterval(p.timer); p.timer = null;                       // the recordings replace the synth score
      for (const L of ['build', 'wave']) if (files[L]) p.sources.push(playBuffer(files[L], p.layers[L], t, true));
    });
  }
  p.timer = setInterval(() => schedule(p), TICK_MS);
  schedule(p);
  return p;
}

function schedule(p) {
  if (p.ending) return;
  const AC = ac(), dt = stepSec(p.theme);
  while (p.next < AC.currentTime + LOOKAHEAD) {
    for (const e of stepEvents(p.theme, p.n)) play(e, p.layers[e.layer], p.next, dt);
    p.n++; p.next += dt;
  }
}

function fadeOut(p, sec) {
  if (!p || p.ending) return;
  p.ending = true;
  const AC = ac(), now = AC.currentTime;
  ramp(p.out.gain, 0, now, Math.max(0.05, sec));
  clearInterval(p.timer);
  setTimeout(() => {
    for (const s of p.sources) { try { s.stop(); } catch (e) { /* not started */ } }
    try { p.out.disconnect(); } catch (e) { /* gone */ }
  }, (sec + 0.3) * 1000);
}

function ramp(param, to, now, sec) {
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(to, now + sec);
}

/* ── recorded tracks (drop-in) ─────────────────────────────────────────────────────────────────────── */
async function loadFiles(paths) {
  const AC = ac(), out = {};
  try {
    for (const k of ['build', 'wave', 'win', 'lose']) {
      if (!paths[k]) continue;
      if (!bufCache.has(paths[k])) {
        const r = await fetch(paths[k]);
        if (!r.ok) throw new Error(paths[k] + ' → ' + r.status);
        bufCache.set(paths[k], await AC.decodeAudioData(await r.arrayBuffer()));
      }
      out[k] = bufCache.get(paths[k]);
    }
    return out;
  } catch (e) {
    console.warn('[music] track files failed — keeping the synth score:', e && e.message);
    return null;
  }
}
function playBuffer(buf, dest, t, loop) {
  const AC = ac(), s = AC.createBufferSource();
  s.buffer = buf; s.loop = loop; s.connect(dest); s.start(t);
  return s;
}

/* ── instruments (all synthesized; dest = a layer gain) ───────────────────────────────────────────── */
function play(e, dest, t, dt) {
  const g = e.gain * (e.accent ? 1.35 : 1), dur = e.len * dt;
  switch (e.inst) {
    case 'kick': return kick(dest, t, g);
    case 'snare': return snare(dest, t, g, e.accent);
    case 'hat': return hat(dest, t, g);
    case 'tom': return tom(dest, t, e.midi[0], g);
    case 'bass': return bass(dest, t, e.midi[0], dur, g);
    case 'pad': return pad(dest, t, e.midi, dur, g);
    case 'brass': return brass(dest, t, e.midi, dur, g);
    case 'lead': return lead(dest, t, e.midi[0], dur, g);
    default: return undefined;
  }
}
function env(g, t, peak, a, d, sustain = 0, hold = 0, r = 0.05) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  if (hold > 0) { g.gain.linearRampToValueAtTime(peak * sustain || 0.0001, t + a + d); g.gain.setValueAtTime(peak * sustain || 0.0001, t + a + d + hold); g.gain.linearRampToValueAtTime(0.0001, t + a + d + hold + r); return t + a + d + hold + r; }
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  return t + a + d;
}
function osc(type, hz, t, end, dest, detune = 0) {
  const AC = ac(), o = AC.createOscillator();
  o.type = type; o.frequency.setValueAtTime(hz, t); o.detune.value = detune;
  o.connect(dest); o.start(t); o.stop(end + 0.05);
  return o;
}
function noise(t, end, dest) {
  const AC = ac(), buf = nb(); if (!buf) return null;
  const s = AC.createBufferSource(); s.buffer = buf; s.connect(dest); s.start(t, Math.random() * 0.5); s.stop(end + 0.05);
  return s;
}
function kick(dest, t, g) {
  const AC = ac(), a = AC.createGain(); a.connect(dest);
  const end = env(a, t, g, 0.004, 0.32);
  const o = osc('sine', 120, t, end, a); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
}
function snare(dest, t, g, accent) {
  const AC = ac(), a = AC.createGain(), bp = AC.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = accent ? 2100 : 1800; bp.Q.value = 0.7;
  bp.connect(a); a.connect(dest);
  const end = env(a, t, g, 0.002, accent ? 0.18 : 0.12);
  noise(t, end, bp);
  const b = AC.createGain(); b.connect(dest); const e2 = env(b, t, g * 0.5, 0.002, 0.07); osc('triangle', 190, t, e2, b);
}
function hat(dest, t, g) {
  const AC = ac(), a = AC.createGain(), hp = AC.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 7000; hp.connect(a); a.connect(dest);
  noise(t, env(a, t, g, 0.001, 0.04), hp);
}
function tom(dest, t, midi, g) {
  const AC = ac(), a = AC.createGain(); a.connect(dest);
  const end = env(a, t, g, 0.003, 0.42);
  const o = osc('sine', midiHz(midi) * 2, t, end, a); o.frequency.exponentialRampToValueAtTime(midiHz(midi), t + 0.25);
}
function bass(dest, t, midi, dur, g) {
  const AC = ac(), a = AC.createGain(), lp = AC.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 420; lp.connect(a); a.connect(dest);
  const end = env(a, t, g, 0.01, 0.08, 0.7, Math.max(0.02, dur - 0.1), 0.08);
  osc('sawtooth', midiHz(midi), t, end, lp); osc('triangle', midiHz(midi) / 2, t, end, lp);
}
function pad(dest, t, tones, dur, g) {
  const AC = ac(), a = AC.createGain(), lp = AC.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.4; lp.connect(a); a.connect(dest);   // a dark drone under the march
  const end = env(a, t, g / Math.sqrt(tones.length), 0.6, 0.4, 0.8, Math.max(0.1, dur - 1.2), 0.6);
  for (const m of tones) { osc('sawtooth', midiHz(m), t, end, lp, -7); osc('sawtooth', midiHz(m), t, end, lp, 7); }
}
function brass(dest, t, tones, dur, g) {
  const AC = ac(), a = AC.createGain(), lp = AC.createBiquadFilter();
  lp.type = 'lowpass'; lp.Q.value = 2;
  lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(2600, t + 0.06); lp.frequency.exponentialRampToValueAtTime(900, t + 0.3);
  lp.connect(a); a.connect(dest);
  const end = env(a, t, g / Math.sqrt(tones.length), 0.03, 0.12, 0.6, Math.max(0.02, dur - 0.15), 0.12);
  for (const m of tones) { osc('sawtooth', midiHz(m + 12), t, end, lp, -5); osc('sawtooth', midiHz(m + 12), t, end, lp, 5); }
}
function lead(dest, t, midi, dur, g) {
  const AC = ac(), a = AC.createGain(), lp = AC.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 3200; lp.connect(a); a.connect(dest);
  const end = env(a, t, g, 0.025, 0.1, 0.75, Math.max(0.03, dur - 0.15), 0.1);
  const o1 = osc('square', midiHz(midi), t, end, lp), o2 = osc('sawtooth', midiHz(midi), t, end, lp, 4);
  if (dur > 0.3) {                                                  // a bugler's vibrato on held notes
    const lfo = AC.createOscillator(), depth = AC.createGain();
    lfo.frequency.value = 5.5; depth.gain.setValueAtTime(0, t); depth.gain.linearRampToValueAtTime(9, t + 0.25);
    lfo.connect(depth); depth.connect(o1.detune); depth.connect(o2.detune); lfo.start(t); lfo.stop(end + 0.05);
  }
}

/**
 * Render a theme to an AudioBuffer offline (the preview page + WAV export). `plan` = [{ at: seconds, intensity }]
 * — e.g. build for one loop, then a wave — and `sting` ('win' | 'lose') plays at `seconds - 4` if given.
 */
export async function renderOffline(key, plan, seconds, sting = null, rate = 44100) {
  const theme = themeFor(key); if (!theme) throw new Error('no theme for ' + key);
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
  const bus = ctx.createGain(); bus.gain.value = 0.6;
  const comp = ctx.createDynamicsCompressor(); bus.connect(comp); comp.connect(ctx.destination);
  const noise = ctx.createBuffer(1, rate, rate); const d = noise.getChannelData(0);
  let sd = 12345; for (let i = 0; i < rate; i++) { sd = (sd * 16807) % 2147483647; d[i] = sd / 1073741823.5 - 1; }
  offline = { ctx, bus, noise };
  try {
    const dt = stepSec(theme), end = sting ? seconds - 4 : seconds;
    const layers = {}; for (const L of ['build', 'wave']) { const g = ctx.createGain(); g.connect(bus); layers[L] = g; }
    let last = layerMix(theme, plan[0].intensity);
    for (const L of ['build', 'wave']) layers[L].gain.setValueAtTime(last[L], 0);
    for (const p of plan.slice(1)) {                              // each change crossfades from its own moment
      const m = layerMix(theme, p.intensity);
      for (const L of ['build', 'wave']) { layers[L].gain.setValueAtTime(last[L], p.at); layers[L].gain.linearRampToValueAtTime(m[L], p.at + LAYER_FADE); }
      last = m;
    }
    for (let n = 0, t = 0.05; t < end; n++, t += dt) for (const e of stepEvents(theme, n)) play(e, layers[e.layer], t, dt);
    if (sting) {
      for (const L of ['build', 'wave']) { layers[L].gain.setValueAtTime(last[L], end); layers[L].gain.linearRampToValueAtTime(0, end + 0.6); }
      stingVoices(theme, sting, bus, end);
    }
    return await ctx.startRendering();
  } finally { offline = null; }
}

export { loopSec };
