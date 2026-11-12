// The live sim's upgrade of an outpost structure asks the outpost's own rule [MM-task_mwcunn53_3f]: model.upgradeRefusal
// is the one rule — model.upgrade / upgradeDefense and the battle's upgrade command (sim/structures.js
// state.upgradeRules, installed by liveSim.toLiveSim) answer alike. Battles set no rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { map, T0, freeSpot } from './view/fixtures.mjs';
import { referenceOutpost, upgrade, upgradeDefense, upgradeRefusal, upgradeBayReady, defaultPads } from './model.js';
import { toLiveSim } from './liveSim.js';
import { applyCommand, createSim } from '../sim/core.js';
import { upgradeRuleRefusal } from '../sim/structures.js';

const base = () => referenceOutpost('ground', { seed: 1234, map, now: T0 });
/** the reference outpost with a finished Upgrade Bay beside its Power Station (powered), or far from it (unpowered) */
function withBay(powered = true) {
  const o = base();
  const p1 = o.pads[defaultPads(map).power].at;
  const near = powered ? { x: p1.x, y: p1.y } : { x: 2, y: 2 };
  o.pads.f1 = { kind: 'upgradeBay', tier: 1, at: freeSpot(o, 'upgradeBay', { near }) };
  return o;
}
/** the sim structure id of a pad's building or a defense in a live state */
function simIdOf(link, target) {
  for (const [sid, e] of link.ids) if (target.pad ? e.pad === target.pad : e.defense === target.defense) return sid;
  throw new Error('no sim structure for ' + JSON.stringify(target));
}
/** the model's answer and the live sim's answer for one upgrade: null (allowed) or the refusal reason */
function answers(o, target, owned) {
  const ctx = { map, now: T0, unlocks: owned.unlocks || [], techOwned: owned.techOwned || [] };
  const r = target.pad ? upgrade(o, target.pad, ctx) : upgradeDefense(o, target.defense, ctx);
  const model = r.error || null;
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 1e9, ...owned });
  const res = applyCommand(state, { type: 'upgrade', id: simIdOf(link, target) });
  return { model, live: res.ok ? null : res.reason, rule: upgradeRefusal(o, target, ctx) };
}

test('the bug: the live sim no longer takes the Power Station to tier II without power_grid_2', () => {
  const o = base(), pad = defaultPads(map).power;
  const locked = toLiveSim(o, { map, now: T0, gold: 1e9 });
  const sid = simIdOf(locked.link, { pad });
  const before = locked.state.economy.money;
  const r = applyCommand(locked.state, { type: 'upgrade', id: sid });
  assert.equal(r.ok, false);
  assert.match(r.reason, /power tier 2 is not unlocked \(tech:power_grid_2\)/);
  assert.equal(locked.state.structures.get(sid).lifecycle, 'Complete', 'nothing started');
  assert.equal(locked.state.economy.money, before, 'nothing paid');
  assert.match(upgradeRuleRefusal(locked.state, locked.state.structures.get(sid)), /not unlocked/, 'the HUD reads the same answer');

  const open = toLiveSim(o, { map, now: T0, gold: 1e9, unlocks: new Set(['power_grid_2']) });
  const ok = applyCommand(open.state, { type: 'upgrade', id: simIdOf(open.link, { pad }) });
  assert.equal(ok.ok, true);
  assert.equal(open.state.structures.get(simIdOf(open.link, { pad })).lifecycle, 'Upgrading');
});

test('model.upgrade / upgradeDefense and the live upgrade command agree (one rule)', () => {
  const pads = defaultPads(map);
  assert.ok(upgradeBayReady(withBay(true), map), 'fixture: the bay beside the station is powered');
  assert.equal(upgradeBayReady(withBay(false), map), null, 'fixture: the far bay has no power');
  const mg = (o) => o.defenses.find((d) => d.kind === 'mg').id;
  const cannon = (o) => o.defenses.find((d) => d.kind === 'cannon').id;
  const wall = (o) => o.defenses.find((d) => d.kind === 'wall').id;
  const cases = [
    ['power, no tech', base, (o) => ({ pad: pads.power }), {}, /power_grid_2/],
    ['power, power_grid_2', base, (o) => ({ pad: pads.power }), { unlocks: ['power_grid_2'] }, null],
    ['rig, no tech', base, (o) => ({ pad: pads.rig }), {}, /rig_mk2/],
    ['rig, rig_mk2', base, (o) => ({ pad: pads.rig }), { unlocks: ['rig_mk2'] }, null],
    ['storage, no tech', base, (o) => ({ pad: pads.storage }), {}, /supply_depot/],
    ['storage, supply_depot', base, (o) => ({ pad: pads.storage }), { unlocks: ['supply_depot'] }, null],
    ['mg, no Upgrade Bay', base, (o) => ({ defense: mg(o) }), { techOwned: ['mg2'] }, /build the Upgrade Bay first/],
    ['mg, bay without power', () => withBay(false), (o) => ({ defense: mg(o) }), { techOwned: ['mg2'] }, /no power/],
    ['mg, bay, no mg2', () => withBay(true), (o) => ({ defense: mg(o) }), {}, /Machine Gun T2/],
    ['mg, bay, mg2', () => withBay(true), (o) => ({ defense: mg(o) }), { techOwned: ['mg2'] }, null],
    ['cannon, bay, no cannon2', () => withBay(true), (o) => ({ defense: cannon(o) }), { techOwned: ['mg2'] }, /Cannon T2/],
    ['cannon, bay, cannon2', () => withBay(true), (o) => ({ defense: cannon(o) }), { techOwned: ['cannon2'] }, null],
    ['wall, bay, no Reinforced Walls', () => withBay(true), (o) => ({ defense: wall(o) }), {}, /Reinforced Walls/],
    ['wall, bay, reinforced_walls', () => withBay(true), (o) => ({ defense: wall(o) }), { unlocks: ['reinforced_walls'] }, null],
  ];
  for (const [name, make, targetOf, owned, want] of cases) {
    const o = make();
    const a = answers(o, targetOf(o), owned);
    if (want) assert.match(a.model || '', want, `${name}: the model refuses`);
    else assert.equal(a.model, null, `${name}: the model allows`);
    assert.equal(a.live, a.model, `${name}: the live sim answers as the model`);
    assert.equal(a.rule, a.model, `${name}: upgradeRefusal is the model's answer`);
  }
});

test('a battle sets no upgrade rule (its upgrade path is unchanged)', () => {
  const s = createSim(1);
  assert.equal(s.upgradeRules, undefined);
  assert.equal(upgradeRuleRefusal(s, { structId: 'x' }), null);
});
