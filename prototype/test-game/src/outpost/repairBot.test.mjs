// Owner 2026-11-13 [MM-story_mwf7z51a_3]: "Repairs on the outpost should work like they do in tower defense, small bot
// roams form base to toweer to do repairs". The outpost's live sim repairs with the battle's repair bot: it walks from the
// base, welds the defense (a wreck too) to full, and the outpost's price is paid as it leaves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { map, T0 } from './view/fixtures.mjs';
import { referenceOutpost, repairCost } from './model.js';
import { toLiveSim, fromLiveSim, repairPriceOf } from './liveSim.js';
import { applyCommand, stepSim } from '../sim/core.js';

const DT = 1 / 30;
function visit(wear) {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  const guns = o.defenses.filter((d) => d.kind !== 'wall');
  wear(guns, o);
  const live = toLiveSim(o, { map, now: T0, gold: 5000 });
  const sid = (defId) => [...live.link.ids].find(([, e]) => e.defense === defId)[0];
  return { o, guns, live, sim: live.state, sid };
}
const bots = (sim) => [...sim.units.values()].filter((u) => u.isRepairTroop);

test('a worn defense: the bot leaves the base, the outpost price is paid, and it welds the defense to full', () => {
  const { o, guns, sim, sid } = visit((g) => { g[0].hp = Math.round(g[0].hp * 0.5); });
  const id = sid(guns[0].id), s = sim.structures.get(id);
  const price = repairCost(o, guns[0].id);
  assert.ok(price > 0);
  assert.equal(repairPriceOf(s), price, 'the live price is the save model\'s repairCost');
  const r = applyCommand(sim, { type: 'repair', id });
  assert.ok(r.ok, r.reason);
  assert.equal(sim.economy.money, 5000 - price, 'paid as the bot leaves');
  const [bot] = bots(sim);
  assert.ok(bot, 'a repair bot');
  assert.deepEqual([bot.pos.x, bot.pos.y], [sim.map.base.x, sim.map.base.y], 'it starts at the base');
  assert.equal(applyCommand(sim, { type: 'repair', id }).ok, false, 'one bot per defense');
  for (let i = 0; i < 30 * 120 && s.hp < s.maxHp; i++) stepSim(sim, DT);
  assert.equal(s.hp, s.maxHp, 'repaired to full');
  assert.equal(bots(sim).length, 0, 'the bot is done');
});

test('a wreck is rebuilt by the bot and fights again', () => {
  const { guns, sim, sid } = visit((g) => { g[0].hp = 0; });
  const s = sim.structures.get(sid(guns[0].id));
  assert.equal(s.lifecycle, 'Wrecked');
  assert.ok(applyCommand(sim, { type: 'repair', id: s.id }).ok);
  for (let i = 0; i < 30 * 200 && s.lifecycle === 'Wrecked'; i++) stepSim(sim, DT);
  assert.equal(s.lifecycle, 'Complete');
  assert.equal(s.hp, s.maxHp);
});

test('no gold: refused as a build is ("cost"), no bot', () => {
  const { guns, sim, sid } = visit((g) => { g[0].hp = 1; });
  sim.economy.money = 0;
  const r = applyCommand(sim, { type: 'repair', id: sid(guns[0].id) });
  assert.deepEqual([r.ok, r.reason], [false, 'cost']);
  assert.equal(bots(sim).length, 0);
});

test('LEAVE mid-repair: the save carries the paid repair, and the next visit walks the bot out again for free', () => {
  const { guns, sim, sid, live } = visit((g) => { g[0].hp = 0; });
  assert.ok(applyCommand(sim, { type: 'repair', id: sid(guns[0].id) }).ok);
  for (let i = 0; i < 30; i++) stepSim(sim, DT);
  const now = T0 + 1000;
  const saved = fromLiveSim(sim, live.link, now).outpost;
  const d = saved.defenses.find((x) => x.id === guns[0].id);
  assert.ok(d.repair && d.repair.done > now, 'the repair rides in the save');
  const again = toLiveSim(saved, { map, now, gold: 0 });
  assert.equal(bots(again.state).length, 1, 'walked out again');
  assert.equal(again.state.economy.money, 0, 'not paid twice');
});

test('a battle\'s repairs stay free (no repairPrice), and the outpost card sends bots, not save drones', () => {
  const src = readFileSync(new URL('../sim/structures.js', import.meta.url), 'utf8');
  assert.match(src, /typeof state\.repairPrice === 'function'/);
  const view = readFileSync(new URL('./view/sessionView.js', import.meta.url), 'utf8');
  assert.match(view, /action\.type === 'repairAll'\) return repairAllLive\(\)/);
});
