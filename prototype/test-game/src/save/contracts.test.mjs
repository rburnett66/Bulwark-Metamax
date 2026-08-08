// Quest contracts, checked against the real workbook data and the real voice packs (GGG-3).
//
// contracts.js held a FOURTH copy of the faction-name array and indexed it positionally
// (`FACTION_NAMES[giverId - 1]`) with a workbook Faction_ID. Two things made that dangerous rather
// than merely redundant:
//
//   1. MAPDATA's own Faction_Name column is the placeholder 'Faction_01'…'Faction_09'. Array
//      POSITION was the only thing binding a workbook row to a real faction — reorder the list and
//      every quest giver, rival and loyalty ledger key silently renames itself.
//   2. It then looked the giver up in voicepacks.json BY DISPLAY NAME, but the packs are keyed by
//      voice key. It never matched, so every contract offer shipped with `character: null` — no
//      quest-giver name, face or line in the contract modal.
//
// Nothing below asserts the registry against itself: the ids come from MAPDATA, the cast comes from
// voicepacks.json, and the registry is what has to reconcile them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAPDATA } from '../../content/maps/mapdata.js';
import { buildOffer } from './contracts.js';
import '../data/factions.js';

const REG = globalThis.BulwarkFactions;
const packs = JSON.parse(readFileSync(new URL('../../content/dialog/voicepacks.json', import.meta.url), 'utf8'));

/** A map with quest nodes — buildOffer returns null without them. The DATA under test is MAPDATA's
 *  Quest_Giver_Faction and the voice packs; the board itself only has to have crystals on it. */
const questMap = { resources: [{ role: 'quest', units: 5 }, { role: 'quest', units: 5 }] };
const emptySave = { maps: {} };

/** The workbook's Rival_Faction is a NUMBER, except Greenies (id 9), where it is the STRING 'none'.
 *  That sentinel is TRUTHY, so `if (row.Rival_Faction)` lets it through — the old code then did
 *  `FACTION_NAMES['none' - 1]`, i.e. `[NaN]`, and handed `undefined` back as the rival name. The
 *  ordinal lookup that replaced it compares strictly, so a non-number resolves to nothing. This
 *  helper states the shape so the tests below stop trusting truthiness. */
function rivalIdOf(row) {
  const v = row && row.Rival_Faction;
  if (typeof v === 'number') return v;
  assert.ok(v == null || v === 'none', `unexpected Rival_Faction sentinel: ${JSON.stringify(v)}`);
  return null;
}

test('the workbook faction ids and the registry ordinals are the SAME set', () => {
  // This is the invariant that makes an ordinal lookup safe where an array index was not. If the
  // workbook ever grows a tenth faction, or renumbers, this fails loudly instead of the game
  // quietly attributing a contract to the wrong faction.
  const workbook = MAPDATA.factions.map((f) => f.Faction_ID).sort((a, b) => a - b);
  const ordinals = REG.FACTIONS.map((f) => f.ordinal).sort((a, b) => a - b);
  assert.deepEqual(ordinals, workbook,
    'MAPDATA Faction_IDs and registry ordinals have diverged — every id lookup is now suspect');
});

test('every workbook faction id — including rivals — resolves to exactly one faction', () => {
  for (const row of MAPDATA.factions) {
    const hit = REG.FACTIONS.filter((f) => f.ordinal === row.Faction_ID);
    assert.equal(hit.length, 1, `Faction_ID ${row.Faction_ID} resolves to ${hit.length} factions`);
    const rivalId = rivalIdOf(row);
    if (rivalId != null) {
      const rival = REG.FACTIONS.filter((f) => f.ordinal === rivalId);
      assert.equal(rival.length, 1,
        `Faction_ID ${row.Faction_ID} names rival ${rivalId}, which resolves to ${rival.length}`);
      assert.notEqual(rivalId, row.Faction_ID, 'a faction cannot be its own rival');
    }
  }
});

test('every quest-giving map offers a contract from a NAMED character of the giving faction', () => {
  const givers = MAPDATA.maps.filter((r) => r.Quest_Giver_Faction);
  assert.ok(givers.length, 'no map declares a quest giver — the fixture has drifted');

  for (const row of givers) {
    const offer = buildOffer(row.Map_ID, questMap, packs, emptySave);
    assert.ok(offer, `map ${row.Map_ID} declares a quest giver but produced no offer`);

    // The giver is a real faction, resolved from the workbook id by declared ordinal.
    const expected = REG.FACTIONS.find((f) => f.ordinal === row.Quest_Giver_Faction);
    assert.ok(expected, `map ${row.Map_ID} names giver id ${row.Quest_Giver_Faction}, unknown to the registry`);
    assert.equal(offer.giver, expected.name, `map ${row.Map_ID} attributed its contract to the wrong faction`);

    // THE BUG: this was null on every map, because the packs are keyed by voice key.
    assert.ok(offer.character, `map ${row.Map_ID}: contract from ${offer.giver} has no character to deliver it`);

    // And the character is one of THAT faction's, not a neighbour's.
    const cast = packs.factions[expected.voice].characters.map((c) => c.name);
    assert.ok(cast.includes(offer.character.name),
      `map ${row.Map_ID}: ${offer.character.name} is not in ${expected.name}'s cast`);
    assert.ok(offer.character.align, 'the character carries no alignment — the alignment swing is dead');
  }
});

test('a declared rival is named on the offer, and a sentinel rival stays null', () => {
  for (const row of MAPDATA.maps.filter((r) => r.Quest_Giver_Faction)) {
    const frow = MAPDATA.factions.find((f) => f.Faction_ID === row.Quest_Giver_Faction);
    const offer = buildOffer(row.Map_ID, questMap, packs, emptySave);
    const rivalId = rivalIdOf(frow);
    if (rivalId != null) {
      const rival = REG.FACTIONS.find((f) => f.ordinal === rivalId);
      assert.equal(offer.rival, rival.name, `map ${row.Map_ID} named the wrong rival`);
      assert.notEqual(offer.rival, offer.giver, 'the rival penalty would hit the giver');
    } else {
      // Greenies' rival is the string 'none'. It must come out as null, not undefined and not a
      // faction — applyAccept/applyDecline move loyalty for whoever is named here.
      assert.equal(offer.rival, null,
        `map ${row.Map_ID}: a sentinel rival leaked through as ${JSON.stringify(offer.rival)}`);
    }
  }
});
