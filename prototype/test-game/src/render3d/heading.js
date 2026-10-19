/**
 * src/render3d/heading.js — per-entity heading for the 3D view, derived from motion between frames.
 *
 * The sim state carries positions, not a facing the renderer can use, so the view remembers where each unit
 * was when its heading was last set (the anchor) and, once it has travelled TURN_DIST from there, faces it
 * along that travel. Measuring over real travel instead of frame-to-frame motion means a unit shuffling in
 * place keeps its facing (a sim unit that flip-flops 0.15 cells every tick would otherwise read as a 180°
 * flip each frame), and grid stair-steps average into the true diagonal. A unit standing still keeps its
 * last heading (no snapping to 0). Entities that vanish are forgotten on sweep(). This is presentation state only — it is
 * never written back to the sim.
 *
 * Convention (plan v2.2 §6.3): heading = atan2(dz, dx) in cell space; model forward is +X.
 *
 * SMOOTH TURNING [MM-story_mv8lziay_e] (owner: "the turrets and vehicles can rotate by degree not big
 * steps"). update() gives the GOAL heading — it changes in jumps at every path corner, and a turret's goal
 * jumps at every target switch. turn() eases the DRAWN hull and turret toward their goals at a capped
 * rate, the shortest way round. The first heading a unit gets snaps (no spin on spawn).
 * Pure: no three.js.
 */

export const TURN_DIST = 0.2;   // cells of real travel before the goal heading follows it
export const HULL_TURN = (240 * Math.PI) / 180;     // rad/s — a vehicle swings round a corner in ~0.2–0.4 s
export const TURRET_TURN = (300 * Math.PI) / 180;   // rad/s — turrets slew a little faster than hulls
const TAU = Math.PI * 2;

/**
 * DRIVING — steer, never slide [MM-story_mvekcu8r_n]. Owner 2026-10-18: "vehicles should never turn and move, it looks
 * like sliding" / "units can steering with moderate direction changes but not 180 degree turn arounds".
 * A ground unit's DRAWN position chases its sim position, always moving the way its hull points:
 *   · within STEER of the way to go, it drives and steers (slowing as the angle grows: speed × cos);
 *   · past STEER (a sharp corner, a turn-around) it stops and pivots on the spot until within ALIGN, then drives;
 *   · inside DEAD of the sim position it holds still (a unit shuffling in place doesn't spin);
 *   · beyond SNAP (spawn, teleport, a long stall) it jumps there.
 * Chase speed = GAIN × distance, capped at VMAX cells/s, so it settles a fraction of a cell behind a moving unit and
 * catches up after a pivot. Render-only; shots aim at the drawn position.
 */
export const DRIVE = Object.freeze({ steer: (50 * Math.PI) / 180, align: (12 * Math.PI) / 180, dead: 0.2, stop: 0.03, gain: 6, vmax: 8, snap: 4 });

/** Signed shortest angle from a to b, in (−π, π]. */
export function angleDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d <= -Math.PI) d += TAU;
  return d;
}

/** Move `cur` toward `goal` by at most `maxStep` radians, the shortest way round. */
export function turnToward(cur, goal, maxStep) {
  const d = angleDelta(cur, goal);
  return Math.abs(d) <= maxStep ? goal : cur + Math.sign(d) * maxStep;
}

export function createHeadingTracker() {
  const last = new Map();   // id -> { x, y, heading }
  return {
    /** Update with this frame's position; returns the heading to draw (radians). */
    update(id, x, y, initial = 0) {
      const prev = last.get(id);
      if (!prev) { last.set(id, { x, y, heading: initial, moved: false, hull: null, aim: null }); return initial; }
      const dx = x - prev.x, dy = y - prev.y;      // prev.x / prev.y = the anchor
      if (dx * dx + dy * dy >= TURN_DIST * TURN_DIST) {
        prev.heading = Math.atan2(dy, dx);
        prev.x = x; prev.y = y;
        if (!prev.moved) { prev.moved = true; prev.hull = null; }   // the first real direction snaps
      }
      return prev.heading;
    },
    /**
     * Ease the drawn hull + turret of `id` toward their goals over `dt` seconds. Returns { heading, aim }
     * (radians, drawn). dt omitted / non-finite → snap to the goals (tests, single frames).
     */
    turn(id, goalHull, goalAim, dt, driven = false) {
      const e = last.get(id);
      if (!e) return { heading: goalHull, aim: goalAim };
      const snap = !(dt >= 0 && Number.isFinite(dt));
      if (!driven) e.hull = e.hull === null || snap ? goalHull : turnToward(e.hull, goalHull, HULL_TURN * dt);   // a driven hull is steered by drive()
      e.aim = e.aim === null || snap ? goalAim : turnToward(e.aim, goalAim, TURRET_TURN * dt);
      return { heading: e.hull, aim: e.aim };
    },
    /**
     * Drive the drawn position of ground unit `id` toward its sim position (x, y cells) over `dt` s. Returns
     * { x, y, heading } — the DRAWN position (cells) and hull (radians). See DRIVE. Updates the hull itself, so call
     * it instead of update()/turn()'s hull for driven units; turn() still eases the turret.
     */
    drive(id, x, y, dt, D = DRIVE) {
      let e = last.get(id);
      if (!e) { e = { x, y, heading: 0, moved: false, hull: null, aim: null }; last.set(id, e); }
      if (e.px === undefined || !(dt >= 0 && Number.isFinite(dt))) { e.px = x; e.py = y; e.moving = false; }
      const dx = x - e.px, dy = y - e.py, dist = Math.hypot(dx, dy);
      if (dist > D.snap) { e.px = x; e.py = y; e.moving = false; return { x, y, heading: e.hull === null ? e.heading : e.hull }; }
      if (!e.moving && dist > D.dead) e.moving = true;
      if (e.moving && dist < D.stop) e.moving = false;
      if (e.hull === null) e.hull = e.moved ? e.heading : (dist > 1e-6 ? Math.atan2(dy, dx) : e.heading);
      if (e.moving) {
        const want = Math.atan2(dy, dx);
        e.heading = want; e.moved = true;
        e.hull = turnToward(e.hull, want, HULL_TURN * dt);
        const off = Math.abs(angleDelta(e.hull, want));
        if (off > D.steer) e.pivot = true;              // too sharp to steer: stop and turn on the spot
        else if (off < D.align) e.pivot = false;
        if (!e.pivot) {
          const v = Math.min(D.vmax, D.gain * dist) * Math.cos(off), step = Math.min(dist, v * dt);
          e.px += Math.cos(e.hull) * step; e.py += Math.sin(e.hull) * step;   // along the hull — never sideways
        }
      }
      e.x = e.px; e.y = e.py;   // the motion anchor follows the drawn unit
      return { x: e.px, y: e.py, heading: e.hull };
    },
    /** Forget every id not in `liveIds` (a Set). */
    sweep(liveIds) {
      for (const id of last.keys()) if (!liveIds.has(id)) last.delete(id);
    },
    get size() { return last.size; },
  };
}
