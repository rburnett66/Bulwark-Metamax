// A repair paid for during a visit finishes during the visit (integration of S2.4d + the wreck fix): the save session's
// clock completes the drone's work, and the session view settles it once repairDue says so.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { map, T0 } from './fixtures.mjs';
import { referenceOutpost } from '../model.js';
import { createSession } from './session.js';
import { repairDue } from './sessionView.js';

function storeWith(o) {
  let s = { outposts: { ground: o }, carry: { gold: 20000, structures: [] }, goldBank: 20000 };
  return { load: () => s, update: (fn) => { const r = fn(s); if (r) s = r; return s; }, write: (v) => { s = v; } };
}

test('REPAIR ALL on a wreck during a visit: due by its done time, and a settle at that time stands it at full HP', () => {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  const gun = o.defenses.find((d) => d.kind !== 'wall');
  gun.hp = 0;                                                    // a wreck
  const store = storeWith(o);
  const sess = createSession({ store, planet: 'ground', map, catalog: null });
  sess.open(T0);
  const r = sess.act({ type: 'repairAll' }, T0 + 1000);
  assert.equal(r.ok, true, String(r.error));
  const d = store.load().outposts.ground.defenses.find((x) => x.id === gun.id);
  assert.ok(d.repair, 'a drone is on its way');
  assert.equal(repairDue(store.load().outposts.ground, d.repair.done - 1), false, 'not before its work is done');
  assert.equal(repairDue(store.load().outposts.ground, d.repair.done), true);
  const s = sess.act({ type: 'settle' }, d.repair.done);
  assert.equal(s.ok, true, String(s.error));
  const after = store.load().outposts.ground.defenses.find((x) => x.id === gun.id);
  assert.ok(after.hp > 0, `the wreck stands again (${after.hp} HP)`);
  assert.ok(!after.repair, 'the drone is done');
  assert.equal(repairDue(store.load().outposts.ground, d.repair.done + 1000), false);
});
