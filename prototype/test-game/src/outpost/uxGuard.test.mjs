// S7 — guard against UX copies [MM-story_mwc9pneu_2j] (TECH_PLAN::One-Battle-UX.md §6 S7).
//
// Owner 2026-11-11: "users are trained to work with camera, characters, and structure in one pattern and we don't want
// two patterns or two sets of code … we should never have to change UX in two places"; "utilize existing systems, DO
// NOT DUPLICATE". The battle session (src/battle/session.js) owns input, camera, the build rail, the HUD, placement
// and fog.
// This test FAILS if src/outpost/** or src/farm/** grows its own copy of any of them.
//
// THE ALLOW-LIST below is the save-model rules that the One-Battle-UX stories still have to delete (S2.4d removed the
// old OUTPOST view, S6 the FARM view that was left of it; S3 the models' build/upgrade/repair/sell). It is
// meant to SHRINK TO EMPTY: an entry that no longer matches FAILS too, so when a file is deleted (or cleaned) its entry
// must be deleted with it — never widen it to let new code in. A new file on the session path gets no entry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { map, T0 } from './view/fixtures.mjs';
import { referenceOutpost } from './model.js';
import { toLiveSim } from './liveSim.js';
import { outpostBattleMap } from './view/outpostBoard.js';
import { outpostCatalogueIds } from './view/sessionView.js';
import { createFogTracker, fogWindow } from '../render3d/overlays/fogModel.js';
import { buildIcon } from '../render/buildIcons.js';
import { getStructureDef, towerStructId } from '../data/tables.js';

const SRC = fileURLToPath(new URL('../', import.meta.url));   // prototype/test-game/src/

/** Every shipped .js file (no tests, no fixtures) under src/<dir>, as 'dir/…/file.js'. */
function filesUnder(dir) {
  const out = [];
  const walk = (abs) => {
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      const p = join(abs, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js')) out.push(relative(SRC, p).split('\\').join('/'));
    }
  };
  walk(join(SRC, dir));
  return out.sort();
}
/** Source with comments removed, so a comment that NAMES a battle system is not a copy of it. */
const code = (rel) => readFileSync(join(SRC, rel), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

/** What counts as a copy of a battle UX system. Each is a regex over comment-stripped source. */
const SYSTEMS = Object.freeze({
  pointer: {
    what: 'its own canvas / pointer / touch / wheel / key input (the battle session binds input: session.bindInput)',
    re: /['"`](pointer(down|move|up|cancel|enter|leave)|touch(start|move|end|cancel)|mouse(down|move|up|wheel)|wheel|keydown|keyup|contextmenu|gesture(start|change|end))['"`]|\.on(pointer|touch|mouse|key|wheel)\w*\s*=/,
  },
  buildRail: {
    what: 'its own build rail / palette DOM (the battle rail lists the mode catalogue: battle/catalogue.js)',
    re: /bw-palette|bw-buildbtn|railRow|\bapplyRailFit\b|\brailFit\(/,
  },
  hudRoot: {
    what: 'its own HUD root (the battle HUD is session.createHud; a mode adds a panel with session.addPanel)',
    re: /function\s+(mount|create)\w*Hud\b|import\s*\{[^}]*\b(createHud|updateHud)\b[^}]*\}\s*from\s*['"][^'"]*render\/hud\.js['"]|['"`]bw-hud['"`]/,
  },
  camera: {
    what: 'its own camera framing / control (the battle camera rig lives in the session\'s 3D view)',
    re: /function\s+\w*Camera\s*\(|\.cam\.(dist|yaw|pitch|target|x|z)\s*=/,
  },
  placement: {
    what: 'its own placement / construct / upgrade / repair / sell logic (the battle sim commands: sim/core.js applyCommand)',
    re: /function\s+(place|placePlot|placeFarmBuilding|placementStep|upgrade|upgradeDefense|repair|repairAll|sell|sellStructure|startConstruction|startBuild\w*|startUpgrade|validatePlacement)\s*\(|\bscreenToCell\(/,
  },
  fog: {
    what: 'its own fog (the battle fog runs on the live state: render3d fog tracker; S5)',
    re: /\.fog\.update\s*=|overlays\/fog(Model)?\.js/,
  },
  // AAA UX pass [MM-story_mwcuyrqr_3j] (spec Outpost-AAA-UX §2): the outpost's panel was built with inline styles in a
  // second font beside the battle HUD. A mode hands the HUD DATA (a HudCard model, readouts); the look lives in
  // render/hud.js + render/hudCard.js. Only showing / hiding (.style.display) is a mode's to set.
  inlineStyle: {
    what: 'an inline-styled panel or its own CSS (the look is render/hudCard.js / render/hud.js: hand the HUD a HudCard model, hud.addCard / setReadouts)',
    re: /\.style\.(?!display\b)\w+\s*=(?!=)|Object\.assign\(\s*[\w.]+\.style\b|\.style\.cssText|\.style\.setProperty\(|\bstyle="|createElement\(\s*['"]style['"]\s*\)|\.setAttribute\(\s*['"]style['"]/,
  },
});

/**
 * file → the systems it may still match, and the story that deletes it. EVERY entry must still match (else delete it).
 * Shrinks to {} when S3 lands.
 */
const ALLOWED = Object.freeze({
  // (S6 [MM-story_mwc9q1y6_2n] deleted the FARM view's own loop — outpostView.js, its HUD + rail hud.js, its camera
  //  framing layout.js and its placement steps buildMenu.js: the farm is a tab of the session's battle rail)
  // ── the save model's own build / upgrade / repair / sell rules: S3 moves them onto sim commands and deletes these ──
  'outpost/model.js': { systems: ['placement'], goes: 'S3 deletes model.js place / upgrade / upgradeDefense / repair / sell / sellStructure' },
  // ── the farm's save rules for a placement the battle placement has already checked (session.js act farmPlace): they go
  //    with the outpost model's in S3 ──
  'farm/model.js': { systems: ['placement'], goes: 'S3 moves the farm placePlot / placeFarmBuilding onto sim commands with the outpost model' },
});

const FILES = [...filesUnder('outpost'), ...filesUnder('farm')];
const hits = (rel) => Object.keys(SYSTEMS).filter((k) => SYSTEMS[k].re.test(code(rel)));

test('the guard reads real files (a scan that finds nothing to read must fail, not pass)', () => {
  assert.ok(FILES.length > 20, `found ${FILES.length} files under src/outpost and src/farm`);
  assert.ok(FILES.includes('outpost/view/sessionView.js'), 'the session view is scanned');
  // every pattern really bites: the allow-listed files prove each system's regex still matches something
  for (const k of Object.keys(SYSTEMS)) {
    if (Object.values(ALLOWED).some((a) => a.systems.includes(k))) assert.ok(FILES.some((f) => hits(f).includes(k)), `${k} matches its allow-listed file`);
  }
});

test('src/outpost/** and src/farm/** keep no copy of a battle UX system (outside the shrinking allow-list)', () => {
  const bad = [];
  for (const f of FILES) {
    const allowed = (ALLOWED[f] && ALLOWED[f].systems) || [];
    for (const k of hits(f)) if (!allowed.includes(k)) bad.push(`${f}: ${SYSTEMS[k].what}`);
  }
  assert.deepEqual(bad, [], 'use the battle session\'s system instead of a copy:\n  ' + bad.join('\n  '));
});

test('the no-inline-styled-panels guard bites a styled panel and lets a show / hide through [MM-story_mwcuyrqr_3j]', () => {
  const re = SYSTEMS.inlineStyle.re;
  for (const bad of ["Object.assign(panel.style, { position: 'absolute' })", "title.style.font = '900 13px Orbitron'", "d.style.color = '#fff'",
    'el.style.cssText = "x"', "n.setAttribute('style', 'color:red')", `'<div style="color:red">'`, "doc.createElement('style')"]) assert.ok(re.test(bad), `catches: ${bad}`);
  for (const ok of ["box.style.display = on ? '' : 'none'", "if (n.style.display === 'none') x()", 'card.render(model)']) assert.ok(!re.test(ok), `allows: ${ok}`);
  // the outpost's session view, which built the old inline panel, now has none
  assert.ok(!re.test(code('outpost/view/sessionView.js')), 'sessionView.js hands the HUD data only');
});

test('the allow-list only shrinks: every entry still exists and still matches what it is allowed', () => {
  for (const [f, a] of Object.entries(ALLOWED)) {
    assert.ok(FILES.includes(f), `${f} is gone (${a.goes}): delete its ALLOWED entry`);
    const h = hits(f);
    for (const k of a.systems) assert.ok(h.includes(k), `${f} no longer has its own ${k}: drop '${k}' from its ALLOWED entry (${a.goes})`);
  }
});

test('the outpost on the session path runs on the battle session, the battle fog and the battle rail', () => {
  const sv = code('outpost/view/sessionView.js');
  assert.match(sv, /import \{[^}]*\bcreateBattleSession\b[^}]*\} from '\.\.\/\.\.\/battle\/session\.js'/, 'sessionView imports battle/session.js');
  assert.match(sv, /createBattleSession\(host, \{/);
  assert.match(sv, /session\.createHud\(/, 'the battle HUD');
  assert.match(sv, /session\.bindInput\(\)/, 'the battle input');
  assert.match(sv, /session\.start\(\{/, 'the battle clock');
  assert.doesNotMatch(sv, /\bfog\b/, 'no fog code: the battle fog runs as in a battle (S5)');
  assert.match(sv, /hud\.setBuildPicture\(/, 'building pictures go onto the battle rail, not a rail of its own');
});

// ── S5 [MM-story_mwc9q0yy_2m]: the battle fog at the outpost, driven exactly as a battle drives it ──────────────────
test('S5: the battle fog tracker on the outpost’s live state — the whole board is the play area, ringed by the cloud bank', () => {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  const { state } = toLiveSim(o, { map, now: T0, gold: 0 });
  const board = outpostBattleMap(map);
  // render3d calls r.fog.update(state, r.map, dt) every frame; the window is the sim map's (no wave windows at an outpost)
  assert.equal(fogWindow(state, board), null, 'no wave window: the whole outpost board is in play');
  const tracker = createFogTracker();
  assert.equal(tracker.update(state, board, 1 / 60).win, null);
  // visit raids are waves of the live sim (visitRaids.js): a raid under way does not shrink the play area
  state.waves.current = 3; state.waves.active = true;
  assert.equal(tracker.update(state, board, 1 / 60).win, null, 'raid waves keep the whole board in play (no hidden contacts)');
  // (fog.js sync: with no window the cloud bank rings the map's own edge — the battle's open-board fog)
});

// ── the battle rail's pictures for the outpost catalogue ───────────────────────────────────────────────────────
test('rail pictures: an outpost defense shows its battle tower’s picture; a building has none baked (the mode hands its GLB picture)', () => {
  for (const id of outpostCatalogueIds()) {
    const tower = towerStructId(id);
    if (tower !== id) assert.equal(buildIcon(id), buildIcon(tower), `${id} reuses ${tower}'s picture`);
    else assert.equal(buildIcon(id), null, `${id} (a building) has no battle picture: sessionView renders its GLB (menuIcons.js)`);
  }
  assert.ok(buildIcon('OUT-mg') && buildIcon('OUT-cannon') && buildIcon('OUT-wall'));
  assert.equal(getStructureDef('OUT-power').kind, 'building');
  const sv = code('outpost/view/sessionView.js');
  assert.match(sv, /import \{ renderMenuIcons, OUTPOST_GLYPHS \} from '\.\/menuIcons\.js'/, 'the existing GLB picture renderer, not a new one');
});
