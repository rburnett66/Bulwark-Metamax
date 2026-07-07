let seed = 1;

/**
 * Set the global seed for the shared RNG stream.
 * @param {number} s - seed value (any 32-bit integer)
 */
export function setSeed(s) {
  seed = s >>> 0;
}

/**
 * Get the current internal seed/state (for serialization / determinism checks).
 * @returns {number}
 */
export function getSeed() {
  return seed >>> 0;
}

/**
 * Core mulberry32 step on a 32-bit state; returns { state, value }.
 * @param {number} state - 32-bit unsigned state
 * @returns {{state:number, value:number}}
 */
function mulberry32Step(state) {
  let a = (state + 0x6D2B79F5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { state: a, value };
}

/**
 * Advance the shared RNG stream and return a float in [0, 1).
 * @returns {number}
 */
export function random() {
  const r = mulberry32Step(seed);
  seed = r.state;
  return r.value;
}

/**
 * Shared-stream integer in [min, max] inclusive.
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randomInt(min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/**
 * Shared-stream float in [min, max).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randomRange(min, max) {
  return min + random() * (max - min);
}

/**
 * Create an INDEPENDENT deterministic RNG instance (mulberry32).
 * This is what the sim core uses so each core instance has its own stream,
 * fully serializable via getState/setState for replay + hashing.
 *
 * @param {number} initialSeed
 * @returns {{
 *   next: () => number,
 *   nextInt: (min:number, max:number) => number,
 *   nextRange: (min:number, max:number) => number,
 *   pick: (arr:Array<any>) => any,
 *   shuffle: (arr:Array<any>) => Array<any>,
 *   chance: (p:number) => boolean,
 *   getState: () => number,
 *   setState: (s:number) => void,
 *   clone: () => object
 * }}
 */
export function createRng(initialSeed) {
  let state = (initialSeed === undefined ? 1 : initialSeed) >>> 0;
  if (state === 0) state = 0x9E3779B9;

  const rng = {
    /** Next float in [0, 1). */
    next() {
      const r = mulberry32Step(state);
      state = r.state;
      return r.value;
    },

    /** Integer in [min, max] inclusive. */
    nextInt(min, max) {
      return min + Math.floor(rng.next() * (max - min + 1));
    },

    /** Float in [min, max). */
    nextRange(min, max) {
      return min + rng.next() * (max - min);
    },

    /** Pick a deterministic element from an array (undefined if empty). */
    pick(arr) {
      if (!arr || arr.length === 0) return undefined;
      return arr[Math.floor(rng.next() * arr.length)];
    },

    /** Deterministic in-place Fisher-Yates shuffle; returns the array. */
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      return arr;
    },

    /** True with probability p (0..1). */
    chance(p) {
      return rng.next() < p;
    },

    /** Serializable internal state (single 32-bit uint). */
    getState() {
      return state >>> 0;
    },

    /** Restore internal state from a serialized value. */
    setState(s) {
      state = s >>> 0;
    },

    /** Fork a new RNG at the same state (streams then diverge only by use). */
    clone() {
      return createRng(state);
    }
  };

  return rng;
}

/**
 * Hash a string into a 32-bit seed deterministically (for named seeds).
 * @param {string} str
 * @returns {number}
 */
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export default createRng;