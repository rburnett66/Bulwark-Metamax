// Owner 2026-11-17 [MM-story_mwlcdc2p_7]: "A player should also be able to select a building or plot and rearrange
// their base." The battle's move command on a live outpost (sim/structures.js moveStructure), saved back by
// liveSim.fromLiveSim; plots and farm buildings through farm/model.js moveFarmThing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { map, T0 } from './view/fixtures.mjs';
import { referenceOutpost, buildingRect } from './model.js';
import { toLiveSim, fromLiveSim } from './liveSim.js';
import { applyCommand } from '../sim/core.js';
import { moveRefusal, moveBlocked, validatePlacement } from '../sim/structures.js';
import { getStructureDef } from '../data/tables.js';
import { createSim } from '../sim/core.js';
import { lockRule } from '../battle/catalogue.js';
import { moveFarmThing, liftedFarm } from '../farm/model.js';
import { farmRefusal } from '../farm/farmRail.js';
import { farmStructId } from '../data/farmStructures.js';

const live = (o = referenceOutpost('ground', { seed: 7, map, now: T0 })) => ({ o, ...toLiveSim(o, { map, now: T0, gold: 0 }) });
const kindOf = (s) => getStructureDef(s.structId).outpostKind;
const byKind = (state, k) => [...state.structures.values()].find((s) => kindOf(s) === k);
/** The first cell, scanning out from the structure, its move is allowed to (rows then columns). */
function spotFor(state, s, ok = () => true) {
  for (let r = 1; r < 30; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const c = { x: s.pos.x + dx, y: s.pos.y + dy };
    if (Math.max(Math.abs(dx), Math.abs(dy)) === r && ok(c) && !moveRefusal(state, s.id, c)) return c;
  }
  return null;
}

test('a defense is never moved: it is sold and bought again (owner 2026-11-17)', () => {
  const { state } = live();
  for (const gun of [...state.structures.values()].filter((s) => ['mg', 'cannon', 'wall'].includes(kindOf(s)))) {
    const was = { ...gun.pos };
    let open = null;   // open ground a new one could stand on
    for (let r = 2; r < 20 && !open; r++) for (let dx = -r; dx <= r && !open; dx++) { const c = { x: gun.pos.x + dx, y: gun.pos.y + r }; if (validatePlacement(state, gun.structId, c, { move: true, exclude: gun.id, free: true }).ok) open = c; }
    assert.ok(open);
    assert.equal(moveRefusal(state, gun.id, open), 'a defense is sold and bought again, not moved');
    assert.equal(applyCommand(state, { type: 'move', id: gun.id, cell: open }).ok, false);
    assert.deepEqual(gun.pos, was);
  }
});

test('a building moves for free; the save has it there, with its own rectangle; the next visit loads it there', () => {
  const { o, state, link } = live();
  const st = byKind(state, 'storage');
  const pad = [...link.ids].find(([sid]) => sid === st.id)[1].pad;
  const to = spotFor(state, st);
  assert.deepEqual(applyCommand(state, { type: 'move', id: st.id, cell: to }), { ok: true, reason: '' });
  assert.equal(state.economy.money, 0, 'free: the sim has no gold and the move still went');
  assert.ok(state.log.commands.some((c) => c.cmd.type === 'move'), 'a replayable battle command');
  const back = fromLiveSim(state, link, T0).outpost;
  assert.deepEqual(buildingRect(back, map, pad), { id: pad, x: to.x, y: to.y, w: st.footprint.w, h: st.footprint.h });
  assert.equal(back.pads[pad].kind, 'storage');
  assert.deepEqual(back.pads[pad].at, { x: to.x, y: to.y, w: st.footprint.w, h: st.footprint.h });
  const again = toLiveSim(back, { map, now: T0, gold: 0 }).state;
  assert.deepEqual(byKind(again, 'storage').pos, to, 'loaded where it was moved');
  assert.notDeepEqual(buildingRect(o, map, pad), buildingRect(back, map, pad));
});

test('the move is the placement rule: the same refusals, its own spot free, no gold, never in a raid', () => {
  const { state } = live();
  const st = byKind(state, 'storage'), rig = byKind(state, 'rig'), power = byKind(state, 'power');
  assert.equal(moveRefusal(state, st.id, power.pos), 'occupied');
  assert.equal(moveRefusal(state, st.id, st.pos), 'it is already there');
  // one cell over overlaps its own old footprint: that ground is free for it, not 'occupied' by itself
  const own = moveRefusal(state, st.id, { x: st.pos.x + 1, y: st.pos.y });
  assert.notEqual(own, 'occupied');
  assert.equal(validatePlacement(state, st.structId, { x: st.pos.x + 1, y: st.pos.y }).reason, 'occupied', 'a NEW building there would overlap');
  // a rig stays on a deposit
  const open = spotFor(state, st, (c) => validatePlacement(state, st.structId, c, { free: true }).ok);   // open ground for anyone
  assert.equal(moveRefusal(state, rig.id, open), 'needs a deposit');
  state.waves.active = true;
  assert.equal(moveBlocked(state, st.id), 'not during a raid');
  assert.equal(applyCommand(state, { type: 'move', id: st.id, cell: spotFor({ ...state, waves: { active: false } }, st) || st.pos }).reason, 'not during a raid');
});

test('a battle never moves a tower (the mode opts in)', () => {
  const s = createSim(1, {});
  assert.equal(s.allowMove, undefined);
  assert.equal(moveBlocked(s, 1), 'nothing moves here');
  assert.equal(applyCommand(s, { type: 'move', id: 1, cell: { x: 3, y: 3 } }).ok, false);
});

test('a rail lock is about buying one: moving a built one is not refused by it', () => {
  const rule = lockRule({ isLocked: () => 'locked: gun cap' });
  assert.equal(rule({}, {}, { x: 0, y: 0 }, 'OUT-mg'), 'locked: gun cap');
  assert.equal(rule({ isMove: true }, {}, { x: 0, y: 0 }, 'OUT-mg'), null);
});

test('a plot moves with its crop; the farm checks its new ground without it; a farm building moves too', () => {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  o.farm = { next: 3, buildings: { f2: { kind: 'silo', x: 30, y: 30, w: 2, h: 2, tier: 1, done: T0 } },
    plots: { p1: { id: 'p1', x: 20, y: 30, w: 2, h: 2, method: 'traditional', crop: 'loam-grain', level: 2, progress: 0.4, plantedAt: T0, prepDone: T0, ripeAt: null, cycle: 1, yieldShare: 1 } } };
  const ctx = { map };
  const r = moveFarmThing(o, { plot: 'p1' }, [21, 30], ctx);   // overlaps its own old spot: fine
  assert.ok(r.outpost, r.error);
  const p = r.outpost.farm.plots.p1;
  assert.deepEqual([p.x, p.y, p.crop, p.level, p.progress], [21, 30, 'loam-grain', 2, 0.4], 'the crop, its level and growth come along');
  assert.equal(o.farm.plots.p1.x, 20, 'the outpost handed in is not changed');
  assert.match(moveFarmThing(o, { plot: 'p1' }, [30, 30], ctx).error, /taken|walkway/, 'not onto the Silo');
  assert.match(moveFarmThing(o, { plot: 'p1' }, [20, 30], ctx).error, /already there/);
  assert.match(moveFarmThing(o, { plot: 'p1' }, [21, 30], { ...ctx, raid: true }).error, /raid/);
  assert.ok(moveFarmThing(o, { farm: 'f2' }, [34, 30], ctx).outpost.farm.buildings.f2.x === 34);
  assert.deepEqual(Object.keys(liftedFarm(o, { plot: 'p1' }).farm.plots), []);
  // the shared ghost's farm rule: a plot's own ground is not in its way while it is carried
  const def = getStructureDef(farmStructId('traditional'));
  assert.ok(farmRefusal(o, map, def, { x: 21, y: 30 }), 'a new plot there would crowd p1');
  assert.equal(farmRefusal(o, map, def, { x: 21, y: 30 }, { moving: { plot: 'p1' } }), null);
});

test('the MOVE buttons: the outpost panel (not the hub) and the farm panels arm the battle placement', () => {
  const view = readFileSync(new URL('./view/sessionView.js', import.meta.url), 'utf8');
  assert.match(view, /if \(move && e\.pad && m\.kind !== 'hub'\)/, 'the hub stays put; a defense has no MOVE');
  assert.match(view, /inp\.startMove\(move\)/);
  assert.match(view, /if \(cmd && cmd\.type === 'farmMove'\) return moveFarmItem\(cmd\);/);
  const input = readFileSync(new URL('../input/input.js', import.meta.url), 'utf8');
  assert.match(input, /type: 'move', id: move\.structureId/);
  assert.match(input, /validatePlacement\(state, ui\.buildSelection, ui\.hoverCell, moveOpts\(ui\)\)/, 'the ghost shows the move\'s answer');
});

// Owner 2026-11-17 [MM-task_mwlcxrsv_9]: "Add a confirm for selling structures, there is confusion between selling
// resources which should be 1 click and removing the structure which will have an extra step."
test('selling a structure at the outpost asks twice; a battle and SELL RESOURCES stay one tap', async () => {
  const { sellGate, sellArmed, SELL_CONFIRM_MS } = await import('../input/input.js');
  const battle = {};
  assert.equal(sellGate(battle, 4, 0), true, 'a battle sells at once');
  const ui = { confirmSell: true };
  assert.equal(sellGate(ui, 4, 1000), false, 'the first SELL only arms');
  assert.equal(sellArmed(ui, 4, 1500), true, 'the button reads Confirm sell');
  assert.equal(sellGate(ui, 4, 1500), true, 'the second sells');
  assert.equal(sellArmed(ui, 4, 1600), false);
  assert.equal(sellGate(ui, 4, 2000), false);
  assert.equal(sellGate(ui, 5, 2100), false, 'another structure starts its own confirm');
  assert.equal(sellGate(ui, 5, 2100 + SELL_CONFIRM_MS + 1), false, 'a stale confirm runs out');
  const view = readFileSync(new URL('./view/sessionView.js', import.meta.url), 'utf8');
  assert.match(view, /ui\.confirmSell = true;/);
  const session = readFileSync(new URL('../battle/session.js', import.meta.url), 'utf8');
  assert.match(session, /if \(!sellGate\(getUi\(\), id, uiNow\(\)\)\)/, 'the panel button');
  const input = readFileSync(new URL('../input/input.js', import.meta.url), 'utf8');
  assert.match(input, /!sellGate\(ui, ui\.selectedStructureId, uiNow\(\)\)/, 'the X key');
  assert.doesNotMatch(view.split('function outpostSelectionExtras')[1].split('return { lines, actions };')[0], /sellGate/, 'SELL RESOURCES: one tap');
});
