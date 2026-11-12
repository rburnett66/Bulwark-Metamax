// The outpost's AAA header and card (spec docs/16 Bulwark MM/design/Outpost-AAA-UX.md §1, §2; D2 D3 D4 D10)
// [MM-story_mwcuyrqr_3j]. Owner 2026-11-12: "we still need a AAA quality design for the resource gathering and outpost
// header. This info panel looks very placeholder." The card and the top bar are DATA for the battle HUD's shared pieces
// (render/hudCard.js, hud.setReadouts) — these tests pin the numbers on a reference outpost.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { map, T0, HOUR } from './fixtures.mjs';
import { referenceOutpost, advance, rigExtraction } from '../model.js';
import { toLiveSim } from '../liveSim.js';
import { gatheringRows, outpostCardModel, outpostReadouts, farmCardModel, harvesterCounts, fmtPerHour, threatInfo } from './outpostCard.js';
import { hudCardHtml, hudCardModel } from '../../render/hudCard.js';
import { hudModel } from './hudModel.js';
import { oresOf } from '../../data/ores.js';

const ref = () => referenceOutpost('ground', { seed: 7, map, now: T0 });

test('GATHERING: each ore with a Mining Station — its stored units, its rate an hour from the model\'s own extraction rule, a bay bar', () => {
  const o = ref();
  const rows = gatheringRows(o, map, 'ground');
  const ores = rows.filter((r) => r.kind === 'ore');
  assert.ok(ores.length >= 1, 'the reference outpost mines');
  const ore = oresOf('ground').find((x) => x.id === ores[0].id);
  assert.equal(ores[0].name, ore.name);
  assert.equal(ores[0].colour, ore.colour);
  // the rate is rigExtraction's (what liveSim.stepLiveOutpost mines by), per hour
  const perMs = rigExtraction(o, map, 1).filter((r) => r.item.startsWith(ore.id)).reduce((a, r) => a + r.rate, 0);
  assert.ok(Math.abs(ores[0].perHour - perMs * HOUR) < 1e-6);
  assert.ok(ores[0].perHour > 0, 'a powered rig mines offline too (model.runningRigs)');
  // an hour later the stored units are what the model mined, and the bar is the bay's fill
  const later = advance(o, T0 + HOUR, { map }).outpost || o;
  const r1 = gatheringRows(later, map, 'ground').find((r) => r.id === ore.id);
  const stored = hudModel(later, map).ores.find((x) => x.id === ore.id);
  assert.equal(r1.units, stored ? stored.units : 0);
  assert.ok(r1.pct >= 0 && r1.pct <= 1);
});

test('the card: title + status, GATHERING rows, the stores gauges, then GO ONLINE · S SELL (and R REPAIR ALL when worn)', () => {
  const o = ref();
  const acted = [];
  const m = outpostCardModel(o, map, { planet: 'ground', gold: 5000, now: T0, issues: [], act: (a) => acted.push(a) });
  assert.equal(m.title, 'Outpost');
  assert.deepEqual(m.status, { text: 'Offline', tone: 'warn' }, 'the reference outpost starts offline');
  const [gather, stores] = m.sections;
  assert.equal(gather.head, 'Gathering');
  assert.equal(gather.items.length, gatheringRows(o, map, 'ground').length);
  for (const it of gather.items) assert.match(it.rate, /^(\+[\d.]+\/h|FULL|OFF|—)$/);
  assert.equal(stores.gauges[0].label, 'Storage');
  assert.deepEqual(m.actions.map((a) => [a.key || '', a.label]), [['', 'Go online'], ['S', 'Sell']]);
  assert.equal(m.actions[0].primary, true);
  assert.equal(m.actions[1].enabled, false, 'offline: nothing to sell');
  m.actions[0].run();
  assert.deepEqual(acted, [{ type: 'online' }], 'the action runs the save session\'s rule');
  // online with worn defenses: no GO ONLINE; REPAIR ALL with its price on R
  const on = { ...o, online: true };
  const m2 = outpostCardModel(on, map, { planet: 'ground', gold: 100, now: T0, repairCost: 450, act: (a) => acted.push(a) });
  assert.equal(m2.status.text, 'Online');
  assert.deepEqual(m2.actions.map((a) => a.key), ['S', 'R']);
  assert.equal(m2.actions[1].sub, '450g');
  assert.equal(m2.actions[1].enabled, false, 'not enough gold');
  // the card says nothing about pods or the Pod Reward Chest (owner rule)
  assert.doesNotMatch(hudCardHtml(m2), /pod|chest/i);
});

test('harvesters on the card: working vs waiting, from the live visit (sim/harvest.js harvesterHold)', () => {
  assert.deepEqual(harvesterCounts(null), { total: 0, working: 0, waiting: 0, why: null });
  const o = { ...ref(), harvesters: 2 };
  const { state } = toLiveSim(o, { map, now: T0, gold: 0 });
  const c = harvesterCounts(state);
  assert.equal(c.total, c.working + c.waiting);
  const m = outpostCardModel(o, map, { planet: 'ground', now: T0, live: state });
  if (c.total) assert.ok(m.sections[0].rows.some((r) => r[0] === 'Harvesters'));
});

test('top bar readouts: status, ⚡ power used/supply (amber ≥ 90 %, red over), ▣ storage with a bar, ☠ threat with a tap', () => {
  const o = ref();
  let tapped = 0;
  const r = outpostReadouts(o, map, { now: T0, onThreat: () => tapped++ });
  assert.deepEqual(r.map((x) => x.id), ['op-status', 'op-power', 'op-store', 'op-threat']);
  assert.equal(r[0].text, 'OFFLINE');
  const h = hudModel(o, map, { now: T0 });
  assert.equal(r[1].text, `${h.power.draw}/${h.power.supply}`);
  assert.ok(r[2].bar >= 0 && r[2].bar <= 1);
  r[3].onTap();
  assert.equal(tapped, 1);
  assert.match(threatInfo(o, map, T0), /Threat: size \d+/);
  // online with the next visit raid timed: the clock; during a raid the status chip steps aside for "⚔ n left"
  const on = { ...o, online: true };
  assert.equal(outpostReadouts(on, map, { now: T0, raidIn: 72 })[0].text, 'RAID 1:12');
  assert.equal(outpostReadouts(on, map, { now: T0, raidIn: 72, raid: true })[0].hidden, true);
  // power tone: the readout's rule on the outpost's own grid (amber from 90 %, red when short)
  const pf = h.power.supply > 0 ? h.power.draw / h.power.supply : 0;
  assert.equal(r[1].tone, h.power.short || pf > 1 ? 'bad' : pf >= 0.9 ? 'warn' : null);
});

test('a selected plot\'s panel is the same HudCard: its stats, warnings and actions, plus CLOSE', () => {
  const ran = [];
  let closed = 0;
  const m = farmCardModel({ title: 'Plot 3', status: 'Growing', tone: 'ok', stats: [['Crop', 'Wheat'], ['Growth', '64 %']], warnings: [{ text: 'Silo full' }], note: 'Harvest when fruited',
    actions: [{ act: 'harvest', arg: 'p3', label: 'HARVEST', enabled: false, why: 'not ripe' }] }, { run: (a, b) => ran.push([a, b]), close: () => closed++ });
  const n = hudCardModel(m);
  assert.equal(n.title, 'Plot 3');
  assert.deepEqual(n.status, { text: 'Growing', tone: 'ok' });
  assert.deepEqual(n.sections[0].rows, [['Crop', 'Wheat'], ['Growth', '64 %']]);
  assert.deepEqual(n.sections[1].lines.map((l) => l.tone), ['warn', 'dim']);
  assert.deepEqual(n.actions.map((a) => a.label), ['HARVEST', 'Close']);
  n.actions[0].run(); n.actions[1].run();
  assert.deepEqual(ran, [['harvest', 'p3']]);
  assert.equal(closed, 1);
});

test('fmtPerHour', () => {
  assert.equal(fmtPerHour(0), '');
  assert.equal(fmtPerHour(0.44), '+0.4/h');
  assert.equal(fmtPerHour(12.4), '+12/h');
});
