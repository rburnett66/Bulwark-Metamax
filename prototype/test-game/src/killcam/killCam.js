/**
 * src/killcam/killCam.js — the Kill Camera's memory and playback [MM-task_mvjng7sh_a] (story [MM-story_mvjng4fq_9]).
 *
 * Owner 2026-10-22: "When the players base is destroyed … create a Kill Camera that focused of the point in the middle
 * between the base and the unit that killed the base. Then replay the last 10 seconds of the battle showing the unit
 * firing and then show the base explode and burn for 5 seconds."
 *
 * The sim is deterministic (replay.js), so the replay is the real sim run again, not a recording of the screen:
 *   - the RECORDER keeps a snapshot of the sim every KILLCAM.snapEvery seconds (the last ~KILLCAM.keep s), every
 *     accepted command with its tick, and the attacker of the base's killing blow (the 'damage' event with
 *     targetKind 'base' and killed: true);
 *   - at defeat, plan() picks the newest snapshot at least KILLCAM.window seconds before the end and clones it;
 *   - the PLAYER steps that clone with the same commands at the same ticks — it reaches the same death on the same
 *     tick — then holds the final state for KILLCAM.burn seconds while the base burns.
 *
 * Snapshots are taken OUTSIDE the tick path (after stepSim returns) and touch nothing the sim reads, so live play,
 * replays and the balance sim are unchanged. A snapshot is a structured clone of the state with the rng's internal
 * state carried across (its methods can't be cloned); the immutable board (map, waveTable) is shared, not copied.
 */
import { createRng } from '../sim/rng.js';

export const KILLCAM = Object.freeze({
  window: 10,      // seconds of battle replayed before the base falls
  burn: 5,         // seconds the base burns after it falls
  snapEvery: 1,    // seconds between snapshots
  keep: 12,        // seconds of snapshots kept (window + slack)
});

const SHARED = ['rng', 'map', 'waveTable'];

/** A copy of the sim that steps exactly like the original. */
export function snapshotSim(sim) {
  const rest = {};
  for (const k of Object.keys(sim)) if (!SHARED.includes(k)) rest[k] = sim[k];
  const c = structuredClone(rest);
  c.map = sim.map; c.waveTable = sim.waveTable;
  const rng = createRng(1);
  rng.setState(sim.rng.getState());
  c.rng = rng;
  c.events = [];
  return c;
}

/**
 * The recorder. fixedDt = the sim's FIXED_DT. Call after(sim, events) after every stepSim (and once at the start),
 * command(tick, cmd) for every accepted command, plan(sim) at defeat.
 */
export function createKillCamRecorder({ fixedDt }) {
  const every = Math.max(1, Math.round(KILLCAM.snapEvery / fixedDt));
  const keepTicks = Math.round(KILLCAM.keep / fixedDt);
  const windowTicks = Math.round(KILLCAM.window / fixedDt);
  let snaps = [], commands = [], killer = null, lastHit = null;
  return {
    after(sim, events) {
      if (events) for (const ev of events) {
        if (ev.type !== 'damage' || ev.targetKind !== 'base') continue;
        if (ev.sourceId != null) lastHit = ev.sourceId;
        if (ev.killed && killer === null) killer = ev.sourceId != null ? ev.sourceId : lastHit;
      }
      if (sim.result) return;
      if (!snaps.length || sim.tick - snaps[snaps.length - 1].tick >= every) {
        snaps.push({ tick: sim.tick, sim: snapshotSim(sim) });
        // keep the newest snapshot that is at least `keep` old, and everything newer — so a full window is always there
        while (snaps.length > 1 && sim.tick - snaps[1].tick >= keepTicks) snaps.shift();
        const oldest = snaps[0].tick;
        commands = commands.filter((c) => c.tick >= oldest);
      }
    },
    command(tick, cmd) { commands.push({ tick, cmd: structuredClone(cmd) }); },
    /** At defeat: { start (a fresh clone), commands, endTick, killerId, base } — or null when there is nothing to show. */
    plan(sim) {
      if (!snaps.length || sim.result !== 'lose') return null;
      const endTick = sim.tick;
      let pick = snaps[0];
      for (const s of snaps) if (endTick - s.tick >= windowTicks) pick = s;
      const killerId = killer != null ? killer : lastHit;
      return {
        start: snapshotSim(pick.sim),
        commands: commands.filter((c) => c.tick >= pick.tick).map((c) => ({ tick: c.tick, cmd: structuredClone(c.cmd) })),
        endTick,
        killerId,
        killerPos: unitPos(sim, killerId),
        base: sim.map && sim.map.base ? { x: sim.map.base.x, y: sim.map.base.y } : null,
      };
    },
    get snapshots() { return snaps.map((s) => s.tick); },
    get killerId() { return killer; },
    reset() { snaps = []; commands = []; killer = null; lastHit = null; },
  };
}

/** Where a unit is in this state — its live position, or null once it is gone. */
function unitPos(sim, id) {
  const u = id != null && sim.units ? sim.units.get(id) : null;
  return u && u.pos ? { x: u.pos.x, y: u.pos.y } : null;
}

/**
 * The player. Real time in, sim frames out: step(dt) → { sim, events, phase: 'replay' | 'burn' | 'done', t, burnT,
 * killerPos, justFell }. sim = { stepSim, applyCommand, FIXED_DT } from sim/core.js.
 */
export function createKillCamPlayer(plan, { stepSim, applyCommand, FIXED_DT }) {
  const sim = plan.start;
  const queue = plan.commands.slice();
  let qi = 0, acc = 0, phase = 'replay', burnT = 0, t = 0;
  let killerPos = plan.killerPos || unitPos(sim, plan.killerId);
  const out = { sim, events: [], phase, t: 0, burnT: 0, killerPos, justFell: false };
  return {
    get sim() { return sim; },
    get phase() { return phase; },
    step(dt) {
      const d = Math.max(0, Math.min(0.25, dt || 0));
      const events = [];
      let justFell = false;
      t += d;
      if (phase === 'replay') {
        acc += d;
        while (acc >= FIXED_DT && phase === 'replay') {
          while (qi < queue.length && queue[qi].tick <= sim.tick) { applyCommand(sim, queue[qi].cmd); qi++; }
          const evs = stepSim(sim, FIXED_DT);
          if (evs) for (const e of evs) events.push(e);
          acc -= FIXED_DT;
          if (!plan.killerPos) killerPos = unitPos(sim, plan.killerId) || killerPos;   // the killer died with its shot: last seen
          if (sim.result || sim.tick >= plan.endTick) { phase = 'burn'; justFell = true; acc = 0; }
        }
      } else if (phase === 'burn') {
        burnT += d;
        if (burnT >= KILLCAM.burn) phase = 'done';
      }
      out.events = events; out.phase = phase; out.t = t; out.burnT = burnT; out.killerPos = killerPos; out.justFell = justFell;
      return out;
    },
    /** Jump straight to the end (tap to skip). */
    skip() { phase = 'done'; },
  };
}

/** The point the camera looks at: halfway between the base and the killer (the base alone if the killer is unknown). */
export function killCamFocus(base, killerPos) {
  if (!base) return null;
  if (!killerPos) return { x: base.x, y: base.y };
  return { x: (base.x + killerPos.x) / 2, y: (base.y + killerPos.y) / 2 };
}
