// src/sim/rng.js
// Deterministic seedable PRNG for BULWARK vertical slice.
// Provides identical replays from the same seed.
//
// Implements:
//  - mulberry32 core (fast, well-distributed 32-bit PRNG)
//  - a stateful RNG object with save/restore for deterministic replay
//  - helper methods: next, float, range, int, bool, pick, shuffle, chance
//  - a stable string->seed hash (xmur3) so string seeds are deterministic
//
// No external dependencies. Pure ES module.

/**
 * xmur3 string hash -> produces a 32-bit seed generator.
 * Used to turn arbitrary string seeds into a numeric seed deterministically.
 * @param {string} str
 * @returns {function(): number} function returning successive 32-bit hash values
 */
export function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/**
 * Core mulberry32 step. Takes a 32-bit state, returns { value, state }.
 * We keep this as a pure function so RNG can hold explicit state for replay.
 * @param {number} state uint32
 * @returns {number} next uint32 state (value derived from it)
 */
function mulberry32Step(state) {
  // returns a float in [0,1) but we recompute state externally
  let t = (state + 0x6d2b79f5) >>> 0;
  let r = t;
  r = Math.imul(r ^ (r >>> 15), r | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  r = (r ^ (r >>> 14)) >>> 0;
  return r;
}

/**
 * Normalize a seed input (number | string | undefined) into a uint32 seed.
 * @param {number|string|undefined} seed
 * @returns {number} uint32
 */
export function normalizeSeed(seed) {
  if (seed === undefined || seed === null) {
    // Non-deterministic fallback only used when explicitly unseeded.
    return (Math.floor(Math.random() * 0xffffffff)) >>> 0;
  }
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return (seed >>> 0) || 1;
  }
  // string or anything else -> stringify and hash
  const gen = xmur3(String(seed));
  return gen() >>> 0;
}

/**
 * Deterministic RNG. Same seed => identical sequence.
 *
 * Usage:
 *   const rng = new RNG(1234);
 *   rng.float();        // [0,1)
 *   rng.int(0, 10);     // integer in [0,10)
 *   rng.range(1, 5);    // float in [1,5)
 *   rng.pick([a,b,c]);
 *
 * For replay determinism, save/restore state:
 *   const s = rng.getState(); ... rng.setState(s);
 */
export class RNG {
  /**
   * @param {number|string} [seed]
   */
  constructor(seed) {
    this._seed = normalizeSeed(seed);
    // internal 32-bit counter state
    this.state = this._seed >>> 0;
    // count of numbers drawn (useful for logs / debugging determinism)
    this.count = 0;
  }

  /** @returns {number} original normalized seed */
  get seed() {
    return this._seed;
  }

  /**
   * Reset to the original seed (or a new one).
   * @param {number|string} [seed]
   */
  reset(seed) {
    if (seed !== undefined) this._seed = normalizeSeed(seed);
    this.state = this._seed >>> 0;
    this.count = 0;
  }

  /**
   * Advance and return next raw uint32.
   * @returns {number} uint32 in [0, 2^32)
   */
  nextUint32() {
    // advance state deterministically
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    const r = mulberry32Step(this.state - 0x6d2b79f5);
    this.count++;
    return r >>> 0;
  }

  /**
   * Next float in [0, 1).
   * @returns {number}
   */
  next() {
    return this.nextUint32() / 4294967296;
  }

  /** Alias for next() — float in [0,1). */
  float() {
    return this.next();
  }

  /**
   * Float in [min, max).
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /**
   * Integer in [min, max). If only one arg given, treats it as [0, min).
   * @param {number} min
   * @param {number} [max]
   * @returns {number}
   */
  int(min, max) {
    if (max === undefined) {
      max = min;
      min = 0;
    }
    if (max <= min) return min;
    return min + Math.floor(this.next() * (max - min));
  }

  /**
   * Integer in [min, max] inclusive.
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  intInclusive(min, max) {
    return this.int(min, max + 1);
  }

  /**
   * Boolean with given probability of true (default 0.5).
   * @param {number} [p]
   * @returns {boolean}
   */
  bool(p = 0.5) {
    return this.next() < p;
  }

  /**
   * True with probability p (alias of bool for readability).
   * @param {number} p
   * @returns {boolean}
   */
  chance(p) {
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
    return arr[this.int(0, arr.length)];
  }

  /**
   * Deterministic Fisher-Yates shuffle. Mutates and returns the array.
   * @template T
   * @param {T[]} arr
   * @returns {T[]}
   */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /**
   * Gaussian (normal) sample via Box-Muller, mean 0, stddev 1.
   * @returns {number}
   */
  gaussian() {
    // ensure u1 > 0 to avoid log(0)
    let u1 = this.next();
    if (u1 <= 1e-12) u1 = 1e-12;
    const u2 = this.next();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }

  /**
   * Serialize current state for replay/save. Deterministic snapshot.
   * @returns {{seed:number,state:number,count:number}}
   */
  getState() {
    return { seed: this._seed, state: this.state >>> 0, count: this.count };
  }

  /**
   * Restore a previously saved state.
   * @param {{seed:number,state:number,count:number}} s
   */
  setState(s) {
    if (!s) return;
    this._seed = s.seed >>> 0;
    this.state = s.state >>> 0;
    this.count = s.count | 0;
  }

  /**
   * Create an independent RNG deterministically derived from this one.
   * Useful for per-system streams that must not perturb the main stream.
   * @param {number|string} [salt]
   * @returns {RNG}
   */
  fork(salt = 0) {
    const gen = xmur3(String(this._seed) + ':' + String(salt) + ':' + String(this.count));
    return new RNG(gen() >>> 0);
  }
}

/**
 * Convenience factory.
 * @param {number|string} [seed]
 * @returns {RNG}
 */
export function makeRNG(seed) {
  return new RNG(seed);
}

/**
 * Compute a stable 32-bit hash of arbitrary serializable state.
 * Used by replay.js to verify deterministic sim state hashes.
 * @param {*} value
 * @returns {number} uint32 hash
 */
export function hashState(value) {
  const str = stableStringify(value);
  const gen = xmur3(str);
  // mix a couple of rounds for better avalanche
  let h = gen();
  h = (Math.imul(h ^ (h >>> 15), 2246822519) >>> 0);
  h ^= gen();
  return h >>> 0;
}

/**
 * Stable JSON stringify with sorted keys so hashes are order-independent.
 * @param {*} value
 * @returns {string}
 */
export function stableStringify(value) {
  const seen = new WeakSet();
  const walk = (v) => {
    if (v === null) return 'null';
    const t = typeof v;
    if (t === 'number') {
      // normalize -0 and non-finite
      if (!Number.isFinite(v)) return 'null';
      if (Object.is(v, -0)) return '0';
      return String(v);
    }
    if (t === 'boolean') return v ? 'true' : 'false';
    if (t === 'string') return JSON.stringify(v);
    if (t === 'undefined' || t === 'function') return 'null';
    if (t === 'object') {
      if (seen.has(v)) return '"[circular]"';
      seen.add(v);
      let out;
      if (Array.isArray(v)) {
        out = '[' + v.map(walk).join(',') + ']';
      } else {
        const keys = Object.keys(v).sort();
        out = '{' + keys.map((k) => JSON.stringify(k) + ':' + walk(v[k])).join(',') + '}';
      }
      seen.delete(v);
      return out;
    }
    return 'null';
  };
  return walk(value);
}

export default RNG;