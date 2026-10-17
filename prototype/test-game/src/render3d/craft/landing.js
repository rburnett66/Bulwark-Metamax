/**
 * src/render3d/craft/landing.js — the LANDING SEQUENCE as data + a pure evaluator. [MM-story_mvbks05m_4]
 *
 * A landing craft flies in nose-first, brakes, descends on its lift jets with the gear coming down, touches
 * down on the base cells, drops both hatch doors into ramps, and the harvesters drive down the ramps to their
 * docks. This module answers "what does the craft look like at time t" — position, attitude, gear, doors,
 * thrust, dust, shield and harvester progress — and which one-shot EVENTS a step crossed. It draws nothing and
 * imports no three.js, so node --test pins the whole choreography; craft3d.js applies a pose to the model.
 *
 * Presentation only: the sim never waits for it and never sees it (the renderer is read-only on the sim).
 *
 * Units: model units (4 = 1 cell), local to the landing spot; yaw in degrees as three's rotation.y (the nose
 * points along (cos yaw, 0, −sin yaw)), so yaw 0 = nose east (+X), hatches facing north (−Z) and south (+Z).
 */

/** The phases, in order. Durations in seconds; tune here — everything else derives from them. */
export const PHASES = Object.freeze([
  Object.freeze({ key: 'approach', dur: 4.2, label: 'Approach' }),
  Object.freeze({ key: 'descent', dur: 3.2, label: 'Descent · gear down' }),
  Object.freeze({ key: 'touchdown', dur: 1.0, label: 'Touchdown' }),
  Object.freeze({ key: 'hatches', dur: 1.4, label: 'Hatches open' }),
  Object.freeze({ key: 'deploy', dur: 4.2, label: 'Harvesters deploy' }),
]);
export const TOTAL = PHASES.reduce((a, p) => a + p.dur, 0);

/** One-shot events, fired once each when a step crosses their time. */
export const EVENTS = Object.freeze([
  Object.freeze({ type: 'gearDown', at: phaseStart('descent') + 1.0 }),
  Object.freeze({ type: 'touchdown', at: phaseStart('touchdown') }),
  Object.freeze({ type: 'hatchesOpen', at: phaseStart('hatches') }),
  Object.freeze({ type: 'rampsDown', at: phaseStart('hatches') + 0.95 }),
  Object.freeze({ type: 'deployStart', at: phaseStart('deploy') }),
  Object.freeze({ type: 'done', at: TOTAL }),
]);

/** Approach geometry (model units): start distance, cruise altitude above the hover point, hover height. */
export const APPROACH = Object.freeze({ dist: 70, climb: 18, hover: 8 });
/**
 * The braking flare (degrees, model units, seconds): nose-down cruise, the lean-back that cuts forward speed, the
 * forward drift still carried into the descent, how long it takes to bleed off, the forward overshoot as the hull
 * levels, and the share of approach speed left at the hover point.
 */
export const FLARE = Object.freeze({ cruise: -6, lean: 17, drift: 5, settle: 1.9, overshoot: 3.5, carry: 0.22 });
/**
 * Touchdown and hatch feel: the share of descent speed still carried into the ground (it lands with weight, not
 * on a crane), the suspension's dip (model units), spring and damping, and the ramp doors' fall + bounce.
 */
export const IMPACT = Object.freeze({ carry: 0.3, dip: 0.55, omega: 11, damp: 4.6, rock: 1.8, doorFall: 0.95, doorBounce: 0.05 });

/** Hull offset of the suspension at s seconds after touchdown (negative = compressed). */
export function suspension(s) { return s < 0 ? 0 : -IMPACT.dip * Math.exp(-IMPACT.damp * s) * Math.sin(IMPACT.omega * s); }
/**
 * Hatch door opening at s seconds into the hatches phase, 0..1: the hydraulics unlatch, the door falls under its
 * own weight (accelerating), hits the ground as a ramp and bounces once.
 */
export function doorOpen(s) {
  const F = IMPACT.doorFall;
  if (s <= 0) return 0;
  if (s < F) { const u = clamp01((s - 0.3) / (F - 0.3)); return 0.06 * smooth(s / 0.3) + 0.94 * u * u; }
  const b = s - F;
  return 1 - IMPACT.doorBounce * Math.abs(Math.sin(b * Math.PI / 0.18)) * Math.exp(-b * 9);
}

export function phaseStart(key) {
  let t = 0;
  for (const p of PHASES) { if (p.key === key) return t; t += p.dur; }
  return t;
}
/** { key, label, t (seconds into the phase), k (0..1 through it) } for time t. */
export function phaseAt(t) {
  let s = 0;
  for (const p of PHASES) {
    if (t < s + p.dur) { const u = Math.max(0, t - s); return { key: p.key, label: p.label, t: u, k: u / p.dur }; }
    s += p.dur;
  }
  const last = PHASES[PHASES.length - 1];
  return { key: 'done', label: 'Landed', t: t - TOTAL, k: 1, last: last.key };
}

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const outCubic = (x) => { x = clamp01(x); return 1 - (1 - x) * (1 - x) * (1 - x); };

/**
 * The hatch ramp of a craft def (model units): the door hinges at the sill (y0, z = hinge) and, open, its tip
 * rests on the ground. Returns { hinge, sill, len, angleDeg (below horizontal), foot (z of the tip) }.
 */
export function rampOf(def) {
  const piv = (def && def.pivots && def.pivots.doorR) || [0, 1, 6.075];
  const open = (def && def.anim && def.anim.doorR && def.anim.doorR.open) || 108;
  const len = 3.0, angle = open - 90;
  return { hinge: piv[2], sill: piv[1], len, angleDeg: angle, foot: piv[2] + len * Math.cos(angle * Math.PI / 180) };
}

/**
 * Where a harvester is on its way out, k 0..1: from inside the hull (z = 2.4) across the floor to the hinge,
 * then down the ramp to the foot. Returns { z (outward distance, model units), y, pitchDeg (nose down +) }.
 */
export function harvesterOnRamp(def, k) {
  const R = rampOf(def), z0 = 2.4;
  const z = z0 + (R.foot + 0.6 - z0) * clamp01(k);
  if (z <= R.hinge) return { z, y: R.sill, pitchDeg: 0 };
  if (z >= R.foot) return { z, y: 0, pitchDeg: 0 };
  const a = R.angleDeg * Math.PI / 180;
  return { z, y: Math.max(0, R.sill - (z - R.hinge) * Math.tan(a)), pitchDeg: R.angleDeg };
}

/**
 * The craft's pose at time t (seconds). opts.fromDeg = where the approach starts, as a bearing around the
 * landing spot in the yaw convention (180 = from the west, flying east); opts.finalYaw = the landed heading.
 * Returns { phase, t, x, y, z, yaw, pitch, roll, gear, squash, doors, lift, rear, dust, shield, shadow, harv, nav, heat }:
 *   gear / doors 0..1 (1 = down / open); squash = suspension travel (the gear's offset that keeps the feet planted
 *   while the hull dips); lift / rear thrust 0..1; dust, shield 0..1; shadow = blob-shadow strength while
 *   airborne; harv = harvester progress 0..1, or −1 before they appear; nav = navigation lights on 0..1;
 *   heat = engine heat 0..1 (cools after the cut — the nozzles glow and steam).
 */
export function landingPose(t, opts = {}) {
  const from = opts.fromDeg != null ? opts.fromDeg : 180, finalYaw = opts.finalYaw || 0;
  const fr = from * Math.PI / 180, ux = Math.cos(fr), uz = -Math.sin(fr);
  const travelYaw = from + 180;
  const ph = phaseAt(t);
  const P = { phase: ph.key, label: ph.label, t, x: 0, y: 0, z: 0, yaw: finalYaw, pitch: 0, roll: 0, gear: 1, squash: 0, doors: 0, lift: 0, rear: 0, dust: 0, shield: 0, shadow: 0, harv: -1, nav: 0, heat: 0 };
  if (ph.key === 'approach') {
    // Cruise in nose-down, then FLARE: lean back hard to turn the lift jets against the forward motion. It reaches
    // the hover point still drifting forward (FLARE.drift short of the spot) — the descent eats the rest.
    const u = ph.k, f = u * (2 - u) * (1 - FLARE.carry) + u * FLARE.carry;   // ends with a little velocity left
    const d = FLARE.drift + (APPROACH.dist - FLARE.drift) * (1 - f);
    P.x = ux * d; P.z = uz * d; P.y = APPROACH.hover + APPROACH.climb * (1 - outCubic(u));
    P.yaw = travelYaw;
    const s = smooth((u - 0.55) / 0.45);
    P.pitch = FLARE.cruise * (1 - s) + FLARE.lean * s;
    P.roll = Math.sin(u * Math.PI * 2) * 1.2 * (1 - s);
    P.gear = 0; P.rear = 1 - 0.85 * s; P.lift = 0.3 + 0.7 * s; P.shadow = 0.15 + 0.35 * u;
    P.nav = 1; P.heat = 1;
  } else if (ph.key === 'descent') {
    const k = smooth(ph.k) * (1 - IMPACT.carry) + ph.k * IMPACT.carry, t1 = ph.t;   // still sinking at contact
    // the forward drift bleeds off over FLARE.settle seconds, the lean-back with it, then a small forward
    // overshoot as the jets level the hull — momentum, not a crane
    const g = clamp01(t1 / FLARE.settle), drift = FLARE.drift * (1 - g) * (1 - g);
    P.x = ux * drift; P.z = uz * drift;
    P.y = APPROACH.hover * (1 - k);
    P.yaw = travelYaw + (shortestDelta(travelYaw, finalYaw)) * smooth(ph.k * 1.25);
    const back = FLARE.lean * (1 - smooth(g)), over = FLARE.overshoot * Math.sin(clamp01((t1 - FLARE.settle * 0.75) / 1.4) * Math.PI);
    P.pitch = back - over;
    P.gear = smooth((t1 - 1.0) / 1.6);
    P.lift = 1; P.rear = 0.15 * (1 - k); P.dust = k; P.shadow = 0.5 + 0.4 * k; P.nav = 1; P.heat = 1;
    P.roll = Math.sin(t * 3) * 0.6 * (1 - k);
  } else if (ph.key === 'touchdown') {
    // contact: the hull sinks into its suspension and springs back (the gear stays planted: squash), rocking
    // nose-down once with the momentum it brought in; the engines cut and cool
    P.y = suspension(ph.t); P.squash = -P.y;
    P.pitch = -IMPACT.rock * Math.exp(-3.5 * ph.t) * Math.sin(ph.t * 8.5);
    P.lift = Math.max(0, 1 - ph.k * 1.6); P.dust = 1 - ph.k * 0.5; P.shadow = 0.9 * (1 - ph.k);
    P.nav = 1; P.heat = 1 - 0.4 * ph.k;
  } else if (ph.key === 'hatches') {
    P.doors = doorOpen(ph.t); P.dust = Math.max(0, 0.5 - ph.t); P.shield = smooth(ph.t / 1.2);
    P.nav = 1 - smooth(ph.t / 1.4); P.heat = 0.6 * (1 - ph.k);
  } else if (ph.key === 'deploy') {
    P.doors = 1; P.shield = 1; P.harv = clamp01(ph.k);
  } else {   // done
    P.doors = 1; P.shield = 1; P.harv = 1;
  }
  return P;
}
function shortestDelta(a, b) { let d = ((b - a) % 360 + 540) % 360 - 180; return d; }

/** The pose of a craft that is simply parked (no sequence, or skipped). */
export function landedPose(opts = {}) { return Object.assign(landingPose(TOTAL + 1, opts), { phase: 'done', label: 'Landed' }); }

/**
 * A running sequence. step(dt) advances it and returns the events it crossed (in order, each once);
 * pose() is landingPose(t); skip() jumps to the end (firing what's left). Deterministic: no clocks, no random.
 */
export function createLanding(opts = {}) {
  let t = 0, next = 0;
  const fire = (to) => { const out = []; while (next < EVENTS.length && EVENTS[next].at <= to) out.push({ ...EVENTS[next++] }); return out; };
  return {
    get t() { return t; },
    get done() { return t >= TOTAL; },
    step(dt) { if (t >= TOTAL) return []; t = Math.min(TOTAL, t + Math.max(0, dt || 0)); return fire(t); },
    skip() { t = TOTAL; return fire(t); },
    pose() { return landingPose(t, opts); },
  };
}
