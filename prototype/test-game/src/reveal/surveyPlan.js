/**
 * src/reveal/surveyPlan.js — the transport's arrival and survey scan, as pure functions [MM-story_mw56vi32_7].
 *
 * Ported from the Orbital Survey prototype (tools/planets/orbital-survey.html: startArrival / arcU / stepArrival /
 * stepSurvey / nextSite) so the reveal plays the same beats: inbound past the far moon, a gravity-assist swing round
 * it, a long braking burn down into survey orbit, the four resource targets loading on the way; then a wide sweep,
 * each candidate site scanned and rated in turn, and the best one LOCKED (the reveal's commit beat).
 * Owner 2026-11-06: "the players transport ship surveys the new planet. It is in the prototype, use the generic
 * transport ship for now". Tech plan: docs/tech-plan/Content-Reveal.md §5.1 (P4–P5).
 *
 * What changed from the prototype: no GPU height probe (sites are seeded offsets round the ship's ground point, scored
 * from a seeded draw), no unknown-contact call (owner 2026-11-06: "What unknown contact"), and the cycle stops at the
 * lock instead of resurveying. No three.js, no clock, no Math.random.
 */
export const ARRIVE_S = 17;
export const SURVEY = Object.freeze({ sweep: 4.2, slew: 0.8, dwell: 2.3, hold: 2.4, sites: 5 });
export const LETTERS = 'ABCDEF';

/** A seeded generator (the prototype's mulberry32). */
export function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * The arrival's speed along its path: fast inbound, eased right down through the moon flyby (at path fraction uFly)
 * so the moon reads, then a long braking burn. → the cumulative time table T (0..1 over N steps).
 */
export function speedTable(uFly, N = 600) {
  const speed = (u) => (0.1 + Math.pow(1 - u, 1.3)) * (1 - 0.72 * Math.exp(-(((u - uFly) / 0.05) ** 2)));
  const T = [0];
  for (let j = 1; j <= N; j++) T.push(T[j - 1] + 1 / speed((j - 0.5) / N));
  return T.map((v) => v / T[N]);
}

/** Time fraction x (0..1) → path fraction u (inverts the speed profile). */
export function arcU(T, x) {
  const N = T.length - 1; let lo = 0, hi = N;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (T[mid] < x) lo = mid; else hi = mid; }
  return (lo + (x - T[lo]) / Math.max(1e-9, T[hi] - T[lo])) / N;
}

/**
 * The readout during the arrival at time fraction x, path fraction u: mode, status line, how many of the four targets
 * have loaded, the engine burn (1 full, 0.2 idle), and how far the camera has blended to the orbit view.
 */
export function arrivalReadout(x, u, uFly, planetName) {
  let mode, status;
  if (u < uFly - 0.07) { mode = 'Inbound'; status = `Inbound to ${planetName} · resource targets loaded`; }
  else if (u < uFly + 0.06) { mode = 'Flyby'; status = 'Lunar flyby · gravity assist'; }
  else if (x < 0.88) { mode = 'Insertion'; status = 'Orbit insertion burn'; }
  else { mode = 'Settling'; status = 'Settling into survey orbit'; }
  const w = Math.min(1, Math.max(0, (x - 0.7) / 0.3));
  return {
    mode, status,
    targets: Math.max(0, Math.min(4, Math.floor((x - 0.06) / 0.06) + 1)),
    burn: x < 0.12 || (u > uFly + 0.04 && x < 0.9) ? 1 : 0.2,
    blend: w * w * (3 - 2 * w),
    settled: x >= 1,
  };
}

/**
 * Candidate landing sites round the ground point under the ship, seeded: { ang, dist (rad on the sphere), yield,
 * slope, score }. The prototype read yield and slope from the terrain; here they are drawn from the seed in the same
 * ranges, so each planet always surveys the same way.
 */
export function pickSites(seed, n = SURVEY.sites) {
  const R = mulberry(seed), out = [];
  for (let i = 0; i < n; i++) {
    const ang = R() * Math.PI * 2, dist = 0.06 + Math.sqrt(R()) * 0.18;
    const yieldQ = Math.round(30 + R() * 66), slope = Math.round(2 + R() * 24);
    const score = Math.round(Math.min(98, Math.max(8, yieldQ * 0.68 + (100 - slope * 3.2) * 0.32)));
    out.push({ id: LETTERS[i], ang, dist, yield: yieldQ, slope, score, state: 'hidden', shown: 0 });
  }
  return out;
}

/**
 * The survey cycle: sweep → (slew → dwell) per site → slew to the best → hold. step(dt) advances it and returns the
 * state { phase, sites, scanIdx, lockIdx, aim: { ang, dist, r } (where the beam points, polar round the ground point),
 * sweepAngle, mode, status, locked, done }. done is true after the hold on the locked site.
 */
export function createSurvey(seed, { resourceName = 'resources', S = SURVEY } = {}) {
  const sites = pickSites(seed, S.sites);
  let phase = 'sweep', t = 0, scanIdx = -1, lockIdx = -1, sweepA = 0, done = false;
  let from = { ang: 0, dist: 0, r: 0.28 }, to = { ang: 0, dist: 0, r: 0.28 }, aim = { ang: 0, dist: 0, r: 0.28 };
  const aimAt = (s, r) => { from = { ...aim }; to = { ang: s ? s.ang : 0, dist: s ? s.dist : 0, r }; };
  function next() {
    scanIdx = sites.findIndex((s) => s.state === 'queued');
    if (scanIdx >= 0) { sites[scanIdx].state = 'scanning'; aimAt(sites[scanIdx], 0.045); phase = 'slew'; t = 0; return; }
    lockIdx = sites.reduce((bi, s, i) => (bi < 0 || s.score > sites[bi].score ? i : bi), -1);
    sites[lockIdx].state = 'locked'; aimAt(sites[lockIdx], 0.06); phase = 'slew'; t = 0;
  }
  function state() {
    let mode = 'Surveying', status;
    if (phase === 'sweep') status = `Wide-area sweep for ${resourceName} · ${sites.filter((s) => s.state !== 'hidden').length} contacts`;
    else if (scanIdx >= 0 && (phase === 'slew' || phase === 'dwell')) status = `Scanning site ${sites[scanIdx].id}`;
    else { const s = sites[lockIdx]; mode = 'Site locked'; status = `Landing site ${s.id} confirmed · score ${s.score} · descent window opens`; }
    return { phase, sites, scanIdx, lockIdx, aim: { ...aim }, sweepAngle: sweepA, mode, status, locked: lockIdx >= 0 && phase === 'hold', done };
  }
  return {
    step(dt) {
      t += dt;
      if (phase === 'sweep') {
        sweepA = (t / S.sweep) * Math.PI * 2 * 1.25;
        for (const s of sites) if (s.state === 'hidden' && sweepA >= s.ang) s.state = 'queued';
        if (t >= S.sweep) { sites.forEach((s) => { if (s.state === 'hidden') s.state = 'queued'; }); next(); }
      } else if (phase === 'slew') {
        const k = Math.min(1, t / S.slew), e = k * k * (3 - 2 * k);
        let da = to.ang - from.ang; if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2;
        aim = { ang: from.ang + da * e, dist: from.dist + (to.dist - from.dist) * e, r: from.r + (to.r - from.r) * e };
        if (k >= 1) { phase = scanIdx >= 0 && lockIdx < 0 ? 'dwell' : 'hold'; t = 0; }
      } else if (phase === 'dwell') {
        sweepA += dt * 5.5;
        const s = sites[scanIdx]; s.shown = Math.min(1, t / (S.dwell * 0.85));
        if (t >= S.dwell) { s.state = 'rated'; s.shown = 1; next(); }
      } else if (phase === 'hold') {
        sweepA += dt * 1.6;
        if (t >= S.hold) done = true;
      }
      return state();
    },
    /** Jump to the end: every site rated, the best locked, the hold over (skip / reduced motion). */
    finish() {
      for (const s of sites) { s.state = 'rated'; s.shown = 1; }
      lockIdx = sites.reduce((bi, s, i) => (bi < 0 || s.score > sites[bi].score ? i : bi), -1);
      sites[lockIdx].state = 'locked'; scanIdx = -1;
      aim = { ang: sites[lockIdx].ang, dist: sites[lockIdx].dist, r: 0.06 }; phase = 'hold'; done = true;
      return state();
    },
    get state() { return state(); },
  };
}

/** The four resource targets the readout lists (common → epic), from the planet's resource names. */
export const TARGET_TIERS = Object.freeze([
  { key: 'common', label: 'Common', color: '#c3cdc6', val: 'hold · ×1' },
  { key: 'uncommon', label: 'Uncommon', color: '#6fd3c8', val: 'hold · ×2' },
  { key: 'rare', label: 'Rare', color: '#8fb4ff', val: 'rare contract' },
  { key: 'epic', label: 'Epic', color: '#d79bff', val: 'kept' },
]);
