// src/sim/rng.js
// Deterministic seeded PRNG (mulberry32) — the only randomness source in the sim.
// Provides seed-stable random numbers with save/restore of internal state so
// replays and the headless balance sim produce identical results.

export function createRng(seed) {
  // Coerce seed to an unsigned 32-bit integer; ensure non-degenerate state.
  let state = (seed >>> 0);
  if (state === 0) state = 0x9e3779b9;

  function next() {
    // mulberry32
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function nextInt(min, max) {
    // Inclusive integer in [min, max], deterministic.
    if (max < min) {
      const tmp = min;
      min = max;
      max = tmp;
    }
    const span = (max - min + 1);
    return min + Math.floor(next() * span);
  }

  function getState() {
    return state;
  }

  function setState(s) {
    state = (s >>> 0);
    if (state === 0) state = 0x9e3779b9;
  }

  return { next, nextInt, getState, setState };
}