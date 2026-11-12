// Upgraded buildings draw more power [MM-story_mwcp7u7b_3a]. Owner 2026-11-11: "Tiers no [they don't count toward raid
// size] — but upgraded buildings can use more power requiring upgraded power stations." The numbers are the workbook's
// (Outpost_Structures Power_Draw, tools/economy/patch_tier_power_draw.py); an upgrade that outgrows the grid goes ahead,
// flagged (model.upgradeGridShort), never refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { referenceOutpost, powerGrids, upgrade, upgradeDefense, upgradeGridShort, advance, defaultPads } from './model.js';
import { DRAFT_LAYOUT as map } from './draftLayout.js';
import { structureDef, OUTPOST } from '../data/outpost.js';
import { toLiveSim, fromLiveSim } from './liveSim.js';
import { applyCommand, stepSim, FIXED_DT } from '../sim/core.js';
import { createSession } from './view/session.js';
import { acceptOutpostContract } from './contract.js';
import { defaultSave } from '../save/save.js';
import { map as forgeMap, catalog, memoryStore } from './view/fixtures.mjs';

const T0 = Date.UTC(2026, 10, 11, 12, 0, 0);
const draw = (k, t) => structureDef(k, t).draw;
const main = (o) => powerGrids(o, map).grids.find((g) => g.stations.includes('p1'));
const SHORT = 'grid short — upgrade a Power Station';
const ctx = (extra = {}) => ({ map, gold: 1e9, now: T0, unlocks: new Set(['rig_mk2', 'supply_depot', 'power_grid_2']),
  techOwned: new Set(['mg2', 'mg3', 'cannon2', 'cannon3']), ...extra });

test('tier draws rise: tier N of a tiered consumer draws N × its tier-I draw', () => {
  for (const [kind, tiers] of [['rig', 2], ['storage', 2], ['mg', 3], ['cannon', 3]]) {
    assert.ok(draw(kind, 1) > 0, kind + ' draws power');
    for (let t = 2; t <= tiers; t++) {
      assert.equal(draw(kind, t), t * draw(kind, 1), `${kind} tier ${t}`);
      assert.ok(draw(kind, t) > draw(kind, t - 1), `${kind} tier ${t} draws more than tier ${t - 1}`);
    }
  }
  assert.deepEqual([draw('rig', 1), draw('rig', 2), draw('storage', 1), draw('storage', 2)], [4, 8, 1, 2]);
  assert.deepEqual([1, 2, 3].map((t) => draw('mg', t)), [1, 2, 3]);
  assert.deepEqual([1, 2, 3].map((t) => draw('cannon', t)), [1, 2, 3]);
  // single-tier and zero-draw kinds unchanged
  assert.deepEqual([draw('hub', 1), draw('resourceBay', 1), draw('upgradeBay', 1)], [2, 2, 1]);
  assert.deepEqual([draw('habitat', 1), draw('habitat', 2), draw('wall', 1), draw('wall', 2), draw('pylon', 1), draw('power', 1), draw('power', 2), draw('harvester', 1)],
    [0, 0, 0, 0, 0, 0, 0, 0]);
  // the stations themselves are unchanged: 10 / 20
  assert.deepEqual([structureDef('power', 1).supply, structureDef('power', 2).supply], [10, 20]);
});

test('tiers still do not count toward raid size (the outpost size counts buildings, not tiers)', () => {
  const o = referenceOutpost('ground', { seed: 3, map, now: T0 });
  const hi = structuredClone(o);
  hi.pads.r1.tier = 2; hi.pads.s1.tier = 2;
  for (const d of hi.defenses) if (d.kind !== 'wall') d.tier = 3;
  // same schedule on one seed whatever the tiers: raidDraws/raidChance read the outpost size only
  const sched = (x) => advance({ ...x, online: true, firstRaidAt: T0 }, T0 + 48 * 3_600_000,
    { map, raid: () => ({ result: 'held', defenses: [] }), params: OUTPOST }).report.raids.map((r) => r.at);
  assert.ok(sched(o).length > 0, 'the window has raids to compare');
  assert.deepEqual(sched(hi), sched(o));
});

test('the reference outpost: upgrades cross Power Station I and Power Station II restores the grid', () => {
  const ref = referenceOutpost('ground', { seed: 7, map, now: T0 });
  assert.deepEqual([main(ref).draw, main(ref).supply], [9, 10], 'the kit draws 9 of 10');
  assert.equal(upgradeGridShort(ref, map), null, 'nothing pending: no warning');

  // one gun to tier II on the bare reference grid: 10 of 10, fine
  const gunII = structuredClone(ref);
  gunII.defenses.find((d) => d.kind === 'mg').tier = 2;
  assert.deepEqual([main(gunII).draw, main(gunII).supply], [10, 10]);
  assert.deepEqual(powerGrids(gunII, map).off, {});

  // both guns to tier II: 11 > 10 — Power Station I is short
  const bothII = structuredClone(gunII);
  bothII.defenses.find((d) => d.kind === 'cannon').tier = 2;
  assert.ok(Object.values(powerGrids(bothII, map).off).includes('supply'), 'a second gun upgrade overloads Power Station I');

  // Rig Mk II alone: 9 − 4 + 8 = 13 > 10 — the upgrade goes ahead, flagged
  const rigUp = upgrade(ref, 'r1', ctx());
  assert.ok(!rigUp.error, rigUp.error);
  assert.equal(rigUp.warning, SHORT);
  const rigII = structuredClone(ref); rigII.pads.r1.tier = 2;
  assert.ok(Object.values(powerGrids(rigII, map).off).includes('supply'));

  // a Power Station II restores it: 20 supply carries the rig II and both guns II (9 − 4 + 8 + 2 = 15)
  const fixed = structuredClone(bothII); fixed.pads.r1.tier = 2; fixed.pads.p1.tier = 2;
  assert.deepEqual([main(fixed).draw, main(fixed).supply], [15, 20]);
  assert.deepEqual(powerGrids(fixed, map).off, {});
  // and with the station already upgraded, the rig upgrade carries no warning
  const p2 = structuredClone(ref); p2.pads.p1.tier = 2;
  const ok = upgrade(p2, 'r1', ctx());
  assert.ok(!ok.error && !ok.warning, JSON.stringify(ok.warning || ok.error));
  // upgrading the station itself never warns (it adds supply)
  const st = upgrade(ref, 'p1', ctx());
  assert.ok(!st.error && !st.warning);
  // a pending station upgrade counts: the rig upgrade on top of it is not short once both land
  const both = upgrade(st.outpost, 'r1', ctx());
  assert.ok(!both.error && !both.warning, JSON.stringify(both.warning || both.error));
});

test('a gun upgrade at the Upgrade Bay that shorts the grid is allowed and flagged', () => {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  o.pads.f9 = { kind: 'upgradeBay', tier: 1, at: { x: 23, y: 15, w: 2, h: 2 } };   // beside the station; draws 1: 10 of 10
  assert.deepEqual(powerGrids(o, map).off, {});
  const mg = o.defenses.find((d) => d.kind === 'mg');
  const r = upgradeDefense(o, mg.id, ctx());
  assert.ok(!r.error, r.error);
  assert.equal(r.warning, SHORT, 'mg II takes the grid to 11 of 10');
  assert.equal(r.outpost.upgrading.id, mg.id, 'not refused: the gun is on the bay');
  // no map, no check (a bare call is unchanged)
  assert.equal(upgradeDefense(o, mg.id, ctx({ map: undefined })).warning, undefined);
  // the station at tier II: no warning
  const o2 = structuredClone(o); o2.pads.p1.tier = 2;
  assert.equal(upgradeDefense(o2, mg.id, ctx()).warning, undefined);
});

test('every station at its top tier: the warning asks for another Power Station', () => {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  o.pads.p1.tier = 2;
  o.pads.r2 = { kind: 'rig', tier: 2, deposit: 'uncommon', deep: false };
  o.pads.s1.tier = 2;                                      // 2 + 4 + 8 + 2 + 2 = 18 of 20
  assert.deepEqual(powerGrids(o, map).off, {});
  const r = upgrade(o, 'r1', ctx());                       // + 4 → 22 of 20
  assert.equal(r.warning, 'grid short — build another Power Station');
});

test('the save session passes the warning on: an upgrade that shorts the grid succeeds with { warning }', () => {
  const sv = defaultSave();
  sv.capitalShips = { Verdance: { arrived: true } };
  sv.carry = { gold: 1e6, structures: [] }; sv.goldBank = 1e6;
  acceptOutpostContract(sv, 'ground', { map: forgeMap, now: T0, seedSalt: 'test' });
  const o = referenceOutpost('ground', { seed: sv.outposts.ground.seed, map: forgeMap, now: T0 });
  o.pads.f9 = { kind: 'upgradeBay', tier: 1, at: { x: 36, y: 19, w: 2, h: 2 } };   // beside the station (no pads since S2c.2): 10 of 10
  sv.outposts.ground = o;
  sv.tech = { owned: { supply_depot: true } };
  const v = createSession({ store: memoryStore(sv), planet: 'ground', map: forgeMap, catalog, raidHook: null, flowOpts: { allOpen: true } });
  v.open(T0);
  const s1 = defaultPads(forgeMap).storage;
  const r = v.act({ type: 'upgrade', pad: s1 }, T0);      // Storage Tower II: 1 → 2, 11 of 10
  assert.equal(r.ok, true, r.error);
  assert.equal(r.warning, SHORT);
  assert.ok(r.outpost.building.some((j) => j.pad === s1 && j.tier === 2), 'the upgrade is under way, not refused');
});

test('the live (battle-session) path: the battle U command on a rig, then the save check flags it', () => {
  const o = referenceOutpost('ground', { seed: 7, map: forgeMap, now: T0 });
  // Rig Mk II is owned: the live upgrade asks the outpost's tech gate too [MM-task_mwcunn53_3f]
  const { state, link } = toLiveSim(o, { map: forgeMap, now: T0, gold: 1e6, unlocks: ['rig_mk2'] });
  const rigPad = defaultPads(forgeMap).rig;
  const sid = [...link.ids.entries()].find(([, e]) => e.pad === rigPad)[0];
  const res = applyCommand(state, { type: 'upgrade', id: sid });
  assert.equal(res.ok, true, res.reason);
  const evs = [];
  for (let i = 0; i < 3; i++) evs.push(...(stepSim(state, FIXED_DT) || []));
  assert.ok(evs.some((e) => e.type === 'upgradeStart' && e.structureId === sid), 'the step reports upgradeStart (sessionView afterStep reads it)');
  const back = fromLiveSim(state, link, T0).outpost;
  assert.ok(back.building.some((j) => j.pad === rigPad && j.tier === 2), 'the rig is upgrading in the save shape');
  assert.equal(upgradeGridShort(back, forgeMap), SHORT, 'sessionView flashes this on upgradeStart');
});
