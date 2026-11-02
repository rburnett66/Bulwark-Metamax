// [MM-story_mvyqoo07_f] The Mission Log list: rows, tabs, sort, status colour; drawn from real content.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultSave } from '../save/save.js';
import { logMission, markMissionSeen, abandon } from '../save/missions.js';
import { flowCtx, syncMissions } from '../save/missionFlow.js';
import { missionRows, sortRows, listHtml, tabsHtml, summaryHtml, rowHtml, barHtml, rewardView, STATUS, ORDER, TABS, TYPE_ICON, REWARD_ICON } from './missionView.js';
import { MISSION_LOG_CSS } from './missionLogCss.js';

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
