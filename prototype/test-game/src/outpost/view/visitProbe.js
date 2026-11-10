/**
 * src/outpost/view/visitProbe.js — raiders the player can see during a visit (owner 2026-11-09: "when the player visits
 * the outpost there should be some visible drone units or light tanks that occasionally attack the base").
 *
 * A **probe** is a small raid: the planet's light tank and a trooper (two, or three every other probe; the faction has no
 * drones). It comes down a raid lane on the battle sim (raid.js createRaid with its own units), the defenses fire on it,
 * and the view draws it with the battle renderer, live. The first probe comes 45–75 s into a visit and the next every
 * 100–180 s after the last one ends, on the view's own clock.
 *
 * What a probe changes:
 * - **Defense wear carries over:** a defense ends the probe with the HP the sim left it, so the red damage sparks and
 *   REPAIR follow from it.
 * - **A probe takes no ore.** If it reaches the base it fires on it and then pulls back.
 * - **It is not one of the outpost's raids,** so it doesn't touch the raid schedule, the log or the contract steps.
 *
 * Determinism: the probe's sim is seeded from the outpost seed and the probe's number in the visit, and steps only in
 * the sim's fixed ticks (CLAUDE.md, replay determinism). Pure apart from createRaid; no DOM, no clock.
 */
import { createRaid } from '../raid.js';
import { raidFor } from '../../data/outpost.js';

/** When probes come, in seconds of visit time: the first, then the gap after each one ends. */
export const PROBE_FIRST_S = [45, 75];
export const PROBE_GAP_S = [100, 180];
/** A probe gives up and pulls back after this long, held or not. */
export const PROBE_MAX_S = 90;

function mix(a, b) {
  let h = ((a >>> 0) ^ Math.imul((b | 0) + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Seconds until probe number n (0 = the first) comes, after the visit opens (n = 0) or the last probe ends. */
export function probeDelay(seed, n) {
  const [lo, hi] = n === 0 ? PROBE_FIRST_S : PROBE_GAP_S;
  return lo + (mix(seed, 0x9b0 + n) % 1000) / 1000 * (hi - lo);
}

/** The probe's raiders: the planet's light tank and a trooper, and a second tank every other probe. [] without data. */
export function probeUnits(planet, n = 0) {
  const r = raidFor(planet, 1);
  if (!r || !r.units.length) return [];
  const tank = r.units.find((u) => /-Tanks$/.test(u)) || r.units[0];
  const troop = r.units.find((u) => /-Troops$/.test(u)) || r.units[0];
  return n % 2 ? [tank, troop, tank] : [tank, troop];
}

/** The probe's sim seed: the outpost seed and the probe's number in the visit. */
export const probeSeed = (outpostSeed, n) => mix(outpostSeed >>> 0, 0x5eed00 + n) || 1;

/**
 * Start probe number n against the outpost as it stands. powered: the defenses with power (powerGrids(o, map).powered).
 * → createRaid's stepping object, or null when the planet has no raiders.
 */
export function startProbe(outpost, n, { map, powered = [], step = 1 } = {}) {
  const units = probeUnits(outpost.planet, n);
  if (!units.length || !map) return null;
  const probe = createRaid(outpost, { powered }, { map, step, units, seed: probeSeed(outpost.seed, n) });
  probe.startHp = new Map(outpost.defenses.map((d) => [d.id, d.hp]));   // the damage it deals is measured from here
  return probe;
}

/**
 * The wear a probe leaves on the outpost as it stands now: [{ id, hp }] for each defense it hurt, the damage it dealt
 * (its HP at the start less its HP in the probe's sim) taken off the defense's current HP. So a repair made while the
 * probe ran still counts, and a probe never touches ore or buildings.
 */
export function probeWear(outpost, probe) {
  if (!probe || !probe.startHp) return [];
  const out = [];
  for (const { id, hp } of probeDefenseHp(probe)) {
    const dealt = (probe.startHp.get(id) ?? hp) - hp, d = outpost.defenses.find((x) => x.id === id);
    if (d && dealt > 0) out.push({ id, hp: Math.max(0, Math.round((d.hp - dealt) * 1000) / 1000) });
  }
  return out;
}

/** Every defense's HP in a running probe's sim right now: [{ id, hp }] (one the raiders destroyed reads 0). */
export function probeDefenseHp(probe) {
  return [...probe.defenseIds].map(([sid, id]) => { const s = probe.state.structures.get(sid); return { id, hp: s ? Math.max(0, s.hp) : 0 }; });
}

/** Has a running probe reached the base? (the sim's breach rule) */
export const probeBreached = (probe) => !!(probe && probe.done && probe.result() && probe.result().result === 'breach');

/** Apply probe wear to an outpost (a copy). → outpost */
export function applyProbeWear(outpost, wear) {
  const by = new Map((wear || []).map((w) => [w.id, w.hp]));
  return { ...outpost, defenses: outpost.defenses.map((d) => (by.has(d.id) ? { ...d, hp: Math.max(0, Math.min(d.hp, by.get(d.id))) } : d)) };
}
