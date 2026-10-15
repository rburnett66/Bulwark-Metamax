// T3.5 [MM-task_mv9s9p7h_4] — the 3D view's quality tiers: the table matches plan §7.1, auto-pick per device,
// ?quality= → Settings → auto precedence, the per-device choice survives broken storage, and Low's ground and
// effect budgets actually shrink what gets built.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as THREE from '../../vendor/three.module.js';
import { TIERS, TIER_KEYS, AUTO, QUALITY_LS_KEY, autoTier, parseTier, resolveTier, loadChoice, saveChoice, pixelRatioFor, settingsOptions, probeEnv } from './quality.js';
import { buildLowPolyGround, GRID } from './ground/lowpoly.js';
import { LOWPAL } from './styles/lowpoly-palettes.js';
import { createCombatFx } from './fx/combatFxModel.js';
import { buildTerrainMap } from '../sim/mapgen.js';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FORGE = JSON.parse(fs.readFileSync(path.join(GAME, 'content/maps/forge/powder-map-1.json'), 'utf8'));

test('the tier table is plan §7.1', () => {
  assert.deepEqual(TIER_KEYS, ['high', 'standard', 'low']);
  const row = (k) => { const t = TIERS[k]; return [t.dprCap, t.shadowSize, t.liveShadows, t.groundRes]; };
  assert.deepEqual(row('high'), [2, 4096, true, 1]);
  assert.deepEqual(row('standard'), [2, 2048, true, 1]);
  assert.deepEqual(row('low'), [1.5, 1024, false, 0.5]);
  const e = TIERS.low.effects;
  assert.equal(e.maxShots + e.maxFlashes, 120, 'Low effect cap 120');
  assert.ok(Object.isFrozen(TIERS.low) && Object.isFrozen(TIERS.low.effects));
});

test('auto-pick: desktop → High, the plan phones → Standard, weak or software GPUs → Low', () => {
  assert.equal(autoTier({ mobile: false, cores: 16, deviceMemory: 8, maxTextureSize: 16384, gpu: 'ANGLE (NVIDIA GeForce RTX 3070)' }), 'high');
  assert.equal(autoTier({ mobile: true, cores: 4, maxTextureSize: 16384, gpu: 'Apple GPU' }), 'standard', 'iPhone 12 (Safari reports little)');
  assert.equal(autoTier({ mobile: true, cores: 8, deviceMemory: 8, maxTextureSize: 16384, gpu: 'Mali-G78' }), 'standard', 'Pixel 6');
  assert.equal(autoTier({ mobile: false, gpu: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))' }), 'low');
  assert.equal(autoTier({ mobile: false, gpu: 'llvmpipe (LLVM 15.0.7, 256 bits)' }), 'low');
  assert.equal(autoTier({ mobile: true, deviceMemory: 2 }), 'low');
  assert.equal(autoTier({ mobile: true, cores: 2 }), 'low');
  assert.equal(autoTier({ mobile: true, gpu: 'Adreno (TM) 306' }), 'low');
  assert.equal(autoTier({ maxTextureSize: 2048 }), 'low');
  assert.equal(autoTier({}), 'high', 'nothing reported → desktop default');
});

test('precedence: ?quality= beats the Settings choice beats auto; junk values are ignored', () => {
  const desk = { mobile: false };
  assert.equal(resolveTier({ env: desk }).key, 'high');
  assert.equal(resolveTier({ env: desk }).source, 'auto');
  const s = resolveTier({ stored: 'low', env: desk });
  assert.deepEqual([s.key, s.source, s.choice, s.auto], ['low', 'settings', 'low', 'high']);
  const q = resolveTier({ query: 'standard', stored: 'low', env: desk });
  assert.deepEqual([q.key, q.source, q.choice], ['standard', 'query', 'low'], 'Settings still shows the saved choice');
  assert.equal(resolveTier({ query: 'ultra', stored: 'banana', env: desk }).source, 'auto');
  assert.equal(resolveTier({ query: 'auto', stored: 'low', env: desk }).key, 'low', '?quality=auto defers to Settings');
  assert.equal(resolveTier({ stored: 'auto', env: { mobile: true } }).key, 'standard');
  assert.equal(parseTier(' LOW '), 'low');
  assert.equal(parseTier(3), null);
});

test('the Settings choice is stored per device and never throws on broken storage', () => {
  const mem = new Map();
  const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
  assert.equal(loadChoice(storage), AUTO);
  assert.equal(saveChoice(storage, 'low'), 'low');
  assert.equal(mem.get(QUALITY_LS_KEY), 'low');
  assert.equal(loadChoice(storage), 'low');
  assert.equal(saveChoice(storage, 'nonsense'), AUTO);
  const broken = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceeded'); } };
  assert.equal(loadChoice(broken), AUTO);
  assert.equal(saveChoice(broken, 'high'), 'high');
  assert.equal(loadChoice(null), AUTO);
});

test('pixel ratio is capped by the tier; the menu names what Auto picked', () => {
  assert.equal(pixelRatioFor(TIERS.high, 3), 2);
  assert.equal(pixelRatioFor(TIERS.low, 3), 1.5);
  assert.equal(pixelRatioFor(TIERS.low, 1), 1);
  assert.equal(pixelRatioFor(TIERS.standard, 0), 1);
  const opts = settingsOptions('standard');
  assert.deepEqual(opts.map((o) => o.value), ['auto', 'high', 'standard', 'low']);
  assert.equal(opts[0].label, 'Auto (Standard)');
});

test('probeEnv reads what it can and survives a browser that reports nothing', () => {
  const gl = { getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 1 }), getParameter: (p) => (p === 1 ? 'Apple GPU' : 8192), MAX_TEXTURE_SIZE: 2 };
  const win = { navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', hardwareConcurrency: 4 }, matchMedia: () => ({ matches: true }) };
  assert.deepEqual(probeEnv(win, gl), { mobile: true, deviceMemory: 0, cores: 4, maxTextureSize: 8192, gpu: 'Apple GPU' });
  const throwing = { getExtension() { throw new Error('lost'); }, getParameter() { throw new Error('lost'); } };
  assert.deepEqual(probeEnv({}, throwing), { mobile: false, deviceMemory: 0, cores: 0, maxTextureSize: 0, gpu: '' });
});

test('Low builds half-resolution ground (a quarter of the facets) and no tufts; High/Standard are unchanged', () => {
  const map = buildTerrainMap(FORGE, 1, { seed: 0, bakeTune: {} });
  const full = buildLowPolyGround(THREE, map, LOWPAL.meadow || Object.values(LOWPAL)[0]);
  const low = buildLowPolyGround(THREE, map, LOWPAL.meadow || Object.values(LOWPAL)[0], { grid: GRID / TIERS.low.groundRes, tufts: TIERS.low.tufts });
  assert.equal(low.stats.triangles * 4, full.stats.triangles);
  assert.equal(low.stats.tufts, 0);
  assert.ok(full.stats.tufts > 0);
  const std = buildLowPolyGround(THREE, map, LOWPAL.meadow || Object.values(LOWPAL)[0], { grid: GRID / TIERS.standard.groundRes, tufts: TIERS.standard.tufts });
  assert.equal(std.stats.triangles, full.stats.triangles);
  assert.equal(std.stats.tufts, full.stats.tufts);
});

test('Low\'s effect budget caps the combat FX', () => {
  const fx = createCombatFx({ caps: TIERS.low.effects });
  assert.deepEqual(fx.caps, { maxShots: 80, maxFlashes: 40 });
  const st = { time: 0, units: new Map(), structures: new Map(), base: { pos: { x: 5, y: 5 } } };
  const evs = Array.from({ length: 200 }, (_, i) => ({ type: 'kill', pos: { x: i % 30, y: 0 } }));
  fx.update(st, { cols: 32, rows: 32 }, evs, 0, {});
  assert.equal(fx.flashes.length, 40);
});
