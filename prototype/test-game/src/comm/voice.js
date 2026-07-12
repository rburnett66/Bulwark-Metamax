/**
 * src/comm/voice.js  [comm-dialog]
 *
 * The BULWARK procedural voice engine — extracted verbatim-in-spirit from the Comm Array tool
 * (bulwark-comm-screen v1.0, 2026-07-11) so the battle screen and the tool (comm.html) share one
 * implementation. Each faction speaks an invented "cant": syllable beats with a pitch contour
 * (statement falls, question rises, exclaim alternates, trail sinks) synthesized through a
 * per-faction WebAudio timbre (wave + formant bandpasses + drive/ringmod/detune/sub/octave) and a
 * per-faction channel-static carrier bed. The typed text on the card is the "translation".
 *
 * Pure/testable (no DOM, no audio): hash, countSyllables, buildBeats, utterDuration.
 * Audio (lazy AudioContext, safe to import headless): initAudio, playUtterance, startStatic,
 * playSweep, playDrop, setVolume.
 */

/* ---------- faction icons + portrait (inline SVG) ---------- */
export const ICONS = {
  ground: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2 20 5v6c0 5-4 9-8 11-4-2-8-6-8-11V5z"/><path d="M12 8v6M9 11h6" stroke-linecap="round"/></svg>',
  air: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 15c6-1 8-6 10-10 2 4 4 9 10 10"/><path d="M7 15l5-4 5 4"/></svg>',
  hightech: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l8.5 5v10L12 22l-8.5-5V7z"/><path d="M12 7v10M8 9.5v5M16 9.5v5" stroke-linecap="round"/></svg>',
  artillery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 20L18 6M6 4l14 14"/><circle cx="12" cy="12" r="2.4"/></svg>',
  water: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 3v18M7 6l5-3 5 3M6 8v3a6 6 0 0012 0V8"/></svg>',
  arcane: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3.4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke-linecap="round"/></svg>',
  space: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="11" ry="4.2" transform="rotate(-25 12 12)"/></svg>',
  dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 2l9 10-9 10-9-10z"/><path d="M12 2v20M7 8l5 3 5-3"/></svg>',
  greenies: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="7" r="3"/><circle cx="7" cy="15" r="3"/><circle cx="17" cy="15" r="3"/><path d="M12 10v2M9.5 13l-1 1M14.5 13l1 1" stroke-linecap="round"/></svg>',
};
export const PORTRAIT = '<svg viewBox="0 0 100 100"><circle cx="50" cy="36" r="17"/><path d="M22 94c0-17 12-27 28-27s28 10 28 27z"/></svg>';

/* ---------- §7.5 faction voice profiles + comm skins + sample cast ---------- */
export const FACTIONS = {
  ground: { name: 'Ground / Powder', trope: 'Nationalistic', color: '#c9962f',
    pitchM: 110, pitchF: 175, wave: 'sawtooth', f1: 700, f2: 1100, rate: 5.0, noise: 0.15, reverb: 0.15,
    drive: 0.35, ringmod: 0, detune: 0, octave: false, lowpass: 6000, attack: 0.012, sustain: 0.18, overlap: 0.10,
    cast: [
      { n: 'Chancellor Wilhelmina Graf', a: 'PE', g: 'female', intent: 'statement', line: 'You approach the seat of order, trespasser. Kneel, or be balanced against.' },
      { n: 'General Kord Stahl', a: 'E', g: 'male', intent: 'statement', line: 'Step onto my field and become a grave that means something.' },
      { n: 'Sergeant "Bricks" Malloy', a: 'CG', g: 'male', intent: 'exclaim', line: 'You touch my lads and I get real interested, real quick!' },
    ] },
  air: { name: 'Air', trope: 'Manga', color: '#48c7e6',
    pitchM: 165, pitchF: 245, wave: 'triangle', f1: 500, f2: 2200, rate: 7.0, noise: 0.05, reverb: 0.10,
    drive: 0.05, ringmod: 0, detune: 6, octave: false, lowpass: 9000, attack: 0.015, sustain: 0.25, overlap: 0.20,
    cast: [
      { n: 'Squadron-Mother Hikari "Dawnwing" Aoi', a: 'AG', g: 'female', intent: 'trail', line: 'You came up to my sky, groundling. Everyone comes home to me eventually…' },
      { n: 'Renegade "Viper" Ryu', a: 'CE', g: 'male', intent: 'exclaim', line: "Come on up, little snack — the sky belongs to whoever's fastest!" },
      { n: 'Ace Jun "Halo" Sato', a: 'PG', g: 'male', intent: 'statement', line: "If you're taking my sky, you'd better cover the pilot next to you." },
    ] },
  hightech: { name: 'High Tech', trope: 'Capitalist', color: '#8fb6ff',
    pitchM: 130, pitchF: 200, wave: 'square', f1: 400, f2: 1800, rate: 6.0, noise: 0.03, reverb: 0.12,
    drive: 0.0, ringmod: 0, detune: 0, octave: false, lowpass: 7000, bitcrush: true, attack: 0.008, sustain: 0.12, overlap: 0.05,
    cast: [
      { n: 'CEO Adrian Sterling', a: 'PE', g: 'male', intent: 'statement', line: "I don't compete. I acquire. You are a debt I intend to collect in full." },
      { n: 'Hacker "Null" (Priya Nair)', a: 'CG', g: 'female', intent: 'statement', line: "Adrian's got a floor of lawyers looking for me, and here I am playing with you. Try to keep up." },
      { n: 'COO Marcus Thorne', a: 'E', g: 'male', intent: 'statement', line: 'Growth is not negotiable. You are the kind of drag I optimize away.' },
    ] },
  artillery: { name: 'Artillery', trope: 'Military', color: '#d9a441',
    pitchM: 85, pitchF: 150, wave: 'square', f1: 600, f2: 900, rate: 3.5, noise: 0.20, reverb: 0.25,
    drive: 0.25, ringmod: 0, detune: 0, octave: false, lowpass: 3400, sub: true, attack: 0.012, sustain: 0.10, overlap: 0.10,
    cast: [
      { n: 'Warlord-Gunner Vex Marrow', a: 'CE', g: 'male', intent: 'statement', line: "I flattened a reef once for less. Let's hear what you sound like." },
      { n: 'Chaplain-Gunner Ruth Bellamy', a: 'AG', g: 'female', intent: 'statement', line: 'Step onto my map, target. I will pray over your coordinates before I fire on them.' },
      { n: 'Grand-Bombardier Seline Voss', a: 'PE', g: 'female', intent: 'statement', line: 'You have raised yourself too high. Symmetry requires a crater of equal depth.' },
    ] },
  water: { name: 'Water', trope: 'Sea-tribe Fantasy', color: '#33c3b0',
    pitchM: 120, pitchF: 190, wave: 'sine', f1: 450, f2: 1000, rate: 4.5, noise: 0.10, reverb: 0.55,
    drive: 0.0, ringmod: 0, detune: 9, octave: false, lowpass: 2600, attack: 0.05, sustain: 0.50, overlap: 0.45,
    cast: [
      { n: 'Abyssal Sovereign Thal', a: 'PE', g: 'male', intent: 'statement', line: 'You swim into my depths unbowed. The pressure will teach you the posture you refused.' },
      { n: 'Tide-Priestess Marena', a: 'AG', g: 'female', intent: 'statement', line: 'You stand where the water decides, landwalker. Kneel, and let the tide read you.' },
      { n: 'Chieftain Coral of the Reef-Born', a: 'PG', g: 'female', intent: 'exclaim', line: 'Strike his guns from the tide! The shoal will sing your name!' },
    ] },
  arcane: { name: 'Arcane / Energy', trope: 'Theocracy', color: '#d7b24a',
    pitchM: 140, pitchF: 210, wave: 'sine', f1: 500, f2: 1500, rate: 4.0, noise: 0.05, reverb: 0.75,
    drive: 0.0, ringmod: 0, detune: 0, octave: true, lowpass: 6000, attack: 0.06, sustain: 0.55, overlap: 0.50,
    cast: [
      { n: 'The Ordained Prime, Vaelith', a: 'PE', g: 'male', intent: 'statement', line: 'Between her mercy and my judgment there is no quarrel. Kneel while kneeling is still permitted.' },
      { n: 'Hierophant Aurelia', a: 'AG', g: 'female', intent: 'statement', line: 'You come to the altar unbelieving. Hold still while the Light finds you.' },
      { n: 'Inquisitor Mordane', a: 'E', g: 'male', intent: 'statement', line: 'You are doubt made flesh. Confess, or combust.' },
    ] },
  space: { name: 'Space Tech', trope: 'Sci-Fi Federation', color: '#7fd8ff',
    pitchM: 120, pitchF: 195, wave: 'square', f1: 400, f2: 2000, rate: 6.0, noise: 0.08, reverb: 0.20,
    drive: 0.0, ringmod: 170, detune: 0, octave: false, lowpass: 8000, attack: 0.010, sustain: 0.20, overlap: 0.10,
    cast: [
      { n: 'The Signal', a: 'DE', g: 'neutral', intent: 'statement', line: 'We hear your transmission, local. Convert. Assimilate. Continue.' },
      { n: 'Admiral Sarn', a: 'E', g: 'male', intent: 'statement', line: 'You are an ungoverned variable. Submit to the order, or be corrected out of it.' },
      { n: 'Envoy Lyra-9', a: 'AG', g: 'female', intent: 'statement', line: 'I come under open signal. Lower your guns, and I will lower mine last.' },
    ] },
  dark: { name: 'Dark Energy', trope: 'Cult / Movement', color: '#d1495b',
    pitchM: 75, pitchF: 140, wave: 'sawtooth', f1: 550, f2: 800, rate: 3.0, noise: 0.30, reverb: 0.62,
    drive: 0.35, ringmod: 0, detune: 5, octave: false, lowpass: 2200, sub: true, attack: 0.04, sustain: 0.45, overlap: 0.40,
    cast: [
      { n: 'The Architect, Malis', a: 'PE', g: 'male', intent: 'statement', line: 'You are a crooked line in a perfect plan, and I am the Architect of its correction.' },
      { n: 'The Hollow Prophet', a: 'DE', g: 'neutral', intent: 'trail', line: 'Set down your name with your walls. Nothing that ends here will have been you…' },
      { n: 'Sister Maren', a: 'PG', g: 'female', intent: 'statement', line: 'Yield, and I will shelter you myself. Do not make me choose.' },
    ] },
  greenies: { name: 'Greenies (Chem)', trope: 'Socialist Hive', color: '#8fd14f',
    pitchM: 200, pitchF: 280, wave: 'square', f1: 600, f2: 2600, rate: 9.0, noise: 0.25, reverb: 0.15,
    drive: 0.1, ringmod: 0, detune: 14, octave: false, lowpass: 9000, swarm: true, attack: 0.006, sustain: 0.05, overlap: 0.05,
    cast: [
      { n: 'The Root-Mind', a: 'PE', g: 'neutral', intent: 'statement', line: 'You are the fever, and I am the cool of the deep root come to correct you.' },
      { n: 'Mother-Spore Ilya', a: 'AG', g: 'female', intent: 'statement', line: 'Root here, or be rooted anyway — we love you the same.' },
      { n: 'Blight-Agitator Sear', a: 'CE', g: 'male', intent: 'exclaim', line: "Breathe it in, breathe it in! We'll be so equal!" },
    ] },
};
export const ORDER = ['ground', 'air', 'hightech', 'artillery', 'water', 'arcane', 'space', 'dark', 'greenies'];

/* The game's tables.js faction names -> comm voice keys (1:1 with the 9-faction roster). */
export const FACTION_KEY_BY_NAME = {
  'Ground / Powder': 'ground', 'Air': 'air', 'High Tech': 'hightech', 'Artillery': 'artillery',
  'Water': 'water', 'Arcane / Energy': 'arcane', 'Space Tech': 'space', 'Dark Energy': 'dark',
  'Greenies (Chem)': 'greenies',
};

/* per-faction loudness normalization (perceptual gain on the voice bus).
   Harsh/low timbres (square/saw + sub) carry more energy → trimmed below 1;
   soft timbres (sine/triangle) carry less → boosted above 1, so all land at similar loudness. */
export const VGAIN = { ground: 0.85, air: 1.15, hightech: 0.85, artillery: 0.50, water: 1.35,
  arcane: 1.30, space: 0.80, dark: 0.60, greenies: 0.72 };
export const REVERB_MULT = 1.5;   /* global voice-reverb boost (+50%) */

/* per-faction "channel static" bed — the carrier each voice rides in on */
export const STATIC = {
  ground: { type: 'bandpass', freq: 2000, q: 0.7, level: 0.045, trem: 0, tremDepth: 0 },
  air: { type: 'highpass', freq: 3200, q: 0.7, level: 0.040, trem: 0.3, tremDepth: 0.4 },
  hightech: { type: 'highpass', freq: 5200, q: 0.7, level: 0.026, trem: 0, tremDepth: 0 },
  artillery: { type: 'lowpass', freq: 420, q: 0.9, level: 0.060, trem: 2.0, tremDepth: 0.5 },
  water: { type: 'bandpass', freq: 820, q: 0.6, level: 0.050, trem: 0.8, tremDepth: 0.7, rev: 0.3 },
  arcane: { type: 'bandpass', freq: 3000, q: 1.2, level: 0.038, trem: 0.2, tremDepth: 0.5, rev: 0.4 },
  space: { type: 'highpass', freq: 4200, q: 0.8, level: 0.042, trem: 9.0, tremDepth: 0.8 },
  dark: { type: 'lowpass', freq: 300, q: 1.0, level: 0.080, trem: 0.5, tremDepth: 0.85, rev: 0.4 },
  greenies: { type: 'bandpass', freq: 4200, q: 0.8, level: 0.050, trem: 13.0, tremDepth: 0.5 },
};

/* ---------- pure helpers (unit-tested in comm.test.mjs) ---------- */
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}
export function countSyllables(w) {
  w = w.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 1;
  const m = w.match(/[aeiouy]+/g);
  let n = m ? m.length : 1;
  if (w.length > 3 && /e$/.test(w)) n = Math.max(1, n - 1);
  return Math.max(1, Math.min(6, n));
}
/* §7.3–7.4 build a beat list with pitch contour */
export function buildBeats(line, rate, seed, intent) {
  const words = line.split(/\s+/).filter(Boolean);
  const scale = [0, 2, 4, 7, 9, 12];
  const beats = [];
  words.forEach(function (word) {
    const n = countSyllables(word);
    for (let i = 0; i < n; i++) {
      const h = hash(word + ':' + i + ':' + seed);
      beats.push({ first: i === 0, deg: scale[h % scale.length] + (((h >> 4) % 3) - 1), jit: ((h >> 7) % 100) / 100 });
    }
  });
  const N = beats.length || 1;
  beats.forEach(function (b, idx) {
    const pos = idx / Math.max(1, N - 1);
    let semi = b.deg;
    if (intent === 'statement') semi += -3 * pos;
    else if (intent === 'question') semi += (idx >= N - 2 ? 5 : 0);
    else if (intent === 'exclaim') semi += (idx % 2 ? 2.5 : -1);
    else if (intent === 'trail') semi += -5 * pos;
    b.semi = semi;
    b.dur = (1 / rate) * (0.85 + b.jit * 0.3);
  });
  return beats;
}
export function utterDuration(line, p, intent) {
  const rate = p.rate * (intent === 'exclaim' ? 1.15 : intent === 'trail' ? 0.8 : 1);
  const beats = buildBeats(line, rate, 1, intent);
  let t = 0;
  beats.forEach(function (b) { t += b.dur; });
  return t + 0.2;
}
/* Faction profile with the tool's slider overrides applied (all optional). */
export function paramsFor(key, over) {
  const f = FACTIONS[key], p = {};
  for (const k in f) p[k] = f[k];
  over = over || {};
  p.rate = f.rate * (over.rateMult != null ? over.rateMult : 1);
  if (over.noise != null) p.noise = over.noise;
  if (over.reverb != null) p.reverb = over.reverb;
  if (over.attack != null) p.attack = over.attack;
  if (over.sustain != null) p.sustain = over.sustain;
  if (over.overlap != null) p.overlap = over.overlap;
  p.vgain = VGAIN[key];
  return p;
}

/* ---------- audio engine (lazy — module is import-safe headless) ---------- */
let AC = null, master = null, comp = null, convolver = null, noiseBuf = null, audioOK = true;

export function initAudio(volume) {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return true; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = (volume != null ? volume : 0.8);
    comp = AC.createDynamicsCompressor();
    master.connect(comp); comp.connect(AC.destination);
    convolver = AC.createConvolver(); convolver.buffer = makeImpulse(2.4, 3.2); convolver.connect(master);
    const len = AC.sampleRate * 1.0;
    noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  } catch (e) { audioOK = false; console.warn('Audio unavailable:', e); return false; }
}
export function audioReady() { return !!(audioOK && AC); }
export function setVolume(v) { if (master) master.gain.value = v; }

function makeImpulse(sec, decay) {
  const rate = AC.sampleRate, len = Math.floor(rate * sec), buf = AC.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) { const ch = buf.getChannelData(c); for (let i = 0; i < len; i++) { ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); } }
  return buf;
}
/* build per-utterance FX chain; returns input node */
function buildChain(p) {
  const input = AC.createGain(); input.gain.value = (p.vgain != null ? p.vgain : 0.9);
  let node = input;
  if (p.drive > 0) { const ws = AC.createWaveShaper(); ws.curve = driveCurve(p.drive); node.connect(ws); node = ws; }
  if (p.ringmod > 0) {
    const rg = AC.createGain(); rg.gain.value = 0;
    const mo = AC.createOscillator(); mo.frequency.value = p.ringmod;
    const mg = AC.createGain(); mg.gain.value = 1; mo.connect(mg); mg.connect(rg.gain); mo.start();
    node.connect(rg); node = rg;
  }
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = p.lowpass || 8000;
  node.connect(lp); node = lp;
  node.connect(master);
  const wet = AC.createGain(); wet.gain.value = Math.min(1.2, (p.reverb || 0) * REVERB_MULT);
  node.connect(wet); wet.connect(convolver);
  return input;
}
function driveCurve(amount) {
  const k = amount * 80, n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
  return c;
}
/* schedule one syllable.
   Per-faction envelope (attack / sustain / overlap) replaces the old fixed 12ms-pluck:
   - attack  : onset ramp seconds (5ms bark … 60ms swell)
   - sustain : the vowel's held level as a fraction of peak (0 = pluck, 0.5+ = legato vowel)
   - overlap : how far the release tail RINGS INTO THE NEXT BEAT (fraction of dur). Every syllable
     owns its own oscillators + envelope, so tails and the next onset crossfade freely — the
     "two channels" effect, except each syllable is its own channel. Beat timing is unchanged. */
function syllable(t, dur, freq, p, g, chain) {
  const env = AC.createGain(); const peak = 0.24 * (g.level || 1);
  const atk = Math.min((p.attack != null ? p.attack : 0.012), dur * 0.4);
  const sus = Math.max(0, Math.min(0.85, p.sustain != null ? p.sustain : 0));
  const ov = Math.max(0, Math.min(0.6, p.overlap != null ? p.overlap : 0));
  const L = dur * (1 + ov);                        // audible length; the next beat still starts at t+dur
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(peak, t + atk);
  env.gain.exponentialRampToValueAtTime(Math.max(peak * sus, 0.0008), t + dur * 0.7);
  env.gain.exponentialRampToValueAtTime(0.0006, t + L);
  const fscale = (g.gender === 'female' ? 1.12 : g.gender === 'neutral' ? 0.95 : 1.0);
  const bp1 = AC.createBiquadFilter(); bp1.type = 'bandpass'; bp1.frequency.value = p.f1 * fscale; bp1.Q.value = 6;
  const bp2 = AC.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = p.f2 * fscale; bp2.Q.value = 9;
  bp1.connect(env); bp2.connect(env); env.connect(chain);
  function osc(type, det, gain) {
    const o = AC.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = det;
    const og = AC.createGain(); og.gain.value = gain; o.connect(og); og.connect(bp1); og.connect(bp2);
    o.start(t); o.stop(t + L + 0.02);              // run through the overlap tail
  }
  osc(p.wave, 0, 0.9);
  if (p.detune) { osc(p.wave, p.detune, 0.5); osc(p.wave, -p.detune, 0.5); }
  if (p.swarm) { osc(p.wave, p.detune * 2, 0.35); osc(p.wave, -p.detune * 2, 0.35); }
  if (p.octave) osc('sine', 1200, 0.28);
  if (p.sub) osc('sine', -1200, 0.4);
  // consonant / breath
  if (noiseBuf && (g.hasCons !== false)) {
    const amt = p.noise * (0.9 + g.jitter * 0.4);
    if (amt > 0.02) {
      const ns = AC.createBufferSource(); ns.buffer = noiseBuf; ns.loop = true;
      const nf = AC.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1800 + (freq * 2); nf.Q.value = 2;
      const ng = AC.createGain(); const nd = Math.min(0.05, dur * 0.5);
      ng.gain.setValueAtTime(amt * 0.5, t); ng.gain.exponentialRampToValueAtTime(0.0005, t + nd);
      ns.connect(nf); nf.connect(ng); ng.connect(chain); ns.start(t); ns.stop(t + nd);
    }
  }
}
/** Speak a line. Returns { duration, stop() } — stop() cuts this utterance's bus (skip). */
export function playUtterance(line, p, g) {
  const intent = g.intent || 'statement';
  if (!audioReady()) return { duration: utterDuration(line, p, intent), stop: function () {} };
  const rate = p.rate * (intent === 'exclaim' ? 1.15 : intent === 'trail' ? 0.8 : 1);
  const beats = buildBeats(line, rate, g.seed || 1, intent);
  const chain = buildChain(p);
  let base = (g.gender === 'female' ? p.pitchF : g.gender === 'male' ? p.pitchM : (p.pitchM + p.pitchF) / 2 * 0.85);
  base *= Math.pow(2, (g.pitchTrim || 0) / 12);
  g.level = (intent === 'exclaim' ? 1.15 : intent === 'trail' ? 0.8 : 1);
  let t = AC.currentTime + 0.06;
  const start = t;
  beats.forEach(function (b) {
    const f = base * Math.pow(2, b.semi / 12);
    g.jitter = b.jit;
    syllable(t, b.dur, f, p, g, chain);
    t += b.dur;
  });
  return { duration: (t - start) + 0.15, stop: function () { try { chain.disconnect(); } catch (e) { /* already gone */ } } };
}

/* small SFX */
export function playSweep() {
  if (!audioReady()) return;
  const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(180, AC.currentTime); o.frequency.exponentialRampToValueAtTime(1400, AC.currentTime + 0.5);
  g.gain.setValueAtTime(0.06, AC.currentTime); g.gain.exponentialRampToValueAtTime(0.0005, AC.currentTime + 0.55);
  o.connect(g); g.connect(master); o.start(); o.stop(AC.currentTime + 0.55);
}
export function playDrop() {
  if (!audioReady()) return;
  const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(600, AC.currentTime); o.frequency.exponentialRampToValueAtTime(60, AC.currentTime + 0.4);
  g.gain.setValueAtTime(0.08, AC.currentTime); g.gain.exponentialRampToValueAtTime(0.0004, AC.currentTime + 0.45);
  o.connect(g); g.connect(master); o.start(); o.stop(AC.currentTime + 0.45);
}

/* per-faction channel static bed; returns {stop()} or null */
export function startStatic(facId, mult) {
  if (!audioReady() || !noiseBuf) return null;
  const s = STATIC[facId]; if (!s) return null;
  mult = (mult == null ? 1 : mult); if (mult <= 0) return null;
  const src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  // GRIT: filtered band -> waveshaper drive (distorted crackle), plus a decorrelated broadband hiss
  // floor — a lone narrow band under a smooth sine tremolo read as a pure warbling tone.
  const filt = AC.createBiquadFilter(); filt.type = s.type; filt.frequency.value = s.freq; filt.Q.value = s.q || 1;
  const drive = AC.createWaveShaper(); drive.curve = driveCurve(0.6);
  const lvl = AC.createGain(); const base = s.level * mult;
  src.connect(filt); filt.connect(drive); drive.connect(lvl); lvl.connect(master);
  const hiss = AC.createBufferSource(); hiss.buffer = noiseBuf; hiss.loop = true; hiss.playbackRate.value = 0.83;
  const hf = AC.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 900; hf.Q.value = 0.4;
  const hg = AC.createGain(); hg.gain.value = 0.45;   // relative to lvl — the band stays dominant
  hiss.connect(hf); hf.connect(hg); hg.connect(lvl);
  if (s.rev) { const w = AC.createGain(); w.gain.value = s.rev; lvl.connect(w); w.connect(convolver); }
  let lfo = null;
  if (s.trem) {
    // square LFO = choppy carrier DROPOUT (radio break-up) instead of a smooth sine warble
    lfo = AC.createOscillator(); lfo.type = 'square'; lfo.frequency.value = s.trem;
    const ld = AC.createGain(); ld.gain.value = (s.tremDepth || 0.5) * base * 0.5; lfo.connect(ld); ld.connect(lvl.gain); lfo.start();
  }
  lvl.gain.setValueAtTime(0.0001, AC.currentTime);
  lvl.gain.linearRampToValueAtTime(base, AC.currentTime + 0.4);
  src.start(); hiss.start();
  return { stop: function () {
    const t = AC.currentTime;
    try {
      lvl.gain.cancelScheduledValues(t); lvl.gain.setValueAtTime(Math.max(0.0001, base * 0.6), t);
      lvl.gain.linearRampToValueAtTime(0.0001, t + 0.4);
    } catch (e) { /* context closed */ }
    try { src.stop(t + 0.45); } catch (e) { /* already stopped */ }
    try { hiss.stop(t + 0.45); } catch (e) { /* already stopped */ }
    if (lfo) { try { lfo.stop(t + 0.45); } catch (e) { /* already stopped */ } }
  } };
}
