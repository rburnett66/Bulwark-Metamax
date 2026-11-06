// The Collective opening's save state [MM-story_mw47lq0l_7]: a new save opens on the intro, ACCEPT marks it seen,
// a reload after ACCEPT resumes at the transport, and existing saves are marked seen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSave, migrate } from './save.js';
import { collectiveOf, needsIntro, resumeBeat, acceptFirstContract, markLaunched, FIRST_CONTRACT } from './collective.js';
import { contractFor } from '../data/collectiveContract.js';

test('a new save needs the intro and resumes from the start', () => {
  const s = migrate(defaultSave());
  assert.equal(needsIntro(s), true);
  assert.equal(resumeBeat(s), 'start');
  assert.deepEqual(collectiveOf(s), { introSeen: false, contractAccepted: false, transport: null, seenBefore: false });
});

test('ACCEPT marks the intro seen and resumes at the transport until launch', () => {
  const s = acceptFirstContract(migrate(defaultSave()));
  assert.equal(needsIntro(s), false);
  assert.equal(collectiveOf(s).transport, 'hauler');
  assert.equal(resumeBeat(s), 'transport', 'a reload between ACCEPT and launch goes to the Loading Bay');
  markLaunched(s);
  assert.equal(resumeBeat(s), null);
  const round = migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(needsIntro(round), false, 'survives a save round trip');
});

test('an existing save that has played is marked seen; an untouched one is not', () => {
  const old = migrate(defaultSave()); delete old.collective; old.progress.battles = 4; old.maps = { 1: { stars: 3 } };
  assert.equal(needsIntro(old), false);
  assert.equal(collectiveOf(old).seenBefore, true);
  assert.equal(resumeBeat(old), null);
  const fresh = migrate(defaultSave()); delete fresh.collective;
  assert.equal(needsIntro(fresh), true);
});

test('the first contract is Verdance map 1, common and uncommon', () => {
  assert.deepEqual(Object.keys(contractFor(FIRST_CONTRACT.planet, FIRST_CONTRACT.mapId)), ['common', 'uncommon']);
});
