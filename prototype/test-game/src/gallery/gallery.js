/**
 * src/gallery/gallery.js — SHOOTING GALLERY: balance readout + live projectile range.
 *
 * Left panel picks a shooter (unit or tower) and a target (unit / armor class /
 * structure) and live-edits dps / damageType / aoe; the readout runs the REAL
 * combat path via calc.js. The right panel fires the REAL pooled projectile
 * layer (createProjectilePool — the shipping Tier A path) at a dummy whose HP
 * drains through the real applyDamage, so what you see is what the game does.
 *
 * Render-side only: Math.random is legal here (renderer.js uses the same
 * cadence jitter); every damage number still comes from the deterministic sim.
 * Needs global PIXI (vendor/pixi.min.js), loaded by gallery.html.
 */

import { UNITS, STRUCTURES, DAMAGE_TYPES, ASSUMPTIONS } from '../data/tables.js';
import { createProjectilePool } from '../render/projectiles.js';
import { cellToLocal, spawnFx, updateFx } from '../render/renderer.js';
import { applyDamage } from '../sim/combat.js';
import {
  makeState, makeUnitTarget, makeStructureTarget, makeArmorTarget,
  unitShooter, towerShooter, measure, splashHits, retuneDiff,
} from './calc.js';

const $ = (id) => document.getElementById(id);

/* ── renderer.js cosmetic defaults (emitCombatFx) — the gallery starts every
      pick at exactly what the game fires, then lets you tune from there ── */
const SHOT_SIZE = { shell: 0.022, flak: 0.03, tracer: 0.0075 };
const GROUNDED_SHAPES = { 'Tanks': 1, 'Heavy Tanks': 1, 'Artillery': 1 };
function gameFxDefaults(shooter) {
  if (shooter.structId === 'STR-Cannon') return { kind: 'shell', color: 0xffd080, speed: 13, cadence: 0.55, burst: 4 };
  if (shooter.structId === 'STR-Flak') return { kind: 'flak', color: 0x9fd4ff, speed: 18, cadence: 0.35, burst: 1 };
  const kind = GROUNDED_SHAPES[shooter.shape] ? 'shell' : 'tracer';
  return { kind, color: 0xff9a70, speed: 15, cadence: 0.6, burst: 1 };   // attacker-side unit tracers/shells
}

const ARMOR_CLASSES = ['Organic', 'Machinery', 'Aircraft', 'Structure', 'Energy'];
const fmt = (n, d = 2) => (n === Infinity ? '∞' : (Math.round(n * 10 ** d) / 10 ** d).toString());

export function bootGallery() {
  /* ────────────────────────── selection state ────────────────────────── */
  const sel = {
    shooterKind: 'unit', shooterUnit: 'GND-Tanks', shooterStruct: 'STR-Cannon', shooterTier: 1,
    edits: {},                                     // live-tuned {dps, damageType, aoeRadius}
    targetMode: 'unit', targetUnit: 'AIR-Troops', targetTier: 1,
    targetArmor: 'Machinery', targetHp: 300, targetStruct: 'STR-Cannon', targetStructTier: 1,
  };

  const factions = [...new Set(Object.values(UNITS).map((u) => u.faction))];
  const unitsOf = (fac) => Object.keys(UNITS).filter((id) => UNITS[id].faction === fac);
  const armedTowers = Object.keys(STRUCTURES).filter((id) => (STRUCTURES[id].dps[0] || 0) > 0);

  function fillSelect(el, entries, value) {
    el.innerHTML = '';
    for (const [v, label] of entries) {
      const o = document.createElement('option'); o.value = v; o.textContent = label; el.appendChild(o);
    }
    if (value !== undefined) el.value = value;
  }

  /* ── shooter pickers ── */
  fillSelect($('shooter-faction'), factions.map((f) => [f, f]), UNITS[sel.shooterUnit].faction);
  function fillShooterUnits() {
    const ids = unitsOf($('shooter-faction').value);
    fillSelect($('shooter-unit'), ids.map((id) => [id, `${UNITS[id].shape} — ${UNITS[id].role}`]));
    if (!ids.includes(sel.shooterUnit)) sel.shooterUnit = ids[0];
    $('shooter-unit').value = sel.shooterUnit;
  }
  fillShooterUnits();
  fillSelect($('shooter-struct'), armedTowers.map((id) => [id, STRUCTURES[id].name]), sel.shooterStruct);
  fillSelect($('edit-type'), Object.keys(DAMAGE_TYPES).map((t) => [t, t]));

  /* ── target pickers ── */
  fillSelect($('target-faction'), factions.map((f) => [f, f]), UNITS[sel.targetUnit].faction);
  function fillTargetUnits() {
    const ids = unitsOf($('target-faction').value);
    fillSelect($('target-unit'), ids.map((id) => [id, `${UNITS[id].shape} — ${UNITS[id].armorClass}`]));
    if (!ids.includes(sel.targetUnit)) sel.targetUnit = ids[0];
    $('target-unit').value = sel.targetUnit;
  }
  fillTargetUnits();
  fillSelect($('target-armor'), ARMOR_CLASSES.map((a) => [a, a]), sel.targetArmor);
  fillSelect($('target-struct'), Object.keys(STRUCTURES).map((id) => [id, STRUCTURES[id].name]), sel.targetStruct);

  /* ────────────────────────── model builders ────────────────────────── */
  function buildShooter() {
    return sel.shooterKind === 'tower'
      ? towerShooter(sel.shooterStruct, sel.shooterTier, sel.edits)
      : unitShooter(sel.shooterUnit, sel.shooterTier, sel.edits);
  }
  function buildTarget() {
    if (sel.targetMode === 'armor') {
      const domain = sel.targetArmor === 'Aircraft' ? 'Flyer' : 'Walker';
      return makeArmorTarget(sel.targetArmor, sel.targetHp, domain);
    }
    if (sel.targetMode === 'struct') return makeStructureTarget(sel.targetStruct, sel.targetStructTier);
    return makeUnitTarget(sel.targetUnit, sel.targetTier);
  }

  /* ────────────────────────── readout + diff ────────────────────────── */
  function recompute() {
    const shooter = buildShooter();
    const target = buildTarget();
    const m = measure(shooter, target);
    const splash = splashHits(shooter, target);

    $('r-legal').textContent = m.legal ? 'yes' : 'NO — weapon domain can’t reach this target';
    $('r-legal').style.color = m.legal ? '' : '#e05a5a';
    $('r-mult').textContent = fmt(m.mult) + '×';
    $('r-raw').textContent = fmt(shooter.dps, 1);
    $('r-eff').textContent = fmt(m.effDps, 1);
    $('r-hp').textContent = fmt(target.maxHp, 0);
    $('r-ttk').textContent = m.ttk === Infinity ? '∞ (never dies)' : fmt(m.ttk) + ' s';
    $('r-splash').textContent = splash ? `${splash} extra @ 0.8-tile pack` : '—';
    $('r-cluster').textContent = splash ? fmt(m.effDps * (1 + splash), 1) : '—';
    $('r-status').textContent = m.status || 'none';

    // Retune diff (units only; towers aren't retuned from here).
    let diff = '';
    if (sel.shooterKind === 'unit' && Object.keys(sel.edits).length) {
      const t1 = { ...sel.edits };
      if (t1.dps !== undefined && sel.shooterTier > 1) {   // field edits fire-tier dps; the table wants T1
        const x = sel.shooterTier === 2 ? 1.55 : 2.3;
        t1.dps = Math.round((t1.dps / x) * 1000) / 1000;
      }
      diff = retuneDiff(sel.shooterUnit, t1);
    }
    $('diff-out').textContent = diff || '— tune dps / type / aoe above and the paste-able tables.js diff appears here —';
    $('copy-diff').disabled = !diff;

    view.configure(shooter, target, m, gameFxDefaultsDirty ? null : gameFxDefaults(shooter));
  }

  /* ── shooter events ── */
  let gameFxDefaultsDirty = false;   // once you touch the FX sliders, selection changes stop resetting them
  function syncEditFields() {
    const shooter = sel.shooterKind === 'tower'
      ? towerShooter(sel.shooterStruct, sel.shooterTier)
      : unitShooter(sel.shooterUnit, sel.shooterTier);
    $('edit-dps').value = shooter.dps;
    $('edit-type').value = shooter.damageType;
    $('edit-aoe').value = shooter.aoeRadius;
    $('shooter-range').textContent = fmt(shooter.range, 2) + ' tiles';
  }
  function pickShooter() { sel.edits = {}; syncEditFields(); recompute(); }
  $('shooter-kind').onchange = (e) => {
    sel.shooterKind = e.target.value;
    $('shooter-unit-row').style.display = sel.shooterKind === 'unit' ? '' : 'none';
    $('shooter-faction-row').style.display = sel.shooterKind === 'unit' ? '' : 'none';
    $('shooter-struct-row').style.display = sel.shooterKind === 'tower' ? '' : 'none';
    pickShooter();
  };
  $('shooter-faction').onchange = () => { fillShooterUnits(); sel.shooterUnit = $('shooter-unit').value; pickShooter(); };
  $('shooter-unit').onchange = (e) => { sel.shooterUnit = e.target.value; pickShooter(); };
  $('shooter-struct').onchange = (e) => { sel.shooterStruct = e.target.value; pickShooter(); };
  $('shooter-tier').oninput = (e) => { sel.shooterTier = Number(e.target.value); $('shooter-tier-num').textContent = 'T' + sel.shooterTier; pickShooter(); };

  /* ── live edits ── */
  const table = () => (sel.shooterKind === 'tower'
    ? towerShooter(sel.shooterStruct, sel.shooterTier)
    : unitShooter(sel.shooterUnit, sel.shooterTier));
  const setEdit = (key, v) => {
    if (v === table()[key]) delete sel.edits[key]; else sel.edits[key] = v;
    recompute();
  };
  $('edit-dps').oninput = (e) => { const v = Number(e.target.value); if (isFinite(v) && v >= 0) setEdit('dps', v); };
  $('edit-type').onchange = (e) => setEdit('damageType', e.target.value);
  $('edit-aoe').oninput = (e) => { const v = Number(e.target.value); if (isFinite(v) && v >= 0) setEdit('aoeRadius', v); };
  $('edit-reset').onclick = pickShooter;

  /* ── target events ── */
  $('target-mode').onchange = (e) => {
    sel.targetMode = e.target.value;
    for (const [mode, ids] of [['unit', ['target-faction-row', 'target-unit-row']],
                               ['armor', ['target-armor-row']],
                               ['struct', ['target-struct-row']]]) {
      for (const id of ids) $(id).style.display = sel.targetMode === mode ? '' : 'none';
    }
    recompute();
  };
  $('target-faction').onchange = () => { fillTargetUnits(); sel.targetUnit = $('target-unit').value; recompute(); };
  $('target-unit').onchange = (e) => { sel.targetUnit = e.target.value; recompute(); };
  $('target-tier').oninput = (e) => { sel.targetTier = Number(e.target.value); $('target-tier-num').textContent = 'T' + sel.targetTier; recompute(); };
  $('target-armor').onchange = (e) => { sel.targetArmor = e.target.value; recompute(); };
  $('target-hp').oninput = (e) => { const v = Number(e.target.value); if (isFinite(v) && v > 0) { sel.targetHp = v; recompute(); } };
  $('target-struct').onchange = (e) => { sel.targetStruct = e.target.value; recompute(); };
  $('target-struct-tier').oninput = (e) => { sel.targetStructTier = Number(e.target.value); $('target-struct-tier-num').textContent = 'T' + sel.targetStructTier; recompute(); };

  $('copy-diff').onclick = async () => {
    try { await navigator.clipboard.writeText($('diff-out').textContent); $('copy-diff').textContent = 'Copied ✓'; }
    catch { $('copy-diff').textContent = 'Select + copy manually'; }
    setTimeout(() => { $('copy-diff').textContent = 'Copy retune diff'; }, 1400);
  };

  /* ══════════════════════ the range view (Pixi) ══════════════════════ */
  const view = createRangeView($('gallery-mount'));

  /* FX controls → view */
  const fxInput = (id, fn) => { $(id).oninput = (e) => { gameFxDefaultsDirty = true; fn(e); view.applyFx(readFx()); }; };
  function readFx() {
    return {
      kind: $('fx-kind').value,
      color: parseInt($('fx-color').value.slice(1), 16),
      speed: Number($('fx-speed').value),
      size: Number($('fx-size').value),
      cadence: Number($('fx-cadence').value),
      burst: Number($('fx-burst').value),
    };
  }
  fxInput('fx-kind', () => {});
  fxInput('fx-color', () => {});
  fxInput('fx-speed', (e) => { $('fx-speed-num').textContent = e.target.value; });
  fxInput('fx-size', (e) => { $('fx-size-num').textContent = e.target.value + '×'; });
  fxInput('fx-cadence', (e) => { $('fx-cadence-num').textContent = e.target.value + ' s'; });
  fxInput('fx-burst', (e) => { $('fx-burst-num').textContent = '×' + e.target.value; });
  $('fx-kind').onchange = $('fx-kind').oninput; $('fx-color').onchange = $('fx-color').oninput;
  $('fx-auto').onchange = (e) => view.setAutoFire(e.target.checked);
  $('fx-shot').onclick = () => view.fireOnce();
  $('fx-defaults').onclick = () => { gameFxDefaultsDirty = false; recompute(); };

  // The view reports its FX config back so the sliders mirror game defaults on selection change.
  view.onFxApplied = (fx) => {
    $('fx-kind').value = fx.kind;
    $('fx-color').value = '#' + fx.color.toString(16).padStart(6, '0');
    $('fx-speed').value = fx.speed; $('fx-speed-num').textContent = fx.speed;
    $('fx-size').value = fx.size; $('fx-size-num').textContent = fx.size + '×';
    $('fx-cadence').value = fx.cadence; $('fx-cadence-num').textContent = fx.cadence + ' s';
    $('fx-burst').value = fx.burst; $('fx-burst-num').textContent = '×' + fx.burst;
  };

  recompute();   // boot: shooter/target defaults → readout + first scene
}

/* ═══════════════════════════════════════════════════════════════════════════
   Range view — a Pixi scene that drives the GAME's FX engine verbatim.

   No FX are drawn here: shots fly through createProjectilePool, impacts/
   flames/glows/shake all happen inside renderer.updateFx / renderer.spawnFx
   running against a minimal renderer-shim, so what you see IS what the game
   renders — the gallery only supplies the stage, the turret/dummy primitives
   and the tool overlays (HP bar, damage numbers, kill counter).
   ═══════════════════════════════════════════════════════════════════════════ */
function createRangeView(mount) {
  const W = 920, H = 520, T = 50;                       // px, tile size
  const app = new PIXI.Application({ width: W, height: H, background: 0x0a0f14, antialias: true });
  mount.appendChild(app.view);

  const root = new PIXI.Container();                    // shim.root — camera shake offsets this, like the game
  app.stage.addChild(root);

  /* static backdrop: horizon + ground + range ticks */
  const back = new PIXI.Graphics();
  back.beginFill(0x0d141b).drawRect(0, 0, W, H * 0.62).endFill();
  back.beginFill(0x111a14).drawRect(0, H * 0.62, W, H * 0.38).endFill();
  back.lineStyle(1, 0x26313c, 1).moveTo(0, H * 0.62).lineTo(W, H * 0.62);
  root.addChild(back);
  const ticks = new PIXI.Graphics();
  root.addChild(ticks);

  const actors = new PIXI.Graphics();                   // turret + dummy primitives (redrawn per frame)
  root.addChild(actors);

  /* renderer-SHIM: the minimal surface renderer.updateFx/spawnFx touch. The FX
     code itself is imported from renderer.js — identical draw, layer order
     (projectiles under fxG, glows/text on top; renderer.js:423) and constants. */
  const pool = createProjectilePool();
  const fxLayer = new PIXI.Container();
  const fxG = new PIXI.Graphics();
  fxLayer.addChild(pool.container);
  fxLayer.addChild(fxG);
  root.addChild(fxLayer);
  const R = {
    tile: T, fxG, dustG: null,
    fxItems: [], flames: [], glows: [], goldFloats: [],
    projectiles: null,                                  // wrapped below: game impact FX + gallery damage hook
    layers: { fx: fxLayer, structHp: fxLayer },
    shake: { time: 0, dur: 0, mag: 0 },
    root, camera: { x: 0, y: 0 },
    baseFire: 0, baseFirePos: null,
    _fxDt: 1 / 60,
  };
  R.projectiles = {
    container: pool.container,
    spawn: (...a) => pool.spawn(...a),
    clear: () => pool.clear(),
    // updateFx passes the game's impact callback; the gallery adds its damage hook after it
    update: (dt, gameImpact) => pool.update(dt, (kind, x, y) => { gameImpact(kind, x, y); onHit(kind, x, y); }),
  };

  const caption = new PIXI.Text('', { fontFamily: 'system-ui', fontSize: 13, fill: 0x8ea0b0 });
  caption.position.set(12, H - 24); app.stage.addChild(caption);
  const killText = new PIXI.Text('', { fontFamily: 'system-ui', fontSize: 13, fill: 0x5ae08a });
  killText.position.set(12, 12); app.stage.addChild(killText);

  /* damage-number pool (tool overlay, not a game effect) */
  const dmgPool = []; const dmgLive = [];
  function popDamage(x, y, txt, color) {
    const t = dmgPool.pop() || new PIXI.Text('', { fontFamily: 'system-ui', fontSize: 12, fontWeight: '700', fill: 0xffffff });
    t.text = txt; t.style.fill = color; t.alpha = 1; t.position.set(x + (Math.random() * 12 - 6), y - 14);
    app.stage.addChild(t); dmgLive.push({ t, age: 0 });
  }

  const st = {
    shooter: null, target: null, victim: null, fx: gameDefaultsFallback(),
    auto: true, clock: 0, next: 0, queue: [],
    spawnAt: 0, kills: 0, lastKill: null, respawnAt: null,
    cell: { sx: 1.3, sy: 0, tx: 7, ty: 0 },             // CELL coords, like the sim — px via cellToLocal
    sx: 90, sy: 0, tx: 0, ty: 0, aim: 0, effDps: 0, legal: true,
  };
  function gameDefaultsFallback() { return { kind: 'shell', color: 0xff9a70, speed: 15, cadence: 0.6, burst: 1 }; }

  const groundRow = (H * 0.62 + 60) / T - 0.5;          // cell row whose center sits on the ground line
  function layout() {
    const range = Math.max(1.5, Math.min(13, (st.shooter && st.shooter.range) || 6));
    st.cell.sx = 1.3; st.cell.sy = groundRow;
    st.cell.tx = st.cell.sx + range; st.cell.ty = groundRow;
    const s = cellToLocal(R, st.cell.sx, st.cell.sy);
    const p = cellToLocal(R, st.cell.tx, st.cell.ty);
    const air = st.target && st.target.domain === 'Flyer';
    st.sx = s.x; st.sy = s.y;
    st.tx = p.x; st.ty = p.y - (air ? T * 1.05 : 0);    // flyers lift t*1.05 — same as emitCombatFx
    ticks.clear(); ticks.lineStyle(1, 0x1b232c, 1);
    for (let i = 1; i <= 13; i++) { const x = st.sx + i * T; ticks.moveTo(x, st.sy + 14).lineTo(x, st.sy + (i % 5 ? 18 : 24)); }
    caption.text = `range ${((st.shooter && st.shooter.range) || 0).toFixed(2)} tiles · ticks = 1 tile · ${st.legal ? 'live fire' : 'HOLD — illegal target domain'}`;
  }

  const rv = {
    onFxApplied: null,
    /** New shooter/target selection from the panel. */
    configure(shooter, target, m, fxDefaults) {
      st.shooter = shooter; st.target = target; st.effDps = m.effDps; st.legal = m.legal && m.effDps > 0;
      if (fxDefaults) { st.fx = fxDefaults; if (rv.onFxApplied) rv.onFxApplied(st.fx); }
      st.victim = { ...target, pos: { ...target.pos } };
      st.spawnAt = st.clock; st.respawnAt = null; st.queue.length = 0;
      R.projectiles.clear(); R.fxItems.length = 0; R.flames.length = 0;   // glows fade out on their own
      layout();
    },
    applyFx(fx) { st.fx = fx; },
    setAutoFire(on) { st.auto = on; },
    fireOnce() { volley(); },
  };

  /* one volley — mirrors renderer.js fire(): burst stagger 0.07s + impact jitter t*0.16.
     No muzzle flash: units don't have one in-game (only the base super-cannon does). */
  function volley() {
    if (!st.legal || !st.victim || st.victim.hp <= 0) return;
    const n = Math.max(1, st.fx.burst | 0);
    const muzzleX = st.sx + Math.cos(st.aim) * T * 0.55, muzzleY = st.sy - T * 0.32 + Math.sin(st.aim) * T * 0.55;
    for (let k = 0; k < n; k++) {
      const jx = n > 1 ? (Math.random() * 2 - 1) * T * 0.16 : 0;
      const jy = n > 1 ? (Math.random() * 2 - 1) * T * 0.16 : 0;
      const args = [muzzleX, muzzleY, st.tx + jx, st.ty + jy, st.fx.speed * T, st.fx.color, st.fx.kind, T * (SHOT_SIZE[st.fx.kind] || 0.0075) * st.fx.size];
      if (k === 0) R.projectiles.spawn(...args);
      else st.queue.push({ at: st.clock + k * 0.07, args });
    }
  }

  /* Gallery damage hook — runs AFTER the game's own impact FX (see the
     projectiles wrapper on the shim). Impact visuals are entirely updateFx's. */
  function onHit(kind, x, y) {
    if (!(st.victim && st.victim.hp > 0 && st.legal && st.shooter)) return;
    const shotDt = st.fx.cadence / Math.max(1, st.fx.burst | 0);
    const r = applyDamage(makeState(), null, st.victim, st.shooter.dps, st.shooter.damageType, shotDt);
    if (r.dealt > 0) popDamage(st.tx, st.ty, '-' + (Math.round(r.dealt * 10) / 10), 0xffe9c9);
    if (r.killed) {
      st.kills++; st.lastKill = st.clock - st.spawnAt; st.respawnAt = st.clock + 1.4;
      // death FX = the game's OWN event pipeline: units get the 'kill' ring +
      // radius-scaled wreck fire + bloom (+Ng bounty float); structures get
      // 'destroyed' (shake + debris ring + big 5s fire). renderer.spawnFx verbatim.
      const pos = { x: st.cell.tx, y: st.cell.ty };
      if (st.victim.structId !== undefined) {
        spawnFx(R, { type: 'destroyed', pos });
      } else {
        const income = st.victim.costT1 ? ASSUMPTIONS.killIncomeFrac * st.victim.costT1 : 0;
        spawnFx(R, { type: 'kill', pos, radius: st.victim.radius, income });
      }
    }
  }

  app.ticker.add(() => {
    const dt = Math.min(0.05, app.ticker.deltaMS / 1000);
    st.clock += dt;

    // cadence (renderer jitter: ×0.85–1.15) + queued burst rounds
    if (st.auto && st.clock >= st.next) { volley(); st.next = st.clock + st.fx.cadence * (0.85 + Math.random() * 0.3); }
    if (st.queue.length) {
      const due = []; st.queue = st.queue.filter((q) => (st.clock >= q.at ? (due.push(q), false) : true));
      for (const q of due) R.projectiles.spawn(...q.args);
    }

    // ── the game's FX engine, verbatim: advances projectiles (firing the game
    // impact recipes + our damage hook), flames, glows, shake, and draws fxItems.
    R._fxDt = Math.min(dt, 1 / 20);                     // same clamp as renderFrame (renderer.js:1032)
    updateFx(R);

    // respawn the dummy after a kill (the game wreck fire keeps burning meanwhile)
    if (st.respawnAt !== null && st.clock >= st.respawnAt && st.target) {
      st.victim = { ...st.target, pos: { ...st.target.pos } };
      st.spawnAt = st.clock; st.respawnAt = null;
    }
    killText.text = st.kills ? `kills ${st.kills} · last kill ${st.lastKill.toFixed(2)} s` : '';

    /* actors (tool primitives — the FX around them are the game's) */
    st.aim = Math.atan2(st.ty - (st.sy - T * 0.32), st.tx - st.sx);
    actors.clear();
    actors.beginFill(0x1b232c).drawEllipse(st.sx, st.sy + 4, T * 0.5, T * 0.16).endFill();
    actors.beginFill(0x2f3d4a).drawRoundedRect(st.sx - T * 0.3, st.sy - T * 0.34, T * 0.6, T * 0.36, 4).endFill();
    actors.lineStyle(6, 0x46586a, 1).moveTo(st.sx, st.sy - T * 0.32)
      .lineTo(st.sx + Math.cos(st.aim) * T * 0.55, st.sy - T * 0.32 + Math.sin(st.aim) * T * 0.55).lineStyle(0);
    // dummy target: shadow, crate (bobbing if airborne), HP bar
    if (st.victim) {
      const air = st.target.domain === 'Flyer';
      const bob = air ? Math.sin(st.clock * 2.2) * 4 : 0;
      const dead = st.victim.hp <= 0;
      actors.beginFill(0x000000, air ? 0.25 : 0.35).drawEllipse(st.tx, st.sy + 4, T * 0.4, T * 0.13).endFill();
      if (!dead) {
        const y = st.ty + bob;
        actors.beginFill(air ? 0x3a4a5c : 0x4a4034).lineStyle(2, 0x26313c, 1)
          .drawRoundedRect(st.tx - T * 0.32, y - T * 0.32, T * 0.64, T * 0.64, 6).endFill().lineStyle(0);
        const frac = Math.max(0, st.victim.hp / st.victim.maxHp);
        actors.beginFill(0x10151b).drawRect(st.tx - T * 0.4, y - T * 0.58, T * 0.8, 6).endFill();
        actors.beginFill(frac > 0.5 ? 0x5ae08a : frac > 0.25 ? 0xe0c05a : 0xe05a5a)
          .drawRect(st.tx - T * 0.4, y - T * 0.58, T * 0.8 * frac, 6).endFill();
      }
      // splash-radius ghost ring while the weapon has aoe
      if (st.shooter && st.shooter.aoeRadius > 0) {
        actors.lineStyle(1, 0x5fe0ff, 0.35).drawCircle(st.tx, st.ty, st.shooter.aoeRadius * T).lineStyle(0);
      }
    }

    /* damage numbers (tool overlay) */
    for (let i = dmgLive.length - 1; i >= 0; i--) {
      const d = dmgLive[i]; d.age += dt;
      d.t.y -= 26 * dt; d.t.alpha = 1 - d.age / 0.8;
      if (d.age >= 0.8) { app.stage.removeChild(d.t); dmgPool.push(d.t); dmgLive[i] = dmgLive[dmgLive.length - 1]; dmgLive.pop(); }
    }
  });

  return rv;
}
