// The optional rare contract's data and rules [MM-task_mw5h8fxu_d]. Design: Rare-Contracts-Design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPDATA } from '../../content/maps/mapdata.js';
import { PLANETS } from './planets.js';
import { RARE_OFFER, rareContractFor, rareOfferEarned, pickBuyer, settleRareContract } from './rareContract.js';

test('every planet × map has a rare contract within what its board seeds', () => {
  assert.equal(MAPDATA.rareContracts.length, 81);
  for (const key of Object.keys(PLANETS)) for (let m = 1; m <= 9; m++) {
    const c = rareContractFor(key, m), row = MAPDATA.rareContracts.find((r) => r.Planet_Key === key && r.Map_ID === m);
    assert.ok(c && c.quota > 0 && c.pricePerUnit > 0 && c.loyalty > 0, `${key} map ${m}`);
    assert.ok(c.quota <= row.Rare_Seeded, `${key} map ${m}: quota within the board`);
    assert.deepEqual(rareContractFor(PLANETS[key].name, m), c, 'by planet name too');
  }
  assert.equal(rareContractFor('nowhere', 1), null);
});

test('the offer is earned only by 3★ or better on wave 3, once per run', () => {
  assert.deepEqual(RARE_OFFER, { wave: 3, minStars: 3 });
  assert.equal(rareOfferEarned({ clearedWave: 3, waveStars: 3 }), true);
  assert.equal(rareOfferEarned({ clearedWave: 3, waveStars: 5 }), true);
  assert.equal(rareOfferEarned({ clearedWave: 3, waveStars: 2 }), false, 'needs 3★');
  assert.equal(rareOfferEarned({ clearedWave: 2, waveStars: 5 }), false, 'only after wave 3');
  assert.equal(rareOfferEarned({ clearedWave: 3, waveStars: 4, alreadyOffered: true }), false, 'a decline is re-earned next run');
});

test('the buyer is a faction whose ship has arrived, never the planet fought on, stable for a seed', () => {
  assert.equal(pickBuyer([], 'ground'), null);
  assert.equal(pickBuyer(['ground'], 'ground'), null);
  const b = pickBuyer(['air', 'ground', 'water'], 'ground', 5);
  assert.ok(['air', 'water'].includes(b));
  assert.equal(pickBuyer(['water', 'ground', 'air'], 'ground', 5), b, 'order-independent');
});

test('it resolves at map end: sold up to the quota at the price', () => {
  const c = { quota: 40, pricePerUnit: 21, loyalty: 10 };
  assert.deepEqual(settleRareContract(c, 25), { sold: 25, gold: 525, loyalty: 10 });
  assert.deepEqual(settleRareContract(c, 90), { sold: 40, gold: 840, loyalty: 10 });
  assert.deepEqual(settleRareContract(c, 0), { sold: 0, gold: 0, loyalty: 0 });
  assert.deepEqual(settleRareContract(null, 30), { sold: 0, gold: 0, loyalty: 0 });
});
