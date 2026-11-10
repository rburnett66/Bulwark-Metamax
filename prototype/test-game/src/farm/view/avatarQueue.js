/**
 * src/farm/view/avatarQueue.js — the avatar's tap queue, as a small pure state machine [MM-story_mwabh0cd_i].
 *
 * Farming-Design §2.6 / §5.1: tapping PREP, PLANT or HARVEST (or HARVEST ALL) on the FARM tab sends the gold avatar
 * walking to the plot; it works the plot (the crew rig's `work` pose) and the plot moves on when the work is done.
 * Taps queue and are worked in order. In a raid (§10) the avatar walks to the Farmhouse and waits; the queue resumes
 * after. The walk is presentation: the model's action runs through session.act once, when the job LANDS.
 *
 * Every job lands exactly once:
 *   enqueue → (walk → arrived → work → tick… → land) | (walk → noPath → land at once)
 * A shelter while a job is walking or working puts it back at the head of the queue (it has not landed), and the
 * queue picks it up again when the shelter ends. A tap for a job already queued (same action, same plot) is a no-op.
 *
 *   let q = createQueue();
 *   ({ q, effects } = queueStep(q, { type: 'enqueue', action: { type: 'harvest', plot: 'p3' } }));
 *   effects: [{ type: 'walk', job }] | [{ type: 'work', job }] | [{ type: 'land', job }] | [{ type: 'home' }]
 *            | [{ type: 'shelter' }] | [{ type: 'dup', key }]
 *
 * Pure: no DOM, no clock, no randomness; time comes in as tick dt.
 */

/** How long the avatar works a plot before its action lands (seconds; the scale prototype's 0.9 s, a touch longer). */
export const WORK_SEC = 1.1;

/** An empty queue. */
export function createQueue() {
  return { jobs: [], cur: null, shelter: false, seq: 0, landed: 0 };
}

/** The dedupe key of an action: one queued job per action type and plot. */
export const jobKey = (action) => `${action.type}:${action.plot ?? ''}`;

/** Is the avatar doing nothing (no job walking or working, nothing queued)? */
export const queueIdle = (q) => !q.cur && !q.jobs.length;

/** What the queue holds, in order, for the review handle: [{ key, phase: 'walk' | 'work' | 'queued' }]. */
export function queueView(q) {
  return [...(q.cur ? [{ key: q.cur.job.key, phase: q.cur.phase }] : []), ...q.jobs.map((j) => ({ key: j.key, phase: 'queued' }))];
}

/**
 * One event → { q (a new state), effects }.
 * events: { type: 'enqueue', action } · { type: 'arrived' } · { type: 'noPath' } · { type: 'tick', dt }
 *         · { type: 'shelter', on } · { type: 'clear' }
 * opts: { workSec }
 */
export function queueStep(q0, ev, opts = {}) {
  const workSec = opts.workSec ?? WORK_SEC;
  const q = { ...q0, jobs: q0.jobs.slice(), cur: q0.cur ? { ...q0.cur } : null };
  const effects = [];
  const kick = (wasBusy) => {
    if (q.shelter || q.cur) return;
    if (!q.jobs.length) { if (wasBusy) effects.push({ type: 'home' }); return; }
    const job = q.jobs.shift();
    q.cur = { job, phase: 'walk', left: 0 };
    effects.push({ type: 'walk', job });
  };
  const land = () => {
    const job = q.cur.job;
    q.cur = null; q.landed++;
    effects.push({ type: 'land', job });
    kick(true);
  };
  switch (ev.type) {
    case 'enqueue': {
      const key = jobKey(ev.action);
      if ((q.cur && q.cur.job.key === key) || q.jobs.some((j) => j.key === key)) { effects.push({ type: 'dup', key }); break; }
      q.jobs.push({ id: ++q.seq, key, action: ev.action, plot: ev.action.plot ?? null });
      kick(false);
      break;
    }
    case 'arrived':
      if (q.cur && q.cur.phase === 'walk') { q.cur.phase = 'work'; q.cur.left = workSec; effects.push({ type: 'work', job: q.cur.job }); }
      break;
    case 'noPath':   // the plot can't be walked to: do the action at once rather than lose it
      if (q.cur && q.cur.phase === 'walk') land();
      break;
    case 'tick':
      if (q.cur && q.cur.phase === 'work') { q.cur.left -= ev.dt || 0; if (q.cur.left <= 1e-9) land(); }
      break;
    case 'shelter':
      if (ev.on && !q.shelter) {
        q.shelter = true;
        if (q.cur) { q.jobs.unshift(q.cur.job); q.cur = null; }   // not landed: it goes back to the head
        effects.push({ type: 'shelter' });
      } else if (!ev.on && q.shelter) {
        q.shelter = false;
        kick(true);
      }
      break;
    case 'clear':
      q.jobs = []; q.cur = null;
      break;
    default: break;
  }
  return { q, effects };
}
