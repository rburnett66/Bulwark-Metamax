/**
 * src/render3d/fx/fireAtlas.js — the flame FLIPBOOK every fire in the battle view draws from [MM-task_mvfqzjkm_7].
 *
 * Owner 2026-10-19: "what can we do to make the fire look better, without using more processing .. would fire sprites
 * help?" → "did you implement the fire sprites for all fires?" → "sprite sheet is my owned art" → "keep going".
 *
 * Every K.FIRE particle (burning wrecks, rocket ground fire, burning units, explosions, motor exhaust) is drawn as one
 * frame of a flame flipbook instead of a soft glow dot — same particle count, same single additive draw call, so it
 * costs nothing extra. Each particle starts on its own frame and plays forward, so neighbours never flicker in step.
 *
 * Two sources, one layout (cols × rows frames):
 *   1. the OWNER'S SHEET, when content/fx/fire-atlas.png + content/fx/fire-atlas.json ({ cols, rows, frames }) are
 *      committed — frames in reading order from the TOP-LEFT, flames on black (additive: black is transparent);
 *   2. otherwise a PROCEDURAL stand-in built here (fireAtlasPixels): 4 × 4 looping frames of a licking flame, white-hot
 *      at the root cooling through yellow and orange to a red, ragged tip. Pure + seeded (no Math.random).
 *
 * THREE is injected (no import).
 */
export const FIRE_ATLAS = Object.freeze({
  cols: 4, rows: 4, cell: 64,      // the procedural stand-in: 16 frames of 64 px → one 256² texture
  fps: 26,                         // frames per second a flame plays at
  url: 'content/fx/fire-atlas.png', meta: 'content/fx/fire-atlas.json',
});

function makeNoise(seed) {
  let s = seed >>> 0 || 1;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const P = 64, g = new Float32Array(P * P);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const at = (x, y) => g[(((y % P) + P) % P) * P + (((x % P) + P) % P)];
  const sm = (t) => t * t * (3 - 2 * t);
  const n = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  return (x, y) => n(x, y) * 0.55 + n(x * 2.1 + 7.3, y * 2.1 + 3.1) * 0.3 + n(x * 4.3 + 1.7, y * 4.3 + 9.2) * 0.15;
}

/**
 * The procedural flipbook → Uint8Array RGBA (cols·cell × rows·cell). Frame f sits at column f % cols, row ⌊f / cols⌋
 * counted from the BOTTOM of the data (v up = flame up). RGB is premultiplied by alpha (additive-ready). The frames
 * loop: frame cols·rows − 1 runs into frame 0 without a jump.
 */
export function fireAtlasPixels(A = FIRE_ATLAS, seed = 4219) {
  const W = A.cols * A.cell, H = A.rows * A.cell, N = A.cols * A.rows, out = new Uint8Array(W * H * 4);
  const noise = makeNoise(seed);
  for (let f = 0; f < N; f++) {
    const t = f / N, ox = (f % A.cols) * A.cell, oy = Math.floor(f / A.cols) * A.cell;
    for (let py = 0; py < A.cell; py++) for (let px = 0; px < A.cell; px++) {
      const x = (px + 0.5) / A.cell * 2 - 1, v = (py + 0.5) / A.cell;       // x −1..1 across, v 0 (root) .. 1 (tip)
      // a looping scroll: blend the slice at t with the one a whole period behind, weighted by t
      const scroll = (k) => noise(x * 2.2 + 11, v * 3.2 - k * 3.2);
      const nz = scroll(t) * (1 - t) + scroll(t - 1) * t;
      const sway = (nz - 0.5) * 0.7 * v;                                   // the tip licks side to side
      const root = Math.sqrt(Math.min(1, v * 4 + 0.15));                  // a rounded root, not a flat edge
      const width = 0.55 * Math.pow(Math.max(0, 1 - v), 0.7) * root * (0.8 + 0.4 * nz) + 0.015;
      const d = Math.abs(x + sway) / width;
      let I = Math.max(0, 1 - d * d);
      I = I * (1 - Math.pow(v, 1.8)) * (0.5 + 0.8 * nz);
      I *= Math.min(1, v * 6 + 0.1);                                       // soft root
      I = Math.max(0, Math.min(1, I));
      const a = Math.min(1, I * 1.6);
      // white-yellow core → orange body → red, ragged edge
      const r = 1, g = Math.min(1, 0.1 + 0.95 * Math.pow(I, 1.3)), b = Math.min(1, Math.pow(I, 3) * 1.1);
      const i = ((oy + py) * W + ox + px) * 4;
      out[i] = Math.round(r * a * 255); out[i + 1] = Math.round(g * a * 255); out[i + 2] = Math.round(b * a * 255); out[i + 3] = Math.round(a * 255);
    }
  }
  return out;
}

/**
 * The atlas to draw from: { texture, cols, rows, frames, topDown }. Starts as the procedural stand-in; when the owner's
 * sheet is committed (FIRE_ATLAS.url + .meta) it is loaded in the background and swapped in through onSwap(atlas).
 */
export function createFireAtlas(THREE, { load = typeof window !== 'undefined' && typeof fetch === 'function', onSwap = null } = {}) {
  const A = FIRE_ATLAS;
  const tex = new THREE.DataTexture(fireAtlasPixels(A), A.cols * A.cell, A.rows * A.cell, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  const atlas = { texture: tex, cols: A.cols, rows: A.rows, frames: A.cols * A.rows, topDown: false, source: 'procedural' };
  if (load) {
    fetch(A.meta).then((r) => (r.ok ? r.json() : null)).then((m) => {
      if (!m || !(m.cols > 0) || !(m.rows > 0)) return;   // no sheet committed: keep the stand-in
      new THREE.TextureLoader().load(A.url, (t) => {
        t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
        Object.assign(atlas, { texture: t, cols: m.cols, rows: m.rows, frames: m.frames || m.cols * m.rows, topDown: true, source: 'sheet' });
        if (onSwap) onSwap(atlas);
      }, undefined, (e) => console.warn('[fire] fire-atlas.png failed to load — keeping the procedural flames', e));
    }).catch((e) => console.info('[fire] no fire sheet loaded — procedural flames', e && e.message));
  }
  return atlas;
}

/** The frame (0..frames−1) a flame shows `age` seconds into its life, starting on its own seed-picked frame (pure). */
export function fireFrame(seed, age, frames = FIRE_ATLAS.cols * FIRE_ATLAS.rows, fps = FIRE_ATLAS.fps) {
  return Math.floor((((seed || 0) % 1) + 1) % 1 * frames + Math.max(0, age) * fps) % frames;
}
