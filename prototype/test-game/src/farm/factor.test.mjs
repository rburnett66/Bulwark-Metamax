// [MM-story_mwcuzyf7_3k] The farming contract is offered in person by the planet faction's Factor at the Trade Station.
// Owner 2026-11-11: "it should come directly from the faction for the planet I unlock, and it should be a nice character
// in the room on the capital ship tied to resource trade."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultSave } from '../save/save.js';
import { syncMissions, flowCtx } from '../save/missionFlow.js';
import { referenceOutpost } from '../outpost/model.js';
import { DRAFT_LAYOUT as map } from '../outpost/draftLayout.js';
import { FARM_CONTRACTS } from '../data/farm.js';
import { NEUTRAL_ROOMS } from '../ship-interior/shipRooms.js';
import { declineFarmContract, hasFarm, farmCard, farmMissionId } from './contract.js';
import { FACTOR_ROOM, FACTOR_ALIGN, factorOf, factorDesk, factorFlag, factorLines, factorCard, noteFactorTalk, acceptViaFactor } from './factor.js';
import { actionsHtml } from '../menu/missionView.js';
import '../data/factions.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const CATALOG = read('../../content/missions/missions.json');
const PACKS = read('../../content/dialog/voicepacks.json');
const REVEALS = read('../../content/reveals/reveals.json');
const ROSTER = read('../data/roster-guard.snapshot.json');
const FARM_LINES = REVEALS.factionShip.farm;
const REG = globalThis.BulwarkFactions;
const T0 = Date.UTC(2026, 10, 11, 9, 0, 0);

/** A save with the Verdance outpost (reference kit), its ship in orbit; stage 2: Verdance finished (9/9 maps beaten,
 *  farming open, owner 2026-11-12), stage 1: 8/9 beaten (shut) — with a Rig Mk II either way: the rig no longer gates. */
function verdance(stage = 2) {
  const s = defaultSave();
  s.carry = { gold: 50_000, structures: [] }; s.goldBank = 50_000;
  s.capitalShips = { Verdance: { arrived: true } };
  s.planetMaps = { Verdance: Object.fromEntries(Array.from({ length: stage >= 2 ? 9 : 8 }, (_, i) => [i + 1, { beaten: true }])) };
  const o = referenceOutpost('ground', { seed: 5, map, now: T0 });
  for (const b of Object.values(o.pads)) if (b.kind === 'rig') b.tier = 2;
  s.outposts = { ground: o };
  s.outpostContracts = { ground: { step: 3, state: 'complete', since: T0 } };
  return s;
}

test('every faction ship\'s Factor is one of its own nine characters: the Neutral one, never the captain', () => {
  assert.equal(FACTOR_ROOM, 'trade');
  assert.ok(NEUTRAL_ROOMS.includes(FACTOR_ROOM), 'the Trade Station is on every ship');
  for (const f of REG.COMBAT_FACTIONS) {
    const fac = factorOf(PACKS, f.key);
    assert.ok(fac, `${f.key} has a Factor`);
    assert.ok(ROSTER.characters[f.key].includes(fac.name), `${fac.name} is in the pinned roster (no character invented)`);
    assert.equal(PACKS.factions[f.key].characters.filter((c) => c.align === FACTOR_ALIGN).length, 1, `${f.key}: exactly one Neutral`);
    const captains = Object.values(CATALOG.capitalShips).map((c) => c.captain);
    assert.ok(!captains.includes(fac.name), `${fac.name} is not a ship's captain`);
  }
  assert.equal(factorOf(PACKS, 'ground').name, 'Quartermaster Ines Roth', 'Verdance: the quartermaster who keeps the ledger');
  assert.equal(factorOf(PACKS, 'collective'), null);
  assert.equal(factorOf(null, 'ground'), null);
});

test('F1 is given by the planet\'s Factor (the catalog giver), and every farming contract has the Factor\'s lines', () => {
  for (const c of FARM_CONTRACTS) {
    const def = CATALOG.missions.find((m) => m.id === farmMissionId(c.planetKey, Number(c.code.slice(1))));
    assert.equal(def.giver.name, factorOf(PACKS, c.planetKey).name, `${def.id} giver`);
    assert.equal(def.giver.align, FACTOR_ALIGN);
    for (const st of ['gate', 'offer', 'farm']) assert.ok(factorLines(FARM_LINES, c.planetKey, st).length, `${c.planetKey} ${st} lines`);
    for (const after of ['accept', 'later']) assert.ok(factorLines(FARM_LINES, c.planetKey, 'offer', after).length, `${c.planetKey} ${after} reply`);
  }
  // the gate is discoverable: before the rig is Mk II the Factor says what to bring
  assert.match(factorLines(FARM_LINES, 'ground', 'gate').map((l) => l.line).join(' '), /Finish the fight for Verdance/);
  assert.deepEqual(factorLines(FARM_LINES, 'air', 'offer'), [], 'no farming contract on Florael yet: nothing to say');
});

test('the Trade Station\'s offer flag: gate → offer (flagged) → farm', () => {
  assert.equal(factorDesk(defaultSave(), 'ground'), 'gate', 'no outpost: the Factor says what is needed');
  assert.equal(factorDesk(verdance(1), 'ground'), 'gate');
  assert.equal(factorFlag(verdance(1), 'ground'), false, 'no flag before Verdance is finished');
  const s = verdance(2);
  assert.equal(factorDesk(s, 'ground'), 'offer');
  assert.equal(factorFlag(s, 'ground'), true, 'F1 on offer: the room flags the Factor');
  const away = verdance(2); away.capitalShips = {};
  assert.equal(factorFlag(away, 'ground'), false, 'the ship is not in orbit');
  declineFarmContract(s, 'ground', { now: T0 });
  assert.equal(factorFlag(s, 'ground'), true, 'LATER: the offer stays on the Factor\'s desk');
  assert.ok(!acceptViaFactor(s, 'ground', factorOf(PACKS, 'ground'), { map, now: T0 }).error);
  assert.equal(factorDesk(s, 'ground'), 'farm');
  assert.equal(factorFlag(s, 'ground'), false, 'taken: the flag clears');
  assert.equal(factorDesk(verdance(2), 'air'), null, 'no farming contract on that planet');
});

test('the dialog path: the Factor hands over farmCard\'s terms; ACCEPT makes the farm; talking and the deal count with them', () => {
  const s = verdance(2), fac = factorOf(PACKS, 'ground'), ship = CATALOG.capitalShips.Verdance.ship;
  const card = factorCard('ground', ship, fac), base = farmCard('ground', ship);
  assert.equal(card.character.name, 'Quartermaster Ines Roth');
  assert.equal(card.character.phrase, PACKS.factions.ground.characters.find((c) => c.name === fac.name).phrases[0]);
  assert.match(card.kicker, /FARMING CONTRACT — TRADE STATION · HALBRECHT'S OATH/);
  assert.equal(card.terms, base.terms); assert.equal(card.task, base.task);
  assert.equal(card.acceptLabel, 'ACCEPT CONTRACT'); assert.equal(card.declineLabel, 'LATER');
  assert.equal(noteFactorTalk(s, 'ground', fac, { day: '2026-11-11' }), true);
  assert.equal(noteFactorTalk(s, 'ground', fac, { day: '2026-11-11' }), false, 'a greeting counts once a day');
  const r = acceptViaFactor(s, 'ground', fac, { map, now: T0, day: '2026-11-11' });
  assert.ok(r.farmhouse, r.error);
  assert.ok(hasFarm(s, 'ground'));
  assert.deepEqual(s.rapport[fac.name], { score: 2, kept: 0, broken: 0, faction: 'ground', greets: 1, greetDay: '2026-11-11', contracts: 1 });
  // a refused accept (gate shut) strikes no deal
  const shut = verdance(1);
  assert.match(acceptViaFactor(shut, 'ground', fac, { map, now: T0 }).error, /finish Verdance/);
  assert.equal(shut.rapport && shut.rapport[fac.name], undefined);
});

test('the old card path is gone: the captain\'s slot and the Mission Log no longer offer F1', () => {
  const menu = readFileSync(new URL('../menu/menu.js', import.meta.url), 'utf8');
  assert.doesNotMatch(menu, /farmOffer|farmCard/, 'menu.js shipOffer carries the outpost contract only');
  const log = readFileSync(new URL('../menu/missionLog.js', import.meta.url), 'utf8');
  assert.doesNotMatch(log, /accept-farm/);
  const s = verdance(2);
  const m = syncMissions(s, CATALOG, flowCtx(s, { allOpen: true, now: T0 })).find((x) => x.id === 'FC-VER-1') || s.missions.find((x) => x.id === 'FC-VER-1');
  assert.ok(m, 'F1 is in the Mission Log once the gate opens');
  const html = actionsHtml({ m, status: 'active' }, s, CATALOG);
  assert.doesNotMatch(html, /accept-farm/);
  assert.match(html, /See Quartermaster Ines Roth/);
  assert.match(html, /Trade Station/);
});
