/**
 * src/fxlab/fxlab.js — the EFFECTS LAB (fxlab.html) [MM-story_mvk63439_o].
 *
 * Owner 2026-10-22: "Can you create an effects test page I can get to from settings that allows me to see all effects
 * and how they look for each faction. I also want to tune the target reticle for the base cannon."
 *
 * Runs the REAL sim (createSim / stepSim / applyCommand) and the REAL 3D renderer (createRenderer3D / renderFrame) on
 * the chosen faction's own map 1, so every muzzle flash, tracer, spark, fireball, wreck, mine, build effect and the
 * base super-cannon's reticle and shell look exactly as in battle — each faction's hits in its own colour. The base
 * can't die and gold never runs out; waves of the chosen units loop. The tuning panels write the live layer
 * (render3d/fx/fxTune.js): every change shows on the next particle, Save stores it for the game in this browser,
 * Copy gives the JSON to bake into the code.
 *
 * Render-side page: Math.random is not used; the sim stays deterministic.
 */
import '../data/factions.js';
import { UNITS, STRUCTURES, ABILITIES, projScaleForMap } from '../data/tables.js';
import { PLANETS } from '../data/planets.js';
import { buildTerrainMap, resolveResourceTypes } from '../sim/mapgen.js';
import { createSim, stepSim, applyCommand, FIXED_DT, CANNON } from '../sim/core.js';
import { createUnit } from '../sim/entities.js';
import * as R3 from '../render3d/index.js';
import { cellToWorld } from '../render3d/camera.js';
import { FACTION_FX } from '../render3d/fx/factionFx.js';
import { TUNE, PARTICLE_KINDS, RETICLE_DEFAULTS, setTune, saveTune, clearSavedTune, diffTune, defaultTune, rgbToHex, FX_TUNE_KEY } from '../render3d/fx/fxTune.js';
import { FACTION_MAP, arenaMap, factionUnits, spawnCells, towerCells } from './arena.js';

const REG = globalThis.BulwarkFactions;
const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, kids = []) => { const e = Object.assign(document.createElement(tag), props); for (const k of kids) e.append(k); return e; };

const TOWER_KINDS = new Set(['antiGround', 'antiAir', 'mine', 'wall']);
const TOWERS = Object.entries(STRUCTURES).filter(([, d]) => TOWER_KINDS.has(d.kind)).map(([id, d]) => ({ id, name: d.name }));
const DEFAULT_TOWERS = new Set(TOWERS.filter((t) => t.id !== 'STR-Wall' && t.id !== 'STR-Mine').map((t) => t.id));
const SPEEDS = [0.1, 0.25, 0.5, 1, 2];

const S = {
  faction: REG.FACTIONS[0].key, unit: 'all', count: 4, utier: 1, dist: 10, loop: true,
  towers: new Set(DEFAULT_TOWERS), ttier: 1, tcount: 2, speed: 1, paused: false, clickFire: false,
  r: null, sim: null, map: null, slug: null, events: [], acc: 0, last: 0, respawnIn: 0, upgrades: true, seq: 0, stepOnce: 0,
};

// ---------------------------------------------------------------------------------------------------- arena
async function loadForge(slug) {
  const res = await fetch(`content/maps/forge/${slug}-map-1.json`);
  if (!res.ok) throw new Error(`no map for ${slug} (HTTP ${res.status})`);
  return res.json();
}

async function buildArena() {
  const seq = ++S.seq;
  $('status').textContent = 'Loading the arena…'; $('status').hidden = false;
  if (S.r) { try { R3.destroyRenderer(S.r); } catch (e) { /* gone */ } S.r = null; }
  const slug = FACTION_MAP[S.faction] || 'powder';
  const forge = await loadForge(slug);
  if (seq !== S.seq) return;
  const map = arenaMap(buildTerrainMap(forge, 1, { seed: 0, bakeTune: {} }));
  resolveResourceTypes(map, 1);
  const fac = REG.find(S.faction);
  const sim = createSim(1, { map, waves: [], carry: null, faction: fac.name, mapId: 1 });
  S.map = map; S.sim = sim; S.slug = `${slug}-map-1`; S.events = []; S.acc = 0; S.respawnIn = 0.5;
  const r = await R3.createRenderer3D($('mount'), map, { slug: S.slug, craft: 'system', landing: false, planet: S.faction,
    projFx: () => projFx, projScale: () => projScaleForMap(1), qualityQuery: 'high' });
  if (seq !== S.seq) { R3.destroyRenderer(r); return; }
  S.r = r;
  r.canvas.addEventListener('click', onMapClick);
  frameCamera();
  buildTowers();
  $('status').hidden = true;
}

/** Frame the base and the spawn line, close enough to read the effects (the player can still pan and zoom). */
function frameCamera() {
  const r = S.r, b = S.map.base, c = spawnCells(S.map, 1, { dist: S.dist, flyer: true })[0] || b;
  r.userMoved = true; r.camGlide = null;
  r.cam.tx = cellToWorld((b.x + c.x) / 2); r.cam.tz = cellToWorld((b.y + c.y) / 2); r.cam.dist = 20 + S.dist * 0.6;
}

function clearUnits() {
  for (const u of [...S.sim.units.values()]) if (u.side === 'attacker') S.sim.units.delete(u.id);
}

/** The faction's SPECIAL ABILITY carrier [MM-story_mvn06y2l_8]: its unit id and ability row, or null. */
function carrierOf(factionName) {
  const id = Object.keys(UNITS).find((k) => UNITS[k].faction === factionName && UNITS[k].ability);
  return id ? { id, ability: UNITS[id].ability, row: ABILITIES[UNITS[id].ability] } : null;
}

/** Ability mode: the Mine Layer and the Water Blobs need something on the ground to hit — a crystal field on the
 *  approach (harvesters drive to it too, so the mines have victims and the blobs have targets). */
function seedApproachField() {
  const sim = S.sim, b = S.map.base;
  const c = spawnCells(S.map, 1, { dist: Math.max(5, S.dist - 3) })[0];
  if (!c || !sim.resourceNodes) return;
  if (sim.resourceNodes.some((n) => n.fieldId === 'fx-field')) return;
  const tmpl = sim.resourceNodes[0] || { type: 'crystal', role: 'primary', color: 'blue', valuePerUnit: 4, harvestSec: 8 };
  const mx = Math.round((c.x + b.x) / 2), my = Math.round((c.y + b.y) / 2);
  [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [2, 1], [-1, 2]].forEach(([dx, dy], i) => {
    sim.resourceNodes.push({ ...tmpl, id: 'fx-node-' + i, fieldId: 'fx-field', x: mx + dx, y: my + dy, wave: 1, units: 40, remaining: 40, respawns: false, respawnAt: null });
  });
}

function spawnWave() {
  const units = factionUnits(UNITS, REG.find(S.faction).name);
  const carrier = carrierOf(REG.find(S.faction).name);
  const ability = S.unit === 'ability' && carrier;
  const pick = ability ? units.filter((u) => u.id === carrier.id || !UNITS[u.id].ability) : S.unit === 'all' ? units : units.filter((u) => u.id === S.unit);
  if (!pick.length) return;
  const list = [];
  if (ability) {
    // the carrier in the middle of its escort; Dark gets a fragile escort (things to raise), Arcane a heavy one (things to mirror)
    let escorts = pick.filter((u) => u.id !== carrier.id && u.domain === (UNITS[carrier.id].domain === 'Flyer' ? 'Walker' : UNITS[carrier.id].domain));
    if (carrier.ability === 'resurrect') escorts = escorts.filter((u) => u.shape === 'Troops');   // fragile: they fall near the scout and rise
    const n = Math.max(3, S.count);
    for (let k = 0; k < n - 1; k++) list.push(escorts[k % Math.max(1, escorts.length)] || pick[0]);
    list.splice(Math.floor(list.length / 2), 0, pick.find((u) => u.id === carrier.id));
    if (carrier.ability === 'mineLayer' || carrier.ability === 'waterBlobs') seedApproachField();
  } else {
    for (let k = 0; k < S.count; k++) list.push(pick[k % pick.length]);
  }
  const ground = spawnCells(S.map, list.length, { dist: S.dist });
  const air = spawnCells(S.map, list.length, { dist: S.dist, flyer: true });
  list.forEach((u, k) => {
    const flyer = u.domain === 'Flyer';
    const c = (flyer ? air : ground)[k] || air[k];
    if (!c) return;
    const unit = createUnit(S.sim, u.id, S.utier, { x: c.x, y: c.y }, flyer ? 'air' : u.domain === 'Walker' ? 'ground' : 'water', 'attacker');
    if (!unit) return;
    unit.routeIdx = -1;   // path from where it stands, not from the map's painted routes
    S.sim.units.set(unit.id, unit);
  });
}

function buildTowers() {
  const sim = S.sim;
  sim.economy.money = 1e6;   // before placing: a fresh sim starts with the campaign's opening gold
  for (const id of [...sim.structures.keys()]) sim.structures.delete(id);
  if (sim.mines) sim.mines.clear();
  const cells = towerCells(S.map);
  let i = 0;
  const order = TOWERS.filter((t) => S.towers.has(t.id));
  for (let n = 0; n < S.tcount; n++) for (const t of order) {
    for (; i < cells.length; i++) {
      const r = applyCommand(sim, { type: 'place', structId: t.id, cell: cells[i] });
      if (r.ok) { i++; break; }
    }
  }
}

function fireCannon(at) {
  const sim = S.sim, b = sim.base, c = b && b.cannon;
  if (!c) return;
  let p = at;
  if (!p) {
    let best = null, bd = Infinity;
    for (const u of sim.units.values()) {
      if (u.side !== 'attacker' || u.hp <= 0 || u.domain === 'Flyer' || u.altitude > 0) continue;
      const d = Math.hypot(u.pos.x - b.pos.x, u.pos.y - b.pos.y);
      if (d < bd) { bd = d; best = u; }
    }
    p = best ? { x: best.pos.x, y: best.pos.y } : { x: b.pos.x - 8, y: b.pos.y };
  }
  c.aimPos = { x: p.x, y: p.y }; c.phase = 'aim'; c.timer = CANNON.aim; c.aimDur = CANNON.aim;
  S.events.push({ type: 'cannonAim', tick: sim.tick, pos: { x: p.x, y: p.y }, dur: CANNON.aim, radius: CANNON.aoe });
}

function onMapClick(ev) {
  if (!S.clickFire || !S.r) return;
  const rect = S.r.canvas.getBoundingClientRect();
  const cell = R3.screenToCell(S.r, ev.clientX - rect.left, ev.clientY - rect.top);
  if (cell) fireCannon({ x: cell.x, y: cell.y });
}

// ---------------------------------------------------------------------------------------------------- loop
function tick(now) {
  requestAnimationFrame(tick);
  const real = Math.min(0.1, Math.max(0, (now - (S.last || now)) / 1000)); S.last = now;
  const sim = S.sim, r = S.r;
  if (!sim || !r) return;
  let dt = S.paused ? 0 : real * S.speed;
  if (S.stepOnce) { dt += S.stepOnce; S.stepOnce = 0; }
  sim.economy.money = 1e6;                       // gold never runs out
  if (sim.base) sim.base.hp = sim.base.maxHp;    // the base can't die
  S.acc += dt;
  while (S.acc >= FIXED_DT) {
    S.acc -= FIXED_DT;
    const evs = stepSim(sim, FIXED_DT);
    if (evs && evs.length) S.events.push(...evs);
  }
  // upgrade finished towers to the chosen tier
  for (const s of sim.structures.values()) if ((s.tier || 1) < S.ttier && s.lifecycle === 'Complete') applyCommand(sim, { type: 'upgrade', id: s.id });
  // loop: a new wave a moment after the last one dies
  const alive = [...sim.units.values()].some((u) => u.side === 'attacker' && u.hp > 0);
  if (!alive && S.loop && dt > 0) { S.respawnIn -= dt; if (S.respawnIn <= 0) { spawnWave(); S.respawnIn = 1.2; } }
  try { R3.renderFrame(r, sim, {}, S.events, dt); } catch (e) { console.error(e); }
  S.events = [];
  const n = [...sim.units.values()].filter((u) => u.side === 'attacker' && u.hp > 0).length;
  $('hud').textContent = `${REG.find(S.faction).name} · ${PLANETS[S.faction] ? PLANETS[S.faction].name : ''} · ${n} attackers · ${sim.structures.size} towers · ×${S.speed}${S.paused ? ' · paused' : ''}`;
}

// ---------------------------------------------------------------------------------------------------- UI
let sliderSeq = 0;
function slider(parent, label, get, set, min, max, step, fmt = (v) => (+v).toFixed(2)) {
  const id = 'fx-s' + (++sliderSeq);
  const inp = el('input', { type: 'range', min, max, step, value: get(), id });
  const v = el('span', { className: 'v', textContent: fmt(get()) });
  inp.addEventListener('input', () => { set(+inp.value); v.textContent = fmt(+inp.value); showJson(); });
  const row = el('div', { className: 'row' }, [el('label', { htmlFor: id, textContent: label }), inp, v]);
  row.refresh = () => { inp.value = get(); v.textContent = fmt(get()); };
  parent.append(row);
  return row;
}

const refreshers = [];
function buildTuning() {
  const kinds = $('fx-kinds'); kinds.textContent = '';
  for (const k of PARTICLE_KINDS) {
    const box = el('div', { className: 'kind' }, [el('h3', { textContent: k })]);
    for (const f of ['count', 'size', 'life']) refreshers.push(slider(box, f === 'count' ? 'Amount' : f === 'size' ? 'Size' : 'Lifetime', () => TUNE.impacts[k][f], (v) => { TUNE.impacts[k][f] = v; }, 0, 3, 0.05, (v) => '×' + (+v).toFixed(2)));
    kinds.append(box);
  }
  refreshers.push(slider(kinds, 'Camera shake', () => TUNE.shake, (v) => { TUNE.shake = v; }, 0, 3, 0.05, (v) => '×' + (+v).toFixed(2)));

  const sw = $('fx-swatches'); sw.textContent = '';
  for (const f of REG.FACTIONS) {
    const base = FACTION_FX[f.prefix];
    const cur = () => (Object.prototype.hasOwnProperty.call(TUNE.faction, f.prefix) ? TUNE.faction[f.prefix] : (base ? rgbToHex(base) : null));
    const color = el('input', { type: 'color', value: cur() || '#ffcc66', title: `${f.name} effect colour` });
    const classic = el('input', { type: 'checkbox', checked: cur() === null });
    color.addEventListener('input', () => { TUNE.faction[f.prefix] = color.value; classic.checked = false; showJson(); });
    classic.addEventListener('change', () => { TUNE.faction[f.prefix] = classic.checked ? null : color.value; showJson(); });
    const row = el('div', { className: 'sw' }, [color, el('span', { className: 'name', textContent: f.name }), el('label', {}, [classic, 'classic'])]);
    row.refresh = () => { const c = cur(); color.value = c || '#ffcc66'; classic.checked = c === null; };
    refreshers.push(row); sw.append(row);
  }
  const mix = $('fx-mix'); mix.textContent = '';
  mix.append(el('div', { className: 'note', textContent: 'How much of the faction colour each effect takes (0 = classic, 1 = all faction colour).' }));
  const MIXN = { spark0: 'Sparks (min)', spark1: 'Sparks (max)', flash: 'Flash', ember: 'Embers', fire: 'Fire', ring: 'Shock ring', pool: 'Light pool', wreckLight: 'Wreck glow' };
  for (const k of Object.keys(TUNE.mix)) refreshers.push(slider(mix, MIXN[k] || k, () => TUNE.mix[k], (v) => { TUNE.mix[k] = v; }, 0, 1, 0.01));

  const ret = $('fx-reticle'); ret.textContent = '';
  const rc = el('input', { type: 'color', value: TUNE.reticle.color, id: 'fx-ret-color' });
  rc.addEventListener('input', () => { TUNE.reticle.color = rc.value; showJson(); });
  const crow = el('div', { className: 'row' }, [el('label', { htmlFor: 'fx-ret-color', textContent: 'Colour' }), rc]);
  crow.refresh = () => { rc.value = TUNE.reticle.color; };
  refreshers.push(crow); ret.append(crow);
  const RET = [['size', 'Size', 0.3, 2, 0.05], ['ring', 'Ring width', 0.01, 0.2, 0.005], ['inner', 'Inner ring', 0, 1, 0.05], ['innerR', 'Inner radius', 0.15, 0.85, 0.01],
    ['cross', 'Cross-hair', 0, 1, 0.05], ['fill', 'Fill', 0, 0.6, 0.01], ['pulseFill', 'Fill pulse', 0, 0.6, 0.01], ['pulseSpeed', 'Pulse speed', 0, 30, 0.5], ['pulseDepth', 'Line pulse', 0, 1, 0.05], ['alpha', 'Opacity', 0, 1, 0.05]];
  for (const [k, lab, lo, hi, st] of RET) refreshers.push(slider(ret, lab, () => TUNE.reticle[k], (v) => { TUNE.reticle[k] = v; }, lo, hi, st));
  const keep = el('button', { textContent: 'Hold a reticle on screen' });
  keep.addEventListener('click', () => fireCannon(null));
  ret.append(el('div', { className: 'btns' }, [keep]));
}

function showJson() {
  $('fx-json').value = JSON.stringify(diffTune(TUNE), null, 1);
}

function wire() {
  const fs = $('fx-faction');
  for (const f of REG.FACTIONS) fs.append(el('option', { value: f.key, textContent: `${f.name} — ${PLANETS[f.key] ? PLANETS[f.key].name : ''}` }));
  const fillUnits = () => {
    const us = $('fx-unit'); us.textContent = '';
    us.append(el('option', { value: 'all', textContent: 'Every unit type' }));
    const c = carrierOf(REG.find(S.faction).name);
    if (c) us.append(el('option', { value: 'ability', textContent: `★ Special ability: ${c.row.name} (${c.id} + escort)` }));
    for (const u of factionUnits(UNITS, REG.find(S.faction).name)) us.append(el('option', { value: u.id, textContent: `${u.shape} (${u.id})` }));
    const want = S.abilityMode && c ? 'ability' : 'all';
    us.value = want; S.unit = want;
  };
  fs.addEventListener('change', () => { S.faction = fs.value; fillUnits(); buildArena(); });
  $('fx-unit').addEventListener('change', (e) => { S.unit = e.target.value; S.abilityMode = S.unit === 'ability'; clearUnits(); S.respawnIn = 0.2; });
  const rng = (id, key) => { const i = $(id), v = $(id + '-v'); i.addEventListener('input', () => { S[key] = +i.value; v.textContent = i.value; }); };
  rng('fx-count', 'count'); rng('fx-dist', 'dist');
  $('fx-utier').addEventListener('change', (e) => { S.utier = +e.target.value; });
  $('fx-loop').addEventListener('change', (e) => { S.loop = e.target.checked; });
  $('fx-spawn').addEventListener('click', spawnWave);
  $('fx-clear').addEventListener('click', clearUnits);

  const tw = $('fx-towers');
  for (const t of TOWERS) {
    const cb = el('input', { type: 'checkbox', checked: S.towers.has(t.id) });
    cb.addEventListener('change', () => { if (cb.checked) S.towers.add(t.id); else S.towers.delete(t.id); });
    tw.append(el('label', {}, [cb, t.name]));
  }
  $('fx-ttier').addEventListener('change', (e) => { S.ttier = +e.target.value; });
  $('fx-tcount').addEventListener('change', (e) => { S.tcount = +e.target.value; });
  $('fx-build').addEventListener('click', buildTowers);
  $('fx-notowers').addEventListener('click', () => { const t = S.towers; S.towers = new Set(); buildTowers(); S.towers = t; });

  $('fx-fire').addEventListener('click', () => fireCannon(null));
  const cf = $('fx-clickfire');
  cf.addEventListener('click', () => { S.clickFire = !S.clickFire; cf.classList.toggle('on', S.clickFire); cf.textContent = S.clickFire ? 'Click map to fire: ON' : 'Click map to fire'; });
  $('fx-blast').addEventListener('click', () => { if (S.r) R3.blowUpBase(S.r); });
  $('fx-rebuild').addEventListener('click', buildArena);

  const sp = $('fx-speed');
  for (const v of SPEEDS) {
    const b = el('button', { textContent: '×' + v, className: v === S.speed ? 'on' : '' });
    b.addEventListener('click', () => { S.speed = v; for (const x of sp.children) x.classList.toggle('on', x === b); });
    sp.append(b);
  }
  const pb = $('fx-pause');
  pb.addEventListener('click', () => { S.paused = !S.paused; pb.textContent = S.paused ? 'Play' : 'Pause'; pb.classList.toggle('on', S.paused); });
  $('fx-step').addEventListener('click', () => { S.stepOnce += 0.1; });

  $('fx-save').addEventListener('click', () => {
    const ok = saveTune(TUNE);
    $('fx-saved').textContent = ok ? `Saved. The game uses these effects in this browser (key ${FX_TUNE_KEY}). Reload an open game to see them.` : 'Could not save: browser storage is blocked.';
  });
  $('fx-reset').addEventListener('click', () => {
    setTune(defaultTune()); clearSavedTune();
    for (const r of refreshers) r.refresh && r.refresh();
    showJson(); $('fx-saved').textContent = 'Back to the shipped look. Saved tuning cleared.';
  });
  $('fx-copy').addEventListener('click', async () => {
    showJson();
    const txt = $('fx-json').value;
    try { await navigator.clipboard.writeText(txt); $('fx-saved').textContent = 'Copied. Paste it into the chat to bake these values into the game.'; }
    catch (e) { $('fx-json').select(); $('fx-saved').textContent = 'Select-all done: copy the text above.'; }
  });

  fillUnits();
}

let projFx = null;
async function loadProjFx() {
  try {
    const { mergeProjFx, PROJ_FX_LS_KEY } = await import('../render/projFx.js');
    let shipped = null, local = null;
    try { const res = await fetch('content/fx/projectiles.json'); if (res.ok) shipped = await res.json(); } catch (e) { /* optional */ }
    try { local = JSON.parse(localStorage.getItem(PROJ_FX_LS_KEY) || 'null'); } catch (e) { /* dev-live */ }
    projFx = mergeProjFx(shipped && shipped.units, local && (local.units || local));
  } catch (e) { projFx = null; }
}

// the default faction: the one in the query (?faction=dark), else Ground
const qf = new URLSearchParams(location.search).get('faction');
S.abilityMode = new URLSearchParams(location.search).has('ability');   // ?ability opens on the faction's special ability
if (qf && REG.find(qf)) S.faction = REG.find(qf).key;
wire();
$('fx-faction').value = S.faction;
buildTuning();
showJson();
window.BulwarkFxLab = S;   // for headless checks
loadProjFx().then(buildArena).catch((e) => { $('status').textContent = 'Could not load the arena: ' + e.message; });
requestAnimationFrame(tick);
