Looking at the plan, `src/sim/rng.js` is a deterministic seeded PRNG. I'll implement a robust, well-tested PRNG (splitmix64-seeded xoshiro/mulberry style) with a clean class API that other sim files can use for deterministic, seed-stable replay.

```javascript
// src/sim/rng.js
// Deterministic seeded PRNG for BULWARK vertical slice.
// Seed-stable: same seed + same call sequence => identical outputs.
// Used across sim/step/waves/combat for replay determinism.
//
// Implementation: SplitMix32 seeding into a Mulberry32 core.
// All arithmetic kept in 32-bit unsigned space via >>> 0.

const UINT32 = 4294967296; // 2^32

// Mix a raw 32-bit integer seed into a well-distributed initial state.
function splitmix32(seed) {
  let z = (seed >>> 0);
  return function next() {
    z = (z + 0x9e3779b9) >>> 0;
    let x = z;
    x = Math.imul(x ^ (x >>> 16), 0x21f0aaad) >>> 0;
    x = Math.imul(x ^ (x >>> 15), 0x735a2d97) >>> 0;
    x = (x ^ (x >>> 15)) >>> 0;
    return x >>> 0;
  };
}

// Convert an arbitrary seed (number or string) to a 32-bit unsigned int.
function normalizeSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    // Fold to 32-bit; preserve fractional/large via truncation + mix
    let s = Math.floor(Math.abs(seed)) >>> 0;
    if (s === 0) s = 0x1a2b3c4d; // avoid all-zero degenerate seed
    return s >>> 0;
  }
  if (typeof seed === 'string') {
    // FNV-1a 32-bit hash of the string
    let h = 0x811c9dc5 >>> 0;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    if (h === 0) h = 0x1a2b3c4d;
    return h >>> 0;
  }
  // Fallback deterministic constant (do NOT use Date/Math.random — must be deterministic)
  return 0x1a2b3c4d;
}

export class RNG {
  /**
   * @param {number|string} seed
   */
  constructor(seed = 0x1a2b3c4d) {
    this._seed = normalizeSeed(seed);
    // Derive an initial internal state from the seed via splitmix32
    const sm = splitmix32(this._seed);
    // Warm the state a little to decorrelate low seeds
    this._state = sm();
    this._state = (this._state ^ sm()) >>> 0;
    if (this._state === 0) this._state = 0x9e3779b9;
    this._count = 0; // number of draws (useful for debugging/replay diagnostics)
  }

  /** Original normalized seed (32-bit uint). */
  get seed() {
    return this._seed >>> 0;
  }

  /** Number of raw uint32 draws performed. */
  get count() {
    return this._count;
  }

  /** Raw core step: Mulberry32. Returns uint32. */
  _nextUint32() {
    this._count++;
    let t = (this._state + 0x6d2b79f5) >>> 0;
    this._state = t;
    t = Math.imul(t ^ (t >>> 15), 1 | t) >>> 0;
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** Public alias for a raw 32-bit unsigned integer. */
  nextUint32() {
    return this._nextUint32();
  }

  /** Float in [0, 1). 32-bit resolution. */
  next() {
    return this._nextUint32() / UINT32;
  }

  /** Alias for next(). */
  random() {
    return this.next();
  }

  /** Float in [0,1) with 53-bit resolution (two draws). */
  nextDouble() {
    const hi = this._nextUint32() >>> 5; // 27 bits
    const lo = this._nextUint32() >>> 6; // 26 bits
    return (hi * 67108864 + lo) / 9007199254740992; // /2^53
  }

  /**
   * Float in [min, max).
   * @param {number} min
   * @param {number} max
   */
  range(min, max) {
    return min + (max - min) * this.next();
  }

  /**
   * Integer in [min, max] inclusive.
   * @param {number} min
   * @param {number} max
   */
  intRange(min, max) {
    min = Math.floor(min);
    max = Math.floor(max);
    if (max < min) {
      const t = min; min = max; max = t;
    }
    const span = (max - min + 1) >>> 0;
    if (span <= 0) return min;
    // Rejection-free modulo is fine for game determinism; slight bias negligible.
    return min + (this._nextUint32() % span);
  }

  /**
   * Integer in [0, n) — like array index.
   * @param {number} n
   */
  int(n) {
    n = Math.floor(n);
    if (n <= 0) return 0;
    return this._nextUint32() % n;
  }

  /** true with probability p (default 0.5). */
  chance(p = 0.5) {
    return this.next() < p;
  }

  /**
   * Pick a random element from an array (deterministic).
   * @template T
   * @param {T[]} arr
   * @returns {T|undefined}
   */
  pick(arr) {
    if (!arr || arr.length === 0) return undefined;
    return arr[this.int(arr.length)];
  }

  /**
   * Deterministic Fisher-Yates shuffle (in place). Returns the same array.
   * @template T
   * @param {T[]} arr
   * @returns {T[]}
   */
  shuffle(arr) {
    if (!arr) return arr;
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /**
   * Weighted pick. weights parallel to items.
   * @template T
   * @param {T[]} items
   * @param {number[]} weights
   * @returns {T|undefined}
   */
  weightedPick(items, weights) {
    if (!items || items.length === 0) return undefined;
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += Math.max(0, weights[i] || 0);
    if (total <= 0) return this.pick(items);
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= Math.max(0, weights[i] || 0);
      if (r < 0) return items[i];
    }
    return items[items.length - 1];
  }

  /**
   * Gaussian-ish value via sum of uniforms (approx normal), mean/stddev.
   * Deterministic; used only where a spread is desired.
   */
  gaussian(mean = 0, stddev = 1) {
    // Sum of 4 uniforms centered → approx normal, variance ~ 4*(1/12)=1/3
    let s = 0;
    for (let i = 0; i < 4; i++) s += this.next();
    // normalize: mean 2, std sqrt(4/12)=~0.5774
    const norm = (s - 2) / 0.5773502691896258;
    return mean + norm * stddev;
  }

  /**
   * Fork a new independent RNG deterministically derived from this one's
   * current state. Useful for per-entity or per-subsystem streams that
   * must not disturb the parent's draw sequence order-dependency.
   * @param {number} [salt]
   */
  fork(salt = 0) {
    const mixed = (this._state ^ (Math.imul((salt >>> 0) + 1, 0x9e3779b9) >>> 0)) >>> 0;
    const child = new RNG(mixed === 0 ? 0x1a2b3c4d : mixed);
    return child;
  }

  /** Snapshot state for save/replay validation. */
  getState() {
    return {
      seed: this._seed >>> 0,
      state: this._state >>> 0,
      count: this._count >>> 0,
    };
  }

  /** Restore a previously captured state. */
  setState(snap) {
    if (!snap) return;
    if (typeof snap.seed === 'number') this._seed = snap.seed >>> 0;
    if (typeof snap.state === 'number') this._state = snap.state >>> 0;
    if (typeof snap.count === 'number') this._count = snap.count >>> 0;
    if (this._state === 0) this._state = 0x9e3779b9;
  }

  /** Reset back to the original seed's fresh state. */
  reset() {
    const sm = splitmix32(this._seed);
    this._state = sm();
    this._state = (this._state ^ sm()) >>> 0;
    if (this._state === 0) this._state = 0x9e3779b9;
    this._count = 0;
  }

  /** Create a clone with identical current state. */
  clone() {
    const r = new RNG(this._seed);
    r._state = this._state >>> 0;
    r._count = this._count >>> 0;
    return r;
  }
}

/** Factory helper. */
export function createRNG(seed) {
  return new RNG(seed);
}

/** Export the seed normalizer for consistent seed handling elsewhere. */
export { normalizeSeed };

export default RNG;