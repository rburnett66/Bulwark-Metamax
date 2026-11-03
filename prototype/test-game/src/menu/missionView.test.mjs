// [MM-story_mvyqoo07_f] The Mission Log list: rows, tabs, sort, status colour; drawn from real content.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { defaultSave } from '../save/save.js';
import { logMission, markMissionSeen, abandon, trackerLine, setTracked } from '../save/missions.js';
import { flowCtx, syncMissions } from '../save/missionFlow.js';
import { missionRows, sortRows, listHtml, tabsHtml, summaryHtml, rowHtml, barHtml, rewardView, STATUS, ORDER, TABS, TYPE_ICON, REWARD_ICON, dossierHtml, actionsHtml, gateViews, impactViews, noteFor, burstHtml } from './missionView.js';
import { MISSION_LOG_CSS } from './missionLogCss.js';
import { portraitSlug } from '../comm/commCard.js';

const CATALOG = JSON.parse(readFileSync(new URL('../../content/missions/missions.json', import.meta.url), 'utf8'));
const def = (id) => CATALOG.missions.find((m) => m.id === id);
const opt = { now: 1 };
const ctx = (s) => flowCtx(s, { allOpen: false, now: 1 });

function sample() {
  const s = defaultSave();
  s.alignment = 3;
  const ready = logMission(s, def('P-VER-01'), opt);
  for (const o of ready.objectives) o.have = o.need;
  const fresh = logMission(s, def('P-VER-02'), opt);
  const active = logMission(s, def('P-VER-03'), opt); markMissionSeen(s, active.id);
  const risk = logMission(s, def('S-VER-01-L'), opt); s.alignment = 0;
  const failed = logMission(s, def('S-VER-02-L'), opt); abandon(s, failed.id, opt);
  const done = logMission(s, def('P-VER-04'), opt); done.end = 'done';
  return { s, ready, fresh, active, risk, failed, done };
}

test('every state has a hue and a glyph; every mission type and reward kind in the content has an icon', () => {
  for (const st of Object.keys(ORDER)) { assert.ok(STATUS[st].v.startsWith('--s-'), st); assert.ok(STATUS[st].g.startsWith('s-'), st); }
  for (const m of CATALOG.missions) assert.ok(TYPE_ICON[m.type], m.type);
  for (const k of Object.keys(CATALOG.rewardKinds)) assert.ok(REWARD_ICON[k], k);
});

test('Ready sorts first, then at risk, new, active, locked, failed, done', () => {
  const { s } = sample();
  const rows = sortRows(missionRows(s, CATALOG, ctx(s)));
  const order = rows.map((r) => r.status);
  assert.deepEqual([...new Set(order)], ['ready', 'risk', 'new', 'active', 'locked', 'failed', 'done']);
  assert.equal(rows[0].m.id, 'P-VER-01');
});

test('tabs filter by status and show counts; Ready gets a pip', () => {
  const { s } = sample();
  const rows = missionRows(s, CATALOG, ctx(s));
  const html = tabsHtml(rows, 'active');
  const count = (k) => rows.filter((r) => TABS.find((t) => t.k === k).f(r.status)).length;
  assert.equal(count('ready'), 1);
  assert.equal(count('archive'), 2);
  assert.match(html, /data-tab="ready"><span class="dot"><\/span>Ready <b class="num">1<\/b>/);
  assert.match(html, /data-tab="active">Current/);
  assert.match(summaryHtml(rows), /<b class="num">1<\/b> to collect/);
  const archive = listHtml(rows, CATALOG, 'archive', null);
  assert.ok(archive.includes('st-done') && archive.includes('st-failed') && !archive.includes('st-ready'));
  assert.ok(listHtml(rows, CATALOG, 'ready', null).includes('Ready to collect'));
});

test('a row carries type icon, title, giver, planet, status tag, reward icons and a progress bar', () => {
  const { s, ready } = sample();
  const html = rowHtml({ m: ready, status: 'ready' }, CATALOG, 'P-VER-01');
  assert.ok(html.includes('#t-campaign'));
  assert.ok(html.includes('Landfall at Verdance'));
  assert.ok(html.includes('Quartermaster Ines Roth · Verdance'));
  assert.ok(html.includes('--sc:var(--s-ready)'));
  assert.ok(html.includes('aria-selected="true"'));
  assert.ok(html.includes('#r-gold') && html.includes('#r-xp') && html.includes('#r-crystal'));
  assert.ok(html.includes('rwi more">+1<'), 'three icons then +N');
  assert.ok(html.includes('role="progressbar"'));
  assert.ok(html.includes('>Collect<'), 'Ready says Collect instead of a count');
  assert.ok(html.includes('Primary') && html.includes('Step 1 / 9'));
  assert.ok(s);
});

test('Secondary rows carry their Light / Shadow tag; locked rows read Locked', () => {
  const s = defaultSave();
  syncMissions(s, CATALOG, ctx(s));
  s.capitalShips.Verdance = { arrived: true };
  const rows = missionRows(s, CATALOG, ctx(s));
  const lockedRow = rows.find((r) => r.m.id === 'S-VER-01-L');
  assert.equal(lockedRow.status, 'locked');
  const html = rowHtml(lockedRow, CATALOG, null);
  assert.ok(html.includes('var-l') && html.includes('Secondary') && html.includes('>Locked<'));
  assert.ok(html.includes('st-locked') && html.includes('#t-contract'));
  assert.equal(s.missions.some((m) => m.id === 'S-VER-01-L'), false, 'drawing a locked row writes nothing');
  assert.ok(listHtml(rows, CATALOG, 'active', null).includes('Locked — next steps'));
});

test('bars: cells up to 14, continuous with quarter ticks above', () => {
  const small = barHtml(7, 12, 'active');
  assert.equal((small.match(/class="seg/g) || []).length, 12);
  assert.equal((small.match(/seg f/g) || []).length, 7);
  const big = barHtml(50, 200, 'risk', true);
  assert.ok(big.includes('cont') && big.includes('width:25%') && big.includes('big') && big.includes('st-risk'));
  assert.equal((big.match(/class="tick"/g) || []).length, 3);
  assert.equal((barHtml(99, 2, 'ready').match(/seg f/g) || []).length, 2, 'never over-full');
});

test('empty tabs give direction', () => {
  const rows = missionRows(defaultSave(), CATALOG, ctx(defaultSave()));
  assert.match(listHtml(rows, CATALOG, 'ready', null), /Nothing to collect yet/);
});

test('reward views use the rarity colour for resources and name the node and price for a tech unlock', () => {
  const m = logMission(defaultSave(), def('P-VER-01'), opt);
  const res = rewardView(m.rewards.find((r) => r.kind === 'resource'), m, CATALOG);
  assert.equal(res.color, 'var(--r-common)');
  assert.equal(res.label, 'Loam Grain');
  const tech = rewardView(m.rewards.find((r) => r.kind === 'tech_unlock'), m, CATALOG);
  assert.equal(tech.label, 'Cannon T2 · 600 gold');
  assert.throws(() => rewardView({ kind: 'nonsense' }, m, CATALOG), /nonsense/);
});

test('the content text is escaped', () => {
  const m = logMission(defaultSave(), { ...def('P-VER-01'), title: '<b>x</b>' }, opt);
  assert.ok(!rowHtml({ m, status: 'new' }, CATALOG, null).includes('<b>x</b>'));
});

test('the CSS is the design page\'s, and every selector stays inside the log', () => {
  const src = readFileSync(new URL('../../../../docs/16 Bulwark MM/design/mission-log/mission-log.src.html', import.meta.url), 'utf8');
  for (const hue of ['#34e1ff', '#f2c869', '#ff8a3d', '#5fe39a', '#ef5350', '#7b8898']) { assert.ok(src.includes(hue)); assert.ok(MISSION_LOG_CSS.includes(hue), hue); }
  const noMedia = MISSION_LOG_CSS.replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').replace(/@media[^{]+\{/g, '');
  for (const m of noMedia.matchAll(/^([^{}\n]+)\{/gm)) for (const part of m[1].split(',')) assert.ok(part.trim().startsWith('.bwm-ml'), part);
  assert.ok(MISSION_LOG_CSS.includes('@media (max-height:500px)'), 'phone landscape');
  assert.ok(MISSION_LOG_CSS.includes('prefers-reduced-motion'));
});

// ── the dossier [MM-story_mvyqoplz_g] ───────────────────────────────────────────────────────────────────────────
const PACKS = JSON.parse(readFileSync(new URL('../../content/dialog/voicepacks.json', import.meta.url), 'utf8'));
const dossier = (s, m, status) => dossierHtml({ m, status }, s, CATALOG, ctx(s), PACKS);

test('the dossier shows briefing, objectives with progress, rewards, faction, alignment and the giver', () => {
  const s = defaultSave();
  const m = logMission(s, def('P-VER-01'), opt);
  const html = dossier(s, m, 'new');
  assert.ok(html.includes('Tutorial pressure. Land, dig in'), 'briefing');
  assert.ok(html.includes('Win Verdance map 1') && html.includes('0 / 1'), 'objectives with progress');
  assert.ok(html.includes('class="obj') && html.includes(' opt"'), 'the bonus is tagged');
  assert.ok(html.includes('REWARDS') && html.includes('>300<') && html.includes('Commander XP'), 'rewards');
  assert.ok(html.includes('Cannon T2 · 600 gold'), 'the node it unlocks and what it will cost');
  assert.ok(html.includes('Quartermaster Ines Roth') && html.includes('Ground / Powder'), 'giver and faction');
  assert.ok(html.includes('content/dialog/portraits/quartermaster-ines-roth.png'), 'the real portrait');
  assert.ok(html.includes('Homeworld') && html.includes('Verdance'));
  assert.ok(html.includes('class="on" style="--c:#9aa6b4"') && html.includes('>Neutral<small>Unaligned</small>'), 'the alignment rail marks N');
  assert.ok(html.includes('Someone counts the powder'), 'the motivation line from the voice packs');
  assert.ok(html.includes('Verdance campaign · step 1 of 9'), 'the quest line');
});

test('every giver in the content has a portrait file and a place in the voice packs', () => {
  for (const m of CATALOG.missions) {
    const cast = PACKS.factions[m.giver.faction];
    assert.ok(cast, m.id + ' faction');
    assert.ok(cast.characters.some((c) => c.name === m.giver.name), m.id + ' ' + m.giver.name);
    assert.ok(existsSync(new URL('../../content/dialog/portraits/' + portraitSlug(m.giver.name) + '.png', import.meta.url)), m.giver.name + ' portrait');
  }
});

test('the action follows the state: collect, waiting, track, abandon, remove, stamps', () => {
  const s = defaultSave();
  const p = logMission(s, def('P-VER-01'), opt);
  const early = actionsHtml({ m: p, status: 'ready' }, s, CATALOG);
  assert.ok(early.includes('data-act="collect"') && early.includes('Collect aboard the Collective ship'), 'maps 1-3: the Collective ship is always here');
  assert.ok(early.includes('Verdance campaign'), 'collecting continues the line');
  const p4 = logMission(s, def('P-VER-04'), opt);
  assert.match(actionsHtml({ m: p4, status: 'ready' }, s, CATALOG), /Waiting for Halbrecht/, 'map 4: no planet ship yet');
  assert.match(actionsHtml({ m: p4, status: 'ready' }, s, CATALOG), /map 3 averages 3 stars/);
  assert.ok(!actionsHtml({ m: p4, status: 'ready' }, s, CATALOG).includes('data-act="collect"'));
  s.capitalShips.Verdance = { arrived: true };
  const ready = actionsHtml({ m: p4, status: 'ready' }, s, CATALOG);
  assert.ok(ready.includes('data-act="collect"') && ready.includes("Collect aboard Halbrecht's Oath"));
  const act = actionsHtml({ m: p, status: 'active' }, s, CATALOG);
  assert.ok(act.includes('data-act="track"') && !act.includes('data-act="abandon"'), 'a primary cannot be abandoned');
  const sec = logMission(s, def('S-VER-01-L'), opt);
  assert.ok(actionsHtml({ m: sec, status: 'risk' }, s, CATALOG).includes('data-act="abandon"'));
  setTracked(s, sec.id);
  assert.ok(actionsHtml({ m: sec, status: 'risk' }, s, CATALOG).includes('Tracking in battle'));
  assert.ok(actionsHtml({ m: sec, status: 'failed' }, s, CATALOG).includes('data-act="dismiss"'));
  assert.ok(actionsHtml({ m: p, status: 'done' }, s, CATALOG).includes('claimed-stamp'));
  assert.ok(actionsHtml({ m: p, status: 'locked' }, s, CATALOG).includes('Locked'));
  assert.equal((burstHtml().match(/<span/g) || []).length, 14);
});

test('gates list what is met and what is not; a locked mission is judged live', () => {
  const s = defaultSave();
  s.questSteps['QL-VER-P'] = 1;
  const rows = missionRows(s, CATALOG, ctx(s));
  const row = rows.find((r) => r.m.id === 'P-VER-02');
  assert.equal(row.status, 'locked');
  const g = gateViews(row, s, ctx(s));
  assert.ok(g.some((x) => x.kind === 'Quest line' && x.ok));
  assert.ok(g.some((x) => x.kind === 'Tech node' && x.text === 'Own Cannon T2' && !x.ok));
  assert.ok(!g.some((x) => x.kind === 'Capital ship'), 'map 2 needs no planet ship');
  assert.ok(dossierHtml(row, s, CATALOG, ctx(s), PACKS).includes('OBJECTIVES (WHEN UNLOCKED)'));
  s.questSteps['QL-VER-P'] = 3;
  const row4 = missionRows(s, CATALOG, ctx(s)).find((r) => r.m.id === 'P-VER-04');
  assert.ok(gateViews(row4, s, ctx(s)).some((x) => x.kind === 'Capital ship' && !x.ok), 'map 4 does');
  assert.deepEqual(gateViews({ m: row.m, status: 'done' }, s, ctx(s)), [], 'history has no gates');
});

test('faction impact and terms for a secondary; a failed one shows its outcome', () => {
  const s = defaultSave();
  const m = logMission(s, def('S-VER-01-L'), opt);
  const imp = impactViews(m);
  assert.deepEqual(imp.map((x) => x.amount), ['+35', '−17', '+1']);
  assert.ok(imp[1].label.includes('rival'));
  const html = dossier(s, m, 'risk');
  assert.ok(html.includes('FACTION IMPACT') && html.includes('One attempt') && html.includes('Broken promise') && html.includes('Withdrawn if'));
  assert.match(noteFor({ m, status: 'risk' }, s), /Alignment history is at 0/);
  m.end = 'failed'; m.endReason = 'Broken promise: the attempt ended short.';
  const failed = dossier(s, m, 'failed');
  assert.ok(failed.includes('OUTCOME') && failed.includes('rwd neg') && failed.includes('−45') && failed.includes('Broken promise: the attempt ended short.'));
});

test('an objective past its need reads full, never 8 / 4', () => {
  const s = defaultSave(), m = logMission(s, def('P-VER-03'), opt);
  for (const o of m.objectives) o.have = o.need * 2;
  const html = dossier(s, m, 'ready');
  assert.ok(html.includes('4 / 4') && !html.includes('8 / 4'));
});

test('a planet with no ship says so in its note', () => {
  const s = defaultSave(), m = logMission(s, def('P-VER-04'), opt);
  assert.match(noteFor({ m, status: 'ready' }, s), /wait for Halbrecht/);
  assert.match(noteFor({ m: logMission(s, def('P-VER-01'), opt), status: 'ready' }, s), /aboard the Collective ship/);
  s.capitalShips.Verdance = { arrived: true };
  assert.match(noteFor({ m, status: 'ready' }, s), /Collect the rewards aboard/);
});

test('the battle tracker reads the live counters, writes nothing, and only shows on its own map', () => {
  const s = defaultSave();
  const m = logMission(s, def('P-VER-02'), opt);
  const state = { mapScore: { goldFromPrimary: 150 }, economy: { kills: 1 }, waves: { total: 8 }, waveStars: [], time: 30 };
  const before = JSON.stringify(m), sim = JSON.stringify(state);
  const line = trackerLine(m, state, { mapId: 2, planet: 'Verdance' });
  assert.match(line, new RegExp('^' + m.title + ' · 50%$'), '150 of 300 gold, the win still to come');
  assert.equal(JSON.stringify(m), before, 'the record is untouched');
  assert.equal(JSON.stringify(state), sim, 'the sim is untouched');
  assert.equal(trackerLine(m, state, { mapId: 3, planet: 'Verdance' }), null, 'another map');
  assert.equal(trackerLine(null, state, {}), null);
});

test('the log\'s actions are wired, and the HUD asks for the tracker line', () => {
  const src = readFileSync(new URL('./missionLog.js', import.meta.url), 'utf8');
  for (const a of ['collect', 'track', 'abandon', 'dismiss', 'back']) assert.ok(src.includes("act_ === '" + a + "'"), a);
  assert.ok(/hud\.trackedLine/.test(readFileSync(new URL('../render/hud.js', import.meta.url), 'utf8')));
});
