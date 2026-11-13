/**
 * src/outpost/view/saleDriver.js — runs the SELL sequence on the session view [MM-story_mwefm2or_j].
 *
 * Owner 2026-11-12: "on the updated outpost when I sell resources I dont see the dollar values or the deliver ship take
 * off". S6 (PR #299) deleted the old farm view and its sale driver (outpostView.js doSell / saleRun) with it; this is that
 * driver, for the battle session's frame hook. A sale is banked at once (the save session's act 'sell'); this only plays it:
 *   start(res, …)  the sell result's per-load entries → sellTimeline(); the scene's playSale (shuttle, crates, splatter,
 *                  "$N" pops on the battle's gold popups). The shuttle model may fail to load: the sale plays on (pops +
 *                  count-up) and the failure goes to the error report's crumbs.
 *   step(dt, out)  per frame, with the scene's update() result: the HUD gold counts up across the shuttle's arc
 *                  (shown()), the camera shakes on the lift (offset()). A watchdog ends a sale that outlives its timeline.
 * Pure: no DOM, no three.js, no clock — the caller hands it dt.
 */
import { sellTimeline } from './sellTimeline.js';

/** Seconds past the sale timeline before the watchdog ends a stalled sale (the HUD gold comes back to the bank). */
export const SALE_GRACE = 2;

export function createSaleDriver({ reduced = false, crumb = () => {} } = {}) {
  let run = null, shake = null;
  function finish(why) {
    if (!run) return;
    const r = run;
    run = null; shake = null;
    if (why) { crumb('outpost: sale ended early · ' + why); try { if (r.scene && r.scene.cancelSale) r.scene.cancelSale(); } catch (e) { /* tidy-up only */ } }
  }
  return {
    /**
     * Start playing a sale. res: the save session's sell result ({ ok, loads, earned }); goldFrom: the bank before it;
     * before: the outpost before the sale (the scene's storage, conduit route and hub); scene: outpostScene or null.
     * → the timeline, or null when there is nothing to play.
     */
    start(res, { goldFrom = 0, before = null, scene = null } = {}) {
      if (!res || !res.ok || !Array.isArray(res.loads) || !res.loads.length) return null;
      if (run) finish('a new sale');
      const tl = sellTimeline(res.loads, { reduced, goldFrom });
      run = { tl, t: 0, scene, gold: goldFrom };
      if (scene && scene.playSale && before) {
        try {
          Promise.resolve(scene.playSale(tl, before)).catch((e) => crumb('outpost: sale shuttle failed · ' + ((e && e.message) || e)));
        } catch (e) { crumb('outpost: sale shuttle failed · ' + ((e && e.message) || e)); }
      }
      crumb(`outpost: sale · ${res.loads.length} loads · +${tl.total}`);
      return tl;
    },
    /** Per frame: dt seconds; out the scene's update() result ({ sale?, shake? }) or null. */
    step(dt, out = null) {
      if (!run) return;
      run.t += Math.max(0, dt || 0);
      const tl = run.tl;
      if (out && out.shake) shake = out.shake;
      const s = out && out.sale;
      run.gold = s && s.gold != null ? s.gold : tl.countAt(run.t);
      if (s && s.done) { finish(s.failed ? 'failed: ' + s.failed : null); return; }
      if (run.t > tl.duration + SALE_GRACE) { finish('watchdog'); return; }
      // no scene to play it (2D, or the scene ended it without telling us): the clock alone runs the count-up
      if ((!run.scene || run.scene.saling === false) && run.t >= tl.duration) finish(null);
    },
    /** The gold the HUD shows now: the count-up while a sale plays, else the bank (fallback). */
    shown(fallback) { return run ? run.gold : fallback; },
    /** The camera jitter now (the lift's shake, fading): { x, z } in world units. */
    offset() {
      if (!run || !shake) return { x: 0, z: 0 };
      const left = shake.until - run.t;
      if (left <= 0) { shake = null; return { x: 0, z: 0 }; }
      const a = shake.amp * (left / (shake.until - shake.t0));
      return { x: Math.sin(run.t * 71) * a, z: Math.cos(run.t * 53) * a };
    },
    get active() { return !!run; },
    get timeline() { return run ? run.tl : null; },
    get t() { return run ? run.t : 0; },
    cancel: () => finish('cancelled'),
  };
}
