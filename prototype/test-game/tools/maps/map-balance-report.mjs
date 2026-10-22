// tools/maps/map-balance-report.mjs — summarise a map-balance-sim.mjs result file. Usage: node map-balance-report.mjs out.json [analysis.json]
import fs from 'node:fs';
const rows = JSON.parse(fs.readFileSync(process.argv[2] || 'map-balance-sim.json', 'utf8'));
const mean = (a) => a.length ? a.reduce((p, q) => p + q, 0) / a.length : NaN;
const out = {};
for (const r of rows) {
  const o = out[r.faction] = out[r.faction] || { slug: r.slug };
  const n = r.runs.length;
  const P = r.pressure;
  const sumLane = (lane) => mean(P.map((x) => x.perWave.reduce((a, w) => a + w.lane[lane], 0)));
  const groundWaves = P.flatMap((x) => x.perWave.map((w) => w.firstGround).filter((v) => v != null));
  const stalls = P.reduce((a, x) => a + x.perWave.reduce((p, w) => p + (w.stalled || 0), 0), 0);
  const stuck = {}; for (const x of P) for (const w of x.perWave) for (const u of (w.stuck || [])) stuck[u] = (stuck[u] || 0) + 1;
  const byUnit = {}; for (const x of P) for (const [k, v] of Object.entries(x.byUnit)) byUnit[k] = (byUnit[k] || 0) + v / n;
  o[r.map] = {
    wins: r.runs.filter((x) => x.result === 'win').length, n,
    wavesSurvived: mean(r.runs.map((x) => x.perWave.filter((w) => w.secs > 0).length)),
    ground: sumLane('ground'), water: sumLane('water'), air: sumLane('air'),
    firstGround: mean(groundWaves), stalls, stuck, byUnit,
    w12: mean(P.map((x) => x.perWave.filter((w) => w.wave <= 2).reduce((a, w) => a + w.baseDmg, 0))),
  };
}
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
const f = (v, d = 0) => Number.isFinite(v) ? v.toFixed(d) : '—';
console.log('faction'.padEnd(17), 'map', 'wins', 'wavesSurv', 'groundDmg', 'waterDmg', 'airDmg', 'firstGroundHit', 'w1-2dmg', 'stalls');
for (const [fac, o] of Object.entries(out)) for (const m of ['old', 'new']) { const x = o[m];
  console.log(fac.padEnd(17), m, `${x.wins}/${x.n}`.padEnd(4), f(x.wavesSurvived, 1).padEnd(9), f(x.ground).padEnd(9), f(x.water).padEnd(8), f(x.air).padEnd(6), (f(x.firstGround, 1) + 's').padEnd(14), f(x.w12).padEnd(7), x.stalls, JSON.stringify(x.stuck)); }
