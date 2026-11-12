// The outpost's raid threat on the HUD [MM-story_mwco8she_38]. Owner 2026-11-11 (on #281): "show the threat level: yes".
// One pure helper (hudModel.raidThreat), carried by hudModel() so both outpost views read the same text: the old view's
// top-bar chip (hud.js) and the ?outpost=session path's panel on the battle HUD (sessionView.js, session.addPanel).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hudModel, raidThreat } from './hudModel.js';
import { referenceOutpost, confirmOnline, outpostSize, raidChance } from '../model.js';
import { OUTPOST } from '../../data/outpost.js';
import { map, T0, HOUR } from './fixtures.mjs';

const online = () => confirmOnline(referenceOutpost('ground', { seed: 3, map, now: T0 }), map, T0).outpost;
const walls = (o, n) => { for (let i = 0; i < n; i++) o.defenses.push({ id: `t${i}`, kind: 'wall', tier: 1, cell: [i, 0], hp: 1000 }); return o; };
const windowsPerDay = 24 / OUTPOST.Raid_Min_Gap_Hours;

test('raidThreat: size from outpostSize, raids a day from raidChance per window', () => {
  const o = online();
  const t = raidThreat(o, T0);
  assert.equal(t.size, outpostSize(o, T0));
  assert.ok(Math.abs(t.perDay - raidChance(t.size) * windowsPerDay) < 1e-9);
  assert.equal(t.text, `Threat: size ${t.size} · ${Math.round(t.perDay)} raids/day`);
  assert.equal(t.short, `Threat ${t.size} · ${Math.round(t.perDay)}/day`);
});

test('raidThreat spans the workbook range: 4 a day at size 0, 7.2 at the cap', () => {
  const o = online();
  o.pads = Object.fromEntries(Object.entries(o.pads).filter(([, b]) => b.kind === 'hub'));
  o.defenses = []; o.building = [];
  assert.equal(raidThreat(o, T0).size, 0);
  assert.ok(Math.abs(raidThreat(o, T0).perDay - (OUTPOST.Raid_Min_Gap_Hours / OUTPOST.Raid_Mean_Hours) * windowsPerDay) < 1e-9);
  assert.equal(raidThreat(o, T0).text, 'Threat: size 0 · 4 raids/day');
  walls(o, 200);
  assert.ok(Math.abs(raidThreat(o, T0).perDay - OUTPOST.Raid_Chance_Max * windowsPerDay) < 1e-9);
  assert.equal(raidThreat(o, T0).text, 'Threat: size 200 · 7 raids/day');
});

test('raidThreat counts the farm\'s finished buildings and reads the time it is given', () => {
  const o = online(), base = raidThreat(o, T0).size;
  o.farm = { plots: {}, buildings: { f1: { kind: 'farmhouse', x: 0, y: 0, w: 2, h: 2, tier: 1, done: T0 + HOUR } }, next: 2 };
  assert.equal(raidThreat(o, T0).size, base);
  assert.equal(raidThreat(o, T0 + HOUR).size, base + 1);
});

test('an offline outpost is not raided, and the readout says so', () => {
  const o = referenceOutpost('ground', { seed: 3, map, now: T0 });
  assert.equal(o.online, false);
  assert.match(raidThreat(o, T0).text, /^Threat: size \d+ · no raids offline$/);
  assert.match(raidThreat(o, T0).short, /^Threat \d+ · offline$/);
});

test('hudModel carries the threat at `now` (one model for both views); the text stays phone-short', () => {
  const o = walls(online(), 3);
  const h = hudModel(o, map, { gold: 0, now: T0 });
  assert.deepEqual(h.threat, raidThreat(o, T0));
  assert.ok(h.threat.text.length <= 32, h.threat.text);
  assert.ok(h.threat.short.length <= 20, h.threat.short);
});

test('the outpost renders hudModel().threat.text in its existing panel (no new HUD of its own; the old view went in S6)', () => {
  const src = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
  const sv = src('./sessionView.js');
  assert.match(sv, /threatLine\.textContent = h\.threat\.text/, 'session path: the outpost panel on the battle HUD');
  assert.match(sv, /session\.addPanel\(panel\)/);
});
