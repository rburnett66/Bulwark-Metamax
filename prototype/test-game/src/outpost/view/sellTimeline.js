/**
 * src/outpost/view/sellTimeline.js — the SELL sequence as a timeline, from sell()'s per-load entries
 * (tech plan docs/tech-plan/Outpost.md §6.5; design §4.3, owner Q5) [MM-story_mw5oeer7_n].
 *
 *   0.0 s       the storage hologram drains; crates in the ore colour ride the conduit to the pad
 *   0.6 s       the shuttle's engines light; it lifts with a camera shake
 *   0.8 s       ore splatter: a burst of ore chunks from the cargo bay, bouncing on the pad
 *   0.9 s       "$N" pops, one per load, staggered 0.12 s, stacking upward in the ore colour
 *   0.6–1.2 s   the shuttle lifts straight off the pad FACING THE PLAYER, as it is parked (owner 2026-11-13
 *               [MM-story_mwf8j7jg_6]: "the transport ship on the outpost should face towards the player when it takes off")
 *   1.2–2.6 s   it turns 180° in the air, slowly, rising, banked into the turn, to face away (owner 2026-11-14
 *               [MM-task_mwftv457_1d]: "The ship is facing me at take off, it should turn 180 and fly away")
 *   2.6–4.0 s   it climbs away out of frame; the HUD gold counts up (1.4–3.0 s)
 *   4.8–8.2 s   it comes back down the exact same path, facing the player the whole way, and lands with no turn ("When it
 *               comes back it is already facing and will just land")
 *
 * Reduced motion: the pops and the count-up stay; the drain, crates, shuttle, shake and splatter are skipped.
 * A sale of many loads keeps one pop per load up to MAX_POPS; past that, consecutive loads share a pop (their gold
 * summed), so the stagger never outlasts the shuttle. Pure: no DOM, no three.js, no clock.
 */
import { oreById } from '../../data/ores.js';

export const SELL = Object.freeze({
  drain: 0, crates: 0, engines: 0.6, lift: 0.6, shake: 0.6, splatter: 0.8, pops: 0.9, stagger: 0.12,
  arc: [2.6, 4.0], count: [1.4, 3.0], drainFor: 0.9, cratesFor: 0.7, shakeFor: 0.45,
});
/**
 * The shuttle's flight (owner 2026-11-13 [MM-story_mwf8j7jg_6], 2026-11-14 [MM-task_mwftv457_1d]): lift [SELL.lift, spin0]
 * to `hover` cells facing the player; turn `spinBy` (180°, left) over [spin0, spin1], rising `spinRise` more, banked into
 * the turn by up to `bank` rad at the fastest turn; climb away over SELL.arc; out of sight for `away` s; then down the same
 * path facing the player, no turn.
 */
export const FLIGHT = Object.freeze({ spin: [1.2, 2.6], spinBy: Math.PI, hover: 2.4, spinRise: 1.6, bank: 0.42, away: 0.8, climb: 26, out: 22 });
/** When the shuttle is back on the pad: the return is the outbound flight (SELL.lift → SELL.arc[1]) run backwards. */
export const RETURN = Object.freeze([SELL.arc[1] + FLIGHT.away, SELL.arc[1] + FLIGHT.away + (SELL.arc[1] - SELL.lift)]);
const smooth = (k) => k * k * (3 - 2 * k);
/**
 * Where the outbound flight is at time u (SELL.lift ≤ u ≤ SELL.arc[1]), before the scene places it:
 * → { y (cells above the pad), fwd (cells along the departure), spin (0 facing the player, as parked → 1 turned spinBy,
 *     facing away), turn (0..1, how fast it is turning now, 1 at the fastest), pitch (rad, nose up as it climbs) }
 */
export function flightPath(u) {
  const c01 = (v) => Math.max(0, Math.min(1, v));
  const kl = c01((u - SELL.lift) / (FLIGHT.spin[0] - SELL.lift));
  const ks = c01((u - FLIGHT.spin[0]) / (FLIGHT.spin[1] - FLIGHT.spin[0]));
  const ka = c01((u - SELL.arc[0]) / (SELL.arc[1] - SELL.arc[0])), a = ka * ka;
  return {
    y: FLIGHT.hover * easeOut(kl) + FLIGHT.spinRise * smooth(ks) + a * FLIGHT.climb,
    fwd: a * a * FLIGHT.out,
    spin: smooth(ks),
    turn: ks > 0 && ks < 1 ? (6 * ks * (1 - ks)) / 1.5 : 0,   // smoothstep's slope over its peak (1.5)
    pitch: a * 0.5,
  };
}
export const MAX_POPS = 10;

const easeOut = (k) => 1 - (1 - k) ** 3;

/**
 * loads: [{ pad, item, units, gold }] (sell()'s entries); opts: { reduced, goldFrom }.
 * → { duration, beats: [{ t, type, … }], pops: [{ t, gold, colour, item }], total, goldFrom, goldTo, countAt(t) }
 */
export function sellTimeline(loads, { reduced = false, goldFrom = 0 } = {}) {
  const total = loads.reduce((a, l) => a + l.gold, 0);
  const groups = [];
  const per = Math.ceil(loads.length / MAX_POPS) || 1;
  for (let i = 0; i < loads.length; i += per) {
    const g = loads.slice(i, i + per);
    groups.push({ gold: g.reduce((a, l) => a + l.gold, 0), item: g[0].item, n: g.length });
  }
  const pops = groups.map((g, i) => ({ t: SELL.pops + i * SELL.stagger, gold: g.gold, item: g.item, loads: g.n, colour: colourOf(g.item) }));
  const items = [...new Set(loads.map((l) => l.item))];
  const beats = [];
  if (!reduced) {
    beats.push({ t: SELL.drain, type: 'drain', dur: SELL.drainFor });
    beats.push({ t: SELL.crates, type: 'crates', dur: SELL.cratesFor, colours: items.map(colourOf), count: Math.min(12, loads.length * 2 + 2) });
    beats.push({ t: SELL.engines, type: 'engines' });
    beats.push({ t: SELL.lift, type: 'lift' });
    beats.push({ t: SELL.shake, type: 'shake', dur: SELL.shakeFor, amp: Math.min(0.32, 0.14 + loads.length * 0.012) });
    beats.push({ t: SELL.splatter, type: 'splatter', colours: items.map(colourOf), count: Math.min(60, 14 + loads.length * 3) });
    beats.push({ t: SELL.arc[0], type: 'arc', dur: SELL.arc[1] - SELL.arc[0] });
  }
  for (const p of pops) beats.push({ t: p.t, type: 'pop', gold: p.gold, colour: p.colour });
  const c0 = SELL.count[0], c1 = Math.max(SELL.count[1], pops.length ? pops[pops.length - 1].t + 0.4 : 0);
  beats.push({ t: c0, type: 'count', dur: c1 - c0 });
  if (!reduced) beats.push({ t: RETURN[0], type: 'return' }, { t: RETURN[1], type: 'land' });
  beats.sort((a, b) => a.t - b.t);
  const duration = Math.max(c1, reduced ? 0 : RETURN[1]) + 0.2;
  return {
    duration, beats, pops, total, goldFrom, goldTo: goldFrom + total, reduced,
    /** The gold the HUD shows at time t (counts up over the count window, eased). */
    countAt(t) {
      if (t <= c0) return goldFrom;
      if (t >= c1) return goldFrom + total;
      return goldFrom + Math.round(total * easeOut((t - c0) / (c1 - c0)));
    },
    /** The storage hologram's drain at t: 1 = as it was, 0 = drained (the share sold). */
    drainAt(t) { return reduced ? 0 : t <= 0 ? 1 : t >= SELL.drainFor ? 0 : 1 - easeOut(t / SELL.drainFor); },
    /**
     * The shuttle's flight at t: flightPath's pose plus { on, bank, back }. Outbound it turns left (spin rising) and
     * bank = −FLIGHT.bank × turn leans INTO the turn (left). back: returning — the same path down, but facing the player
     * all the way (spin 0, no turn, no lean): "When it comes back it is already facing and will just land".
     */
    shuttleAt(t) {
      const off = { on: false, y: 0, fwd: 0, spin: 0, turn: 0, pitch: 0, bank: 0, back: false };
      if (reduced || t < SELL.lift) return off;
      if (t > SELL.arc[1]) {
        if (t < RETURN[0] || t >= RETURN[1]) return off;
        const p = flightPath(SELL.arc[1] - (t - RETURN[0]));
        return { on: true, ...p, spin: 0, turn: 0, bank: 0, back: true };
      }
      const p = flightPath(t);
      return { on: true, ...p, bank: p.turn ? -FLIGHT.bank * p.turn : 0, back: false };
    },
  };
}

/** The ore's colour for an item id; gold when it is not an ore. */
export function colourOf(item) {
  const o = oreById(item);
  return (o && o.colour) || '#ffd76a';
}

/**
 * A pop's text colour: the ore's hue, made bright and saturated (lightness 0.7, saturation at least 0.65) so a dark
 * ore (iron's rust) still reads over the ground, as the battle's deposit pops are bright crystal colours. A grey ore
 * (aluminum) stays a light grey. '#8a4b32' → a light coral.
 */
export function popColour(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  if (!Number.isFinite(n)) return '#ffd76a';
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  const l0 = (max + min) / 2, s0 = d ? d / (1 - Math.abs(2 * l0 - 1)) : 0;
  const S = s0 < 0.12 ? s0 : Math.max(0.65, s0), L = Math.max(0.7, l0);
  const c = (1 - Math.abs(2 * L - 1)) * S, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = L - c / 2;
  const [R, G, B] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [R, G, B].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}
