/**
 * storyMap.js — the Story Map view [MM-story_mwtlwk66_i] (epic MM-epic_mwtlwawp_f).
 *
 * One canvas timeline: planets as bands, the campaign as a glowing spine, every contract a branch that forks off it
 * where it becomes available, and its availability window drawn behind it. Themes light what matches and dim the rest;
 * a node or a branch opens the panel with its details, dialog and criteria. Wheel / pinch zooms time, drag pans.
 */
import { buildStory, criteriaOf, dialogOf, timeLabel, WAVES_PER_MAP, MAPS_PER_PLANET } from './storyModel.js';
import { PLANETS } from '../../src/data/planets.js';

const ROOT = '../../';
const KEYS = Object.keys(PLANETS);
const J = (p) => fetch(ROOT + p).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const slug = (name) => String(name).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
const portrait = (name) => `${ROOT}content/dialog/portraits/${slug(name)}.png`;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

const KIND = {
  campaign: { name: 'Campaign map', color: '#f2c869' },
  secondary: { name: 'Faction contract', color: '#8fd3ff' },
  outpost: { name: 'Outpost contract', color: '#7fe0a8' },
  farm: { name: 'Farm contract', color: '#c6e86a' },
  beat: { name: 'Wave-3 voice', color: '#ff9ed0' },
  milestone: { name: 'Milestone', color: '#b48cff' },
};
const VARIANT = { light: '#eaf2ff', shadow: '#9a6bff' };

// ─── load ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const [missions, threads, voicepacks, reveals, mapdata, ...charFiles] = await Promise.all([
  J('content/missions/missions.json'), J('content/characters/threads.json'), J('content/dialog/voicepacks.json'),
  J('content/reveals/reveals.json'), J('content/maps/mapdata.json'), ...KEYS.map((k) => J(`content/characters/${k}.json`)),
]);
const SRC = { missions, threads, voicepacks, reveals, mapdata, planets: PLANETS,
  characters: Object.fromEntries(KEYS.map((k, i) => [k, charFiles[i]]).filter(([, f]) => f)) };
const S = buildStory(SRC);
const byId = new Map(S.nodes.map((n) => [n.id, n]));
const branchOf = new Map(S.branches.map((b) => [b.id, b]));
const planetOf = Object.fromEntries(S.planets.map((p) => [p.name, p]));
const themeOf = Object.fromEntries(S.themes.map((t) => [t.id, t]));
const laneOf = Object.fromEntries(S.lanes.map((l) => [l.id, l]));

// the offer scene comes from the game's own dialog code (one code path); the map still works without it
let offerScene = null;
try { offerScene = (await import('../../src/comm/mapCast.js')).contractOfferScene; } catch (e) { offerScene = null; }

// planet globes, drawn in the bands
const globes = {};
for (const p of S.planets) if (p.key) { const im = new Image(); im.src = `${ROOT}content/planets/${p.key}.png`; globes[p.key] = im; im.onload = () => dirty(); }

// ─── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const stage = document.getElementById('stage');
const state = {
  k: 60, ox: 0, tk: 60, tox: 0,          // px per map slot, world x at the left edge (current and target)
  themes: new Set(), path: 'both', q: '',
  hover: null, hoverBranch: null, sel: null, selBranch: null,
  mouse: null, t0: performance.now(), intro: 0,
};
let W = 0, H = 0, DPR = 1, needs = true;
const dirty = () => { needs = true; };
const PAD_L = 132, TOP = 64, BOTTOM = 92;   // lane-label gutter, the HUD, the density strip

function resize() {
  const r = stage.getBoundingClientRect();
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = r.width; H = r.height;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  dirty();
}
window.addEventListener('resize', () => { resize(); });
resize();

const minK = () => (W - PAD_L - 24) / S.end;
function fit(animate = true) {
  state.tk = minK(); state.tox = 0;
  if (!animate) { state.k = state.tk; state.ox = state.tox; }
  dirty();
}
fit(false);

const sx = (t) => PAD_L + (t - state.ox) * state.k;
const tx = (x) => (x - PAD_L) / state.k + state.ox;
const HEAD = 58;   // planet header + map numbers above the first lane
const laneH = () => (H - TOP - BOTTOM - HEAD - 16) / 7.6;
const sy = (lane) => TOP + HEAD + laneOf[lane].y * laneH();

// ─── filters ──────────────────────────────────────────────────────────────────────────────────────────────────────
function pathHidden(n) {
  if (state.path === 'both') return false;
  return (n.variant === 'light' && state.path === 'shadow') || (n.variant === 'shadow' && state.path === 'light');
}
function matchesQuery(n) {
  if (!state.q) return true;
  const q = state.q.toLowerCase();
  return [n.title, n.id, n.planet, ...(n.people || [])].some((s) => s && String(s).toLowerCase().includes(q));
}
/** 1 = fully lit; lower = dimmed. */
function emphasis(n) {
  if (pathHidden(n)) return 0.06;
  if (!matchesQuery(n)) return 0.1;
  if (!state.themes.size) return 1;
  return n.themes.some((t) => state.themes.has(t)) ? 1 : 0.13;
}
const litThemes = (n) => n.themes.filter((t) => state.themes.has(t));

// ─── background: stars, pre-rendered once per size ────────────────────────────────────────────────────────────────
let starCanvas = null;
function stars() {
  if (starCanvas && starCanvas.width === cv.width && starCanvas.height === cv.height) return starCanvas;
  starCanvas = document.createElement('canvas');
  starCanvas.width = cv.width; starCanvas.height = cv.height;
  const c = starCanvas.getContext('2d');
  const g = c.createRadialGradient(cv.width * 0.3, cv.height * 0.2, 0, cv.width * 0.3, cv.height * 0.2, cv.width);
  g.addColorStop(0, '#0f1828'); g.addColorStop(0.6, '#080c14'); g.addColorStop(1, '#05070c');
  c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 520; i++) {
    const x = rnd() * cv.width, y = rnd() * cv.height, r = rnd() * 1.1 * DPR + 0.2;
    c.globalAlpha = 0.15 + rnd() * 0.55;
    c.fillStyle = rnd() > 0.85 ? '#ffe7b8' : rnd() > 0.7 ? '#b8d4ff' : '#ffffff';
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  return starCanvas;
}

// ─── geometry: branch paths ───────────────────────────────────────────────────────────────────────────────────────
/** The points a branch passes through in screen space: its fork on the spine, then its nodes. */
function branchPoints(b) {
  const list = b.nodes.map((id) => byId.get(id));
  const pts = list.map((n) => ({ x: sx(n.x), y: sy(n.lane), n }));
  if (b.forks && list.length) {
    const f = list[0];
    const forkLane = f.kind === 'outpost' ? 'spine' : 'spine';
    pts.unshift({ x: sx(f.from), y: sy(forkLane), fork: true });
  }
  return pts;
}
function tracePath(pts) {
  const path = new Path2D();
  if (!pts.length) return path;
  path.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (Math.abs(a.y - b.y) < 0.5) path.lineTo(b.x, b.y);
    else {
      const mx = a.x + Math.max(14, (b.x - a.x) * 0.6);
      path.bezierCurveTo(mx, a.y, a.x + (b.x - a.x) * 0.4, b.y, b.x, b.y);
    }
  }
  return path;
}
/** Sampled polyline for hit-testing a branch. */
function samplePts(pts) {
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (Math.abs(a.y - b.y) < 0.5) { out.push([a.x, a.y], [b.x, b.y]); continue; }
    const c1 = [a.x + Math.max(14, (b.x - a.x) * 0.6), a.y], c2 = [a.x + (b.x - a.x) * 0.4, b.y];
    for (let s = 0; s <= 12; s++) {
      const u = s / 12, v = 1 - u;
      out.push([v * v * v * a.x + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * b.x,
        v * v * v * a.y + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * b.y]);
    }
  }
  return out;
}

// ─── drawing ──────────────────────────────────────────────────────────────────────────────────────────────────────
let hitNodes = [], hitBranches = [];
function draw(now) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.drawImage(stars(), 0, 0, W, H);
  const intro = state.intro;
  const t0 = tx(PAD_L - 40), t1 = tx(W + 40);
  const LH = laneH();
  const top = TOP, bottom = H - BOTTOM;

  // planet bands
  for (const [i, p] of S.planets.entries()) {
    const a = sx(p.from), b = sx(p.to);
    if (b < PAD_L - 10 || a > W) continue;
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, hexA(p.color, i % 2 ? 0.07 : 0.1)); g.addColorStop(1, hexA(p.color, 0.015));
    ctx.fillStyle = g; ctx.fillRect(a, top, b - a, bottom - top);
    ctx.strokeStyle = hexA(p.color, 0.28); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(a + 0.5, top); ctx.lineTo(a + 0.5, bottom); ctx.stroke();
    // header: globe + name, sticky inside the band
    const hx = clamp(a + 10, PAD_L + 6, Math.max(PAD_L + 6, b - 150));
    const im = p.key && globes[p.key];
    if (im && im.complete && im.naturalWidth) {
      ctx.save(); ctx.globalAlpha = 0.95; ctx.shadowColor = p.color; ctx.shadowBlur = 14;
      ctx.drawImage(im, hx, top + 4, 22, 22); ctx.restore();
    }
    if (b - a > 70) {
      ctx.fillStyle = p.color; ctx.font = '800 12px "Segoe UI", system-ui'; ctx.textBaseline = 'middle';
      ctx.fillText(p.name.toUpperCase(), hx + 28, top + 15);
      ctx.fillStyle = hexA('#ffffff', 0.35); ctx.font = '600 9.5px "Segoe UI", system-ui';
      ctx.fillText(`PLANET ${i + 1}`, hx + 28 + ctx.measureText(p.name.toUpperCase()).width * 1.18 + 8, top + 15.5);
    }
  }
  // map ticks and, zoomed in, wave ticks
  ctx.textBaseline = 'alphabetic';
  for (let t = Math.max(0, Math.floor(t0)); t <= Math.min(S.end, Math.ceil(t1)); t++) {
    const x = sx(t);
    if (x < PAD_L - 1) continue;
    const planetEdge = t % MAPS_PER_PLANET === 0;
    ctx.strokeStyle = planetEdge ? 'rgba(255,255,255,.0)' : 'rgba(150,180,220,.07)';
    ctx.beginPath(); ctx.moveTo(x + 0.5, top + 30); ctx.lineTo(x + 0.5, bottom); ctx.stroke();
    if (t < S.end && state.k > 26) {
      ctx.fillStyle = 'rgba(190,210,235,.45)'; ctx.font = '600 9.5px "Segoe UI", system-ui';
      const lbl = state.k > 70 ? `MAP ${(t % MAPS_PER_PLANET) + 1}` : String((t % MAPS_PER_PLANET) + 1);
      ctx.fillText(lbl, x + 5, top + 40);
    }
    if (t < S.end && state.k > 260) {
      for (let w = 1; w <= WAVES_PER_MAP; w++) {
        const wx = sx(t + (w - 0.5) / WAVES_PER_MAP);
        ctx.fillStyle = w === 3 ? 'rgba(255,158,208,.55)' : 'rgba(160,190,230,.22)';
        ctx.fillRect(wx - 0.5, bottom - 10, 1, 6);
        if (state.k > 520) { ctx.font = '600 8.5px "Segoe UI", system-ui'; ctx.fillText('W' + w, wx - 6, bottom - 13); }
      }
    }
  }

  // lane guides + labels gutter
  for (const l of S.lanes) {
    const y = sy(l.id);
    ctx.strokeStyle = l.id === 'spine' ? 'rgba(242,200,105,.0)' : 'rgba(140,170,210,.06)';
    ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W, y); ctx.stroke(); ctx.setLineDash([]);
  }

  // the clip: everything time-based is drawn right of the gutter
  ctx.save();
  ctx.beginPath(); ctx.rect(PAD_L, top, W - PAD_L, bottom - top); ctx.clip();
  const reveal = PAD_L + (W - PAD_L) * easeOut(intro);
  ctx.beginPath(); ctx.rect(PAD_L, top, reveal - PAD_L, bottom - top); ctx.clip();

  // availability windows (behind everything)
  const r = Math.max(3, Math.min(9, LH * 0.16));
  for (const n of S.nodes) {
    if (n.kind === 'milestone' || n.kind === 'beat' || n.kind === 'campaign') continue;
    const a = sx(n.from), b = sx(n.due);
    if (b < PAD_L || a > W) continue;
    const e = emphasis(n), y = sy(n.lane);
    const col = n.variant ? VARIANT[n.variant] : KIND[n.kind].color;
    const active = state.sel === n || state.hover === n || (state.selBranch && state.selBranch.nodes.includes(n.id));
    const g = ctx.createLinearGradient(a, 0, b, 0);
    g.addColorStop(0, hexA(col, (active ? 0.32 : 0.14) * e)); g.addColorStop(1, hexA(col, 0.02 * e));
    ctx.fillStyle = g;
    roundRect(ctx, a, y - r * 1.25, Math.max(2, b - a), r * 2.5, r * 1.25); ctx.fill();
    if (active) {   // "players can always return": the open tail to the end of the story
      ctx.strokeStyle = hexA(col, 0.4); ctx.setLineDash([3, 5]); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(b, y); ctx.lineTo(sx(S.end), y); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // the spine
  const spineY = sy('spine');
  for (const p of S.planets) {
    const a = sx(p.from), b = sx(p.to);
    if (b < PAD_L || a > W) continue;
    ctx.save();
    ctx.shadowColor = p.color; ctx.shadowBlur = 16;
    const g = ctx.createLinearGradient(a, 0, b, 0);
    g.addColorStop(0, hexA(p.color, 0.95)); g.addColorStop(1, hexA(p.color, 0.6));
    ctx.strokeStyle = g; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a + 2, spineY); ctx.lineTo(b - 2, spineY); ctx.stroke();
    ctx.restore();
  }

  // branches
  hitBranches = [];
  for (const b of S.branches) {
    if (!b.forks) continue;
    if (sx(b.to) < PAD_L - 60 || sx(b.from) > W + 60) continue;
    const pts = branchPoints(b);
    const list = b.nodes.map((id) => byId.get(id));
    const e = Math.max(...list.map(emphasis));
    const first = list[0];
    const col = first.variant ? VARIANT[first.variant] : KIND[first.kind].color;
    const lit = state.themes.size ? b.themes.filter((t) => state.themes.has(t)) : [];
    const sel = state.selBranch === b, hov = state.hoverBranch === b;
    const path = tracePath(pts);
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (sel || hov) { ctx.shadowColor = col; ctx.shadowBlur = 18; }
    ctx.strokeStyle = hexA(lit.length && e > 0.5 ? themeOf[lit[0]].color : col, (sel ? 0.95 : hov ? 0.8 : 0.42) * e);
    ctx.lineWidth = sel ? 3.2 : hov ? 2.6 : 1.7;
    ctx.stroke(path);
    ctx.restore();
    hitBranches.push({ b, pts: samplePts(pts) });
  }

  // nodes
  hitNodes = [];
  const pulse = 0.5 + 0.5 * Math.sin(now / 380);
  const showLabels = state.k > 95;
  const labelled = [];
  for (const n of S.nodes) {
    const x = sx(n.x);
    if (x < PAD_L - 30 || x > W + 30) continue;
    const y = sy(n.lane), e = emphasis(n);
    const planet = planetOf[n.planet] || { color: '#b48cff' };
    const size = nodeSize(n, LH);
    const lit = litThemes(n);
    const active = state.sel === n || state.hover === n;
    ctx.save();
    ctx.globalAlpha = e;
    // theme halo
    if (lit.length && e > 0.5) {
      const hc = themeOf[lit[0]].color;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, size * 3.2);
      halo.addColorStop(0, hexA(hc, 0.55)); halo.addColorStop(1, hexA(hc, 0));
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, size * 3.2, 0, Math.PI * 2); ctx.fill();
    }
    if (active) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 20; }
    shape(ctx, n, x, y, size, planet.color);
    ctx.shadowBlur = 0;
    // theme ring segments
    if (lit.length && e > 0.5) {
      const seg = (Math.PI * 2) / lit.length;
      lit.forEach((t, i) => {
        ctx.strokeStyle = themeOf[t].color; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.arc(x, y, size + 3.5, -Math.PI / 2 + i * seg + 0.08, -Math.PI / 2 + (i + 1) * seg - 0.08); ctx.stroke();
      });
    }
    if (state.sel === n) {
      ctx.strokeStyle = hexA('#ffffff', 0.5 + 0.5 * pulse); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, size + 7 + pulse * 3, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
    hitNodes.push({ n, x, y, r: Math.max(size + 4, 9) });
    if ((showLabels || n.kind === 'milestone' && state.k > 40 || active) && e > 0.5) labelled.push({ n, x, y, size });
  }

  // labels, greedily placed so they never overlap
  const boxes = [];
  ctx.font = '600 11px "Segoe UI", system-ui'; ctx.textBaseline = 'middle';
  labelled.sort((a, b) => (b.n === state.sel) - (a.n === state.sel) || (b.n === state.hover) - (a.n === state.hover) || rank(a.n) - rank(b.n));
  for (const L of labelled) {
    const text = labelText(L.n);
    const w = ctx.measureText(text).width + 10;
    const above = L.n.lane === 'light';
    const bx = L.x - w / 2, by = above ? L.y - L.size - 22 : L.y + L.size + 6;
    const box = [bx, by, w, 16];
    if (boxes.some((o) => !(box[0] > o[0] + o[2] || box[0] + box[2] < o[0] || box[1] > o[1] + o[3] || box[1] + box[3] < o[1]))) continue;
    boxes.push(box);
    ctx.fillStyle = 'rgba(8,12,19,.78)'; roundRect(ctx, bx, by, w, 16, 5); ctx.fill();
    ctx.fillStyle = L.n === state.sel ? '#fff' : L.n.kind === 'milestone' ? '#d9c6ff' : '#cfdbe8';
    ctx.fillText(text, bx + 5, by + 8.5);
  }

  // the playhead
  if (state.mouse && state.mouse.x > PAD_L && state.mouse.y > top && state.mouse.y < bottom) {
    const x = state.mouse.x;
    ctx.strokeStyle = 'rgba(242,200,105,.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 0.5, top + 30); ctx.lineTo(x + 0.5, bottom); ctx.stroke();
  }
  ctx.restore();

  // lane gutter
  const gg = ctx.createLinearGradient(0, 0, PAD_L, 0);
  gg.addColorStop(0, 'rgba(7,10,16,.97)'); gg.addColorStop(0.85, 'rgba(7,10,16,.9)'); gg.addColorStop(1, 'rgba(7,10,16,0)');
  ctx.fillStyle = gg; ctx.fillRect(0, top, PAD_L, bottom - top);
  ctx.textBaseline = 'middle';
  for (const l of S.lanes) {
    const y = sy(l.id);
    const col = l.id === 'spine' ? '#f2c869' : l.id === 'light' ? VARIANT.light : l.id === 'shadow' ? VARIANT.shadow
      : KIND[{ modes: 'milestone', voices: 'beat', outpost: 'outpost', farm: 'farm' }[l.id]].color;
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(16, y, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c4d2e0'; ctx.font = '700 10px "Segoe UI", system-ui';
    ctx.fillText(l.name.toUpperCase(), 26, y);
  }

  drawStrip();
  readout();
}

function rank(n) { return { milestone: 0, campaign: 1, secondary: 2, outpost: 3, farm: 3, beat: 4 }[n.kind]; }
function labelText(n) {
  if (n.kind === 'campaign') return `${n.map} · ${n.title}`;
  if (n.kind === 'beat') return n.title;
  return n.title;
}
function nodeSize(n, LH) {
  const base = Math.min(clamp(LH * 0.13, 3.5, 9), Math.max(2.6, state.k * 0.3));
  return { campaign: base * 1.25, secondary: base, outpost: base, farm: base, beat: base * 0.75, milestone: base * 1.1 }[n.kind];
}
function shape(c, n, x, y, s, planetColor) {
  const col = n.kind === 'secondary' ? VARIANT[n.variant] || KIND.secondary.color : KIND[n.kind].color;
  const fill = c.createRadialGradient(x - s * 0.4, y - s * 0.4, 0, x, y, s * 1.4);
  fill.addColorStop(0, '#ffffff'); fill.addColorStop(0.35, col); fill.addColorStop(1, shade(col, -0.45));
  c.fillStyle = fill; c.strokeStyle = planetColor; c.lineWidth = 1.6;
  c.beginPath();
  if (n.kind === 'campaign') {               // hexagon
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; c.lineTo(x + Math.cos(a) * s * 1.1, y + Math.sin(a) * s * 1.1); }
    c.closePath();
  } else if (n.kind === 'outpost') { roundRect(c, x - s, y - s, s * 2, s * 2, s * 0.35); }
  else if (n.kind === 'farm') { c.ellipse(x, y, s * 1.1, s * 0.8, -0.6, 0, Math.PI * 2); }
  else if (n.kind === 'beat') { c.moveTo(x, y - s * 1.2); c.lineTo(x + s, y); c.lineTo(x, y + s * 1.2); c.lineTo(x - s, y); c.closePath(); }
  else if (n.kind === 'milestone') {         // star
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? s * 0.55 : s * 1.3; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath();
  } else { c.arc(x, y, s, 0, Math.PI * 2); }
  c.fill(); c.stroke();
  if (n.kind === 'campaign' && s > 6) {
    c.fillStyle = '#10141c'; c.font = `800 ${Math.round(s * 1.05)}px "Segoe UI", system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(String(n.map), x, y + 0.5); c.textAlign = 'left';
  }
}

// ─── the density strip and minimap ────────────────────────────────────────────────────────────────────────────────
const STRIP_KINDS = [['campaign', KIND.campaign.color], ['secondary', '#8fd3ff'], ['outpost', KIND.outpost.color], ['farm', KIND.farm.color]];
let densityCache = null;
function densitySeries() {
  if (densityCache) return densityCache;
  const steps = S.end * 8, out = [];
  let max = 1;
  for (let i = 0; i <= steps; i++) { const d = S.density(i / 8); out.push(d); max = Math.max(max, d.total); }
  densityCache = { out, max, steps };
  return densityCache;
}
function drawStrip() {
  const y0 = H - BOTTOM + 10, h = BOTTOM - 22, x0 = PAD_L, w = W - PAD_L - 12;
  ctx.fillStyle = 'rgba(10,15,23,.92)'; roundRect(ctx, x0 - 8, y0 - 4, w + 16, h + 12, 10); ctx.fill();
  ctx.strokeStyle = '#1e2d42'; ctx.lineWidth = 1; ctx.stroke();
  const { out, max, steps } = densitySeries();
  const X = (i) => x0 + (i / steps) * w;
  // planet strips
  for (const p of S.planets) {
    ctx.fillStyle = hexA(p.color, 0.5);
    ctx.fillRect(x0 + (p.from / S.end) * w + 1, y0 + h - 2, (w * MAPS_PER_PLANET) / S.end - 2, 3);
  }
  // stacked areas, filtered by the path toggle
  const visible = (k) => !(state.path !== 'both' && k === 'secondary') || true;
  let base = out.map(() => 0);
  for (const [k, col] of STRIP_KINDS) {
    if (!visible(k)) continue;
    const top = out.map((d, i) => base[i] + d[k]);
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) ctx.lineTo(X(i), y0 + h - 4 - (top[i] / max) * (h - 12));
    for (let i = steps; i >= 0; i--) ctx.lineTo(X(i), y0 + h - 4 - (base[i] / max) * (h - 12));
    ctx.closePath();
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, hexA(col, 0.75)); g.addColorStop(1, hexA(col, 0.2));
    ctx.fillStyle = g; ctx.fill();
    base = top;
  }
  ctx.fillStyle = '#7f93a9'; ctx.font = '700 9px "Segoe UI", system-ui'; ctx.textBaseline = 'top';
  ctx.fillText('MISSIONS OPEN OVER TIME', x0, y0);
  ctx.fillText(`peak ${max}`, x0 + w - 44, y0);
  // the viewport
  const va = x0 + (state.ox / S.end) * w, vb = x0 + (tx(W) / S.end) * w;
  ctx.fillStyle = 'rgba(242,200,105,.08)'; ctx.fillRect(va, y0 - 2, Math.max(4, vb - va), h + 6);
  ctx.strokeStyle = 'rgba(242,200,105,.7)'; ctx.lineWidth = 1.2; ctx.strokeRect(va + 0.5, y0 - 2, Math.max(4, vb - va) - 1, h + 6);
  stripBox = { x0, y0, w, h };
}
let stripBox = null;

function readout() {
  const el = document.getElementById('readout');
  const m = state.mouse;
  const t = m && m.x > PAD_L ? clamp(tx(m.x), 0, S.end - 0.001) : null;
  if (t == null) { el.style.opacity = 0; return; }
  const d = S.density(t);
  el.style.opacity = 1;
  el.innerHTML = `<b>${esc(timeLabel(S.order, t))}</b>
    <div class="row">${STRIP_KINDS.map(([k, c]) => `<span><i style="background:${c}"></i>${d[k]} ${k === 'secondary' ? 'contracts' : k}</span>`).join('')}</div>`;
}

// ─── interaction ──────────────────────────────────────────────────────────────────────────────────────────────────
function nodeAt(x, y) {
  let best = null, bd = Infinity;
  for (const h of hitNodes) {
    const d = Math.hypot(h.x - x, h.y - y);
    if (d < h.r && d < bd && emphasis(h.n) > 0.08) { best = h.n; bd = d; }
  }
  return best;
}
function branchAt(x, y) {
  let best = null, bd = 7;
  for (const h of hitBranches) {
    for (let i = 1; i < h.pts.length; i++) {
      const d = segDist(x, y, h.pts[i - 1], h.pts[i]);
      if (d < bd) { bd = d; best = h.b; }
    }
  }
  return best;
}
function segDist(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
  const u = clamp(((px - a[0]) * dx + (py - a[1]) * dy) / L, 0, 1);
  return Math.hypot(px - (a[0] + u * dx), py - (a[1] + u * dy));
}

const pointers = new Map();
let drag = null, pinch = null, moved = false;
cv.addEventListener('pointerdown', (e) => {
  cv.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
  moved = false;
  if (stripBox && e.offsetY > stripBox.y0 - 6) { stripJump(e.offsetX); drag = { strip: true }; return; }
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: state.tk, mid: tx((a.x + b.x) / 2) };
    drag = null;
  } else drag = { x: e.offsetX, ox: state.tox };
});
cv.addEventListener('pointermove', (e) => {
  state.mouse = { x: e.offsetX, y: e.offsetY };
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    zoomTo(pinch.k * (d / pinch.d), (a.x + b.x) / 2, pinch.mid, true);
    moved = true; return;
  }
  if (drag && drag.strip) { stripJump(e.offsetX); moved = true; return; }
  if (drag) {
    const dx = e.offsetX - drag.x;
    if (Math.abs(dx) > 3) moved = true;
    state.tox = clampOx(drag.ox - dx / state.k, state.tk); state.ox = state.tox;
    cv.classList.add('drag'); hideTip(); dirty(); return;
  }
  const n = nodeAt(e.offsetX, e.offsetY);
  const b = n ? null : branchAt(e.offsetX, e.offsetY);
  if (n !== state.hover || b !== state.hoverBranch) { state.hover = n; state.hoverBranch = b; }
  cv.classList.toggle('hot', !!(n || b));
  if (n) showTip(n, e.offsetX, e.offsetY); else if (b) showBranchTip(b, e.offsetX, e.offsetY); else hideTip();
  dirty();
});
const up = (e) => {
  pointers.delete(e.pointerId);
  cv.classList.remove('drag');
  if (pointers.size < 2) pinch = null;
  if (drag && !drag.strip && !moved) {
    const n = nodeAt(e.offsetX, e.offsetY);
    if (n) select(n);
    else { const b = branchAt(e.offsetX, e.offsetY); if (b) selectBranch(b); else closePanel(); }
  }
  drag = null;
};
cv.addEventListener('pointerup', up);
cv.addEventListener('pointercancel', up);
cv.addEventListener('pointerleave', () => { state.mouse = null; state.hover = null; state.hoverBranch = null; hideTip(); dirty(); });
cv.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && !e.ctrlKey) {
    state.tox = clampOx(state.tox + e.deltaX / state.tk, state.tk); dirty(); return;
  }
  zoomTo(state.tk * Math.exp(-e.deltaY * 0.0016), e.offsetX, tx(e.offsetX));
}, { passive: false });

function clampOx(ox, k) { const span = (W - PAD_L) / k; return clamp(ox, -0.5, Math.max(-0.5, S.end + 0.5 - span)); }
function zoomTo(k, px, anchorT, immediate = false) {
  k = clamp(k, minK(), 900);
  state.tk = k; state.tox = clampOx(anchorT - (px - PAD_L) / k, k);
  if (immediate) { state.k = state.tk; state.ox = state.tox; }
  dirty();
}
function stripJump(x) {
  const t = ((x - stripBox.x0) / stripBox.w) * S.end;
  const span = (W - PAD_L) / state.tk;
  state.tox = clampOx(t - span / 2, state.tk); dirty();
}
function flyTo(t, k = Math.max(state.tk, 150)) {
  k = clamp(k, minK(), 900);
  state.tk = k; state.tox = clampOx(t - ((W - PAD_L) * 0.42) / k, k); dirty();
}

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') e.target.blur(); return; }
  if (e.key === 'Escape') closePanel();
  else if (e.key === 'f' || e.key === 'F') fit();
  else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    if (state.sel) {
      const b = branchOf.get(state.sel.branch);
      const list = (b ? b.nodes : []).map((id) => byId.get(id));
      const i = list.indexOf(state.sel), nx = list[i + dir];
      if (nx) { select(nx); e.preventDefault(); return; }
    }
    state.tox = clampOx(state.tox + dir * (W - PAD_L) * 0.25 / state.tk, state.tk); dirty();
  } else if (/^[1-8]$/.test(e.key)) toggleTheme(S.themes[Number(e.key) - 1].id);
  else if (e.key === '+' || e.key === '=') zoomTo(state.tk * 1.4, W / 2, tx(W / 2));
  else if (e.key === '-') zoomTo(state.tk / 1.4, W / 2, tx(W / 2));
});

// ─── tooltip ──────────────────────────────────────────────────────────────────────────────────────────────────────
const tip = document.getElementById('tip');
function placeTip(x, y) {
  const r = tip.getBoundingClientRect();
  let left = x + 16, topY = y + 16;
  if (left + r.width > W - 8) left = x - r.width - 16;
  if (topY + r.height > H - 8) topY = y - r.height - 12;
  tip.style.left = left + 'px'; tip.style.top = topY + 'px';
  tip.classList.add('show');
}
const themeTags = (ids) => ids.map((t) => `<span style="color:${themeOf[t].color};border-color:${hexA(themeOf[t].color, 0.5)}">${themeOf[t].name}</span>`).join('');
function showTip(n, x, y) {
  const when = n.kind === 'milestone' ? timeLabel(S.order, n.from) : `Opens ${timeLabel(S.order, n.from)}`;
  tip.innerHTML = `<div class="k">${esc(kindName(n))}${n.planet ? ' · ' + esc(n.planet) : ''}</div><div class="t">${esc(n.title)}</div>
    <div class="w">${esc(when)}${n.mission && n.mission.giver ? ' · ' + esc(n.mission.giver.name) : ''}</div><div class="th">${themeTags(n.themes)}</div>`;
  placeTip(x, y);
}
function showBranchTip(b, x, y) {
  tip.innerHTML = `<div class="k">Branch · ${b.nodes.length} steps</div><div class="t">${esc(b.name)}</div>
    <div class="w">Open ${esc(timeLabel(S.order, b.from))} → ${esc(timeLabel(S.order, Math.min(S.end - 0.01, b.to)))}</div><div class="th">${themeTags(b.themes)}</div>`;
  placeTip(x, y);
}
function hideTip() { tip.classList.remove('show'); }
function kindName(n) { return n.kind === 'secondary' ? `${n.variant === 'shadow' ? 'Shadow' : 'Light'} contract` : KIND[n.kind].name; }

// ─── the panel ────────────────────────────────────────────────────────────────────────────────────────────────────
const panel = document.getElementById('panel'), pinner = document.getElementById('pinner');
let tab = 'details';
function select(n, fly = true) {
  state.sel = n; state.selBranch = branchOf.get(n.branch) && branchOf.get(n.branch).forks ? branchOf.get(n.branch) : null;
  renderPanel(); panel.classList.add('open');
  if (fly) { const x = sx(n.x); if (x < PAD_L + 40 || x > W * 0.75) flyTo(n.x, state.tk); }
  setTimeout(() => { resize(); }, 300);
  dirty();
}
function selectBranch(b) { state.sel = null; state.selBranch = b; renderBranchPanel(b); panel.classList.add('open'); setTimeout(resize, 300); dirty(); }
function closePanel() {
  if (!panel.classList.contains('open')) return;
  state.sel = null; state.selBranch = null; panel.classList.remove('open'); setTimeout(resize, 300); dirty();
}

function availabilityHTML(n) {
  const pct = (t) => clamp((t / S.end) * 100, 0, 100);
  const col = n.variant ? VARIANT[n.variant] : KIND[n.kind].color;
  const opens = n.kind === 'milestone' ? `Happens at <b>${esc(timeLabel(S.order, n.from))}</b>`
    : n.kind === 'campaign' ? `Played on <b>${esc(n.planet)} · map ${n.map}</b>` : `Opens at <b>${esc(timeLabel(S.order, n.from))}</b>`;
  const due = n.kind === 'milestone' ? '' : n.kind === 'campaign' ? ' · won by the end of the map'
    : n.kind === 'beat' ? ' · plays once, if the wave earns it'
    : ` · expected by <b>${esc(dueLabel(n.due))}</b>, then stays open`;
  return `<div class="avail">${opens}${due}${n.assumed ? ' <span style="color:#7f93a9">(assumed pacing)</span>' : ''}
    <div class="bar"><i style="left:${pct(n.from)}%;width:${Math.max(0.6, pct(n.due) - pct(n.from))}%;background:${col}"></i>
    ${n.kind === 'campaign' || n.kind === 'milestone' || n.kind === 'beat' ? '' : `<i class="tail" style="left:${pct(n.due)}%;right:0;background:${col}"></i>`}</div>
    <div class="scale"><span>${esc(S.order[0])}</span><span>${esc(S.order[S.order.length - 1])}</span></div></div>`;
}
function dueLabel(t) {
  const p = S.planets.find((x) => Math.abs(x.to - t) < 1e-6);
  return p ? `the end of ${p.name}` : timeLabel(S.order, Math.min(S.end - 0.01, t));
}
function headHTML(n) {
  const planet = planetOf[n.planet] || { color: '#b48cff' };
  const who = (n.mission && n.mission.giver && n.mission.giver.name) || (n.cast && n.cast.secondary && n.cast.secondary.name) || (n.people || [])[0];
  return `<div class="ph" style="--pc:${planet.color}"><button class="close" aria-label="Close" data-close>✕</button>
    <div class="top">${who ? `<img class="pt" src="${portrait(who)}" alt="" onerror="this.style.visibility='hidden'">` : ''}
      <div><div class="kind">${esc(kindName(n))}${n.planet ? ' · ' + esc(n.planet) : ''}${n.map ? ' · map ' + n.map : ''}${n.step && !n.map ? ' · step ' + n.step : ''}</div>
      <h2>${esc(n.title)}</h2><div class="sub">${esc(n.id)}${who ? ' · ' + esc(who) : ''}</div></div></div>
    <div class="tags">${themeTags(n.themes) || '<span style="color:#7f93a9;border-color:#2a3a52">no theme</span>'}</div>
    ${availabilityHTML(n)}</div>`;
}
function renderPanel() {
  const n = state.sel;
  if (!n) return;
  const lines = dialogFor(n), crit = criteriaOf(n.mission);
  pinner.innerHTML = headHTML(n) + `<div class="tabs">
      <button data-tab="details" class="${tab === 'details' ? 'on' : ''}">DETAILS</button>
      <button data-tab="dialog" class="${tab === 'dialog' ? 'on' : ''}">DIALOG<em>${lines.length}</em></button>
      <button data-tab="criteria" class="${tab === 'criteria' ? 'on' : ''}">CRITERIA<em>${crit.reduce((a, g) => a + g.items.length, 0)}</em></button>
    </div><div class="body">${tab === 'dialog' ? dialogHTML(lines) : tab === 'criteria' ? criteriaHTML(crit, n) : detailsHTML(n)}</div>`;
}
function detailsHTML(n) {
  const m = n.mission;
  let h = '';
  if (m && m.briefing) h += `<h4>Briefing</h4><div class="brief">${esc(m.briefing)}</div>`;
  if (n.detail) h += `<h4>What happens</h4><div class="brief">${esc(n.detail)}</div>`;
  if (n.kind === 'milestone' && n.opens) h += `<h4>Opens with</h4><div class="steps">${stepBtn(byId.get(n.opens))}</div>`;
  if (n.offer) {
    const o = n.offer;
    h += `<h4>The rare offer</h4><dl class="kv"><dt>Earned by</dt><dd>${esc(o.needs)}</dd><dt>Buyer</dt><dd>${esc(o.contact || 'a contact from an arrived ship')}${o.buyer ? ' · ' + esc(factionName(o.buyer)) : ''}</dd>
      <dt>Terms</dt><dd>up to <b>${o.quota}</b> at <b>${o.price}</b> gold each</dd><dt>Loyalty</dt><dd>+${o.loyalty} on a sale; accepting takes a side</dd><dt>Seeded</dt><dd>${o.seeded} on the map</dd></dl>`;
  }
  if (m) {
    h += `<dl class="kv" style="margin-top:14px"><dt>Giver</dt><dd>${esc(m.giver ? m.giver.name : '—')}${m.giver ? ' · ' + esc(factionName(m.giver.faction)) + ' · ' + esc(m.giver.align) : ''}</dd>
      <dt>Granted at</dt><dd>${esc(m.grantedAt || '—')}</dd><dt>Collect at</dt><dd>${esc(m.collectAt || '—')}</dd><dt>Status</dt><dd>${esc(m.status || '—')}</dd></dl>`;
    if ((m.rewards || []).length) h += `<h4>Rewards</h4><div class="rw">${m.rewards.map((r) => `<span><b>${r.kind === 'tech_unlock' ? '⚙' : r.amount}</b>${esc(r.label)}</span>`).join('')}</div>`;
    const im = m.impact || {};
    const imp = [['loyaltyPlanet', 'Loyalty with the planet'], ['loyaltyRival', 'Loyalty with its rival'], ['alignment', 'Alignment'], ['brokenPenalty', 'Broken promise']]
      .filter(([k]) => im[k] != null).map(([k, l]) => `<dt>${l}</dt><dd style="color:${im[k] < 0 ? '#ff8a8a' : '#8fe6a8'}">${im[k] > 0 ? '+' : ''}${im[k]}</dd>`).join('');
    if (imp) h += `<h4>Impact</h4><dl class="kv">${imp}</dl>`;
  }
  const people = [...new Set([...(n.people || [])])];
  if (people.length) {
    h += `<h4>People</h4><div class="people">${people.map((p) => {
      const role = n.cast && n.cast.primary === p ? 'speaks for the map' : n.cast && n.cast.secondary && n.cast.secondary.name === p ? 'calls in at wave 3'
        : n.mission && n.mission.giver && n.mission.giver.name === p ? 'gives the mission' : '';
      const ties = (threads && threads.threads || []).filter((t) => t.from === p && people.includes(t.to)).map((t) => `${t.kind} → ${t.to}`);
      return `<div class="person"><img src="${portrait(p)}" alt="" onerror="this.style.visibility='hidden'"><div><div class="n">${esc(p)}${(n.debut || []).includes(p) ? ' <span style="color:#5ff0b0;font-size:10px">FIRST APPEARANCE</span>' : ''}</div>
        <div class="r">${esc([role, ...ties].filter(Boolean).join(' · ') || '—')}</div></div></div>`;
    }).join('')}</div>`;
  }
  if ((n.secrets || []).length) {
    h += `<h4>Secrets they carry</h4><div class="people">${n.secrets.map((s) => `<div class="person" style="align-items:flex-start"><div><div class="n">${esc(s.key)} · ${esc(s.who)}${s.about ? ' → ' + esc(s.about) : ''}</div>
      <div class="r">${esc(s.text)}${s.mission ? ` <br><span style="color:#5ff0b0">Favour: ${esc(s.mission.task)}</span>` : ''}</div></div></div>`).join('')}</div>`;
  }
  const b = branchOf.get(n.branch);
  if (b && b.nodes.length > 1) h += `<h4>${esc(b.name)}</h4><div class="steps">${b.nodes.map((id) => stepBtn(byId.get(id), id === n.id)).join('')}</div>`;
  h += `<div class="note">Times assume one playthrough in sequence: each planet's maps 1 → 9, waves 1 → 8, contracts taken as they open. ${n.assumed ? 'Outpost and farm steps use the assumed pacing in storyModel.js (PACING).' : ''}</div>`;
  return h;
}
function stepBtn(n, current = false) {
  if (!n) return '';
  const col = n.variant ? VARIANT[n.variant] : KIND[n.kind].color;
  return `<button data-go="${esc(n.id)}" style="${current ? 'border-color:#f2c869' : ''}"><i style="background:${col}">${n.map || n.step || '•'}</i>${esc(n.title)}<span>${esc(timeLabel(S.order, n.from).replace(/ · wave \d/, ''))}</span></button>`;
}
function dialogFor(n) {
  const lines = dialogOf(n, SRC);
  if (n.kind === 'beat' && n.offer && n.offer.contact && offerScene) {
    try {
      const pk = Object.keys(PLANETS).find((k) => PLANETS[k].name === n.planet);
      const buyer = n.offer.buyer;
      const entry = (SRC.characters[buyer] || { characters: [] }).characters.find((c) => c.name === n.offer.contact);
      const sc = offerScene(voicepacks, { factionKey: buyer, name: n.offer.contact, factionName: factionName(buyer),
        planetName: (PLANETS[pk] || {}).name, rareName: ((PLANETS[pk] || {}).resources || {}).rare ? PLANETS[pk].resources.rare.name : 'rare goods',
        quota: n.offer.quota, price: n.offer.price, personality: entry && entry.personality, flavour: n.cast && n.cast.secondary ? n.cast.secondary.line : null });
      // the offer plays before the secrets
      const scene = [];
      const add = (c, when) => { if (c) scene.push({ who: c.name || n.offer.contact, when, line: c.line, factionKey: buyer }); };
      sc.calls.forEach((c, i) => add(c, i ? 'offer' : 'offer · intro'));
      add(sc.replies.accept, 'reply · accept'); add(sc.replies.decline, 'reply · decline');
      const at = lines.findIndex((l) => /^secret/.test(l.when));
      lines.splice(at < 0 ? lines.length : at, 0, ...scene);
    } catch (e) { /* the scene needs the voice packs; the plain lines still show */ }
  }
  return lines;
}
function dialogHTML(lines) {
  if (!lines.length) return '<div class="empty">No dialog written for this yet.</div>';
  return lines.map((l) => l.who === 'Briefing'
    ? `<div class="line brief"><div class="bub"><div class="who">Briefing<span class="when">${esc(l.when)}</span></div><div class="say">${esc(l.line)}</div></div></div>`
    : `<div class="line"><img src="${portrait(l.who)}" alt="" onerror="this.style.visibility='hidden'"><div class="bub"><div class="who">${esc(l.who)}<span class="when">${esc(l.when)}</span></div><div class="say">${esc(l.line)}</div></div></div>`).join('');
}
const STAGE_COL = { view: '#8ea3b8', unlock: '#4dd8ff', execute: '#b48cff', complete: '#7fe0a8', fail: '#ff6b6b' };
function criteriaHTML(groups, n) {
  if (!groups.length) {
    if (n.offer) return `<div class="crit"><h4>Earned when</h4><ul><li style="--cc:#4dd8ff"><i></i><div>Wave 3 cleared at 3★ or more, once a map<code>rareOfferEarned</code></div></li>
      <li style="--cc:#7fe0a8"><i></i><div>Sold: up to ${n.offer.quota} at ${n.offer.price} gold, paid when the map ends<code>settleRareContract</code></div></li></ul></div>`;
    return '<div class="empty">No criteria: this is a story event.</div>';
  }
  return groups.map((g) => `<div class="crit"><h4>${esc(g.label)}</h4><ul>${g.items.map((c) =>
    `<li class="${c.bonus ? 'bonus' : ''}" style="--cc:${STAGE_COL[g.stage]}"><i></i><div>${esc(c.text)}${c.bonus ? ' <span style="color:#f2c869">(bonus)</span>' : ''}<code>${esc(c.cond)}</code></div></li>`).join('')}</ul></div>`).join('');
}
function renderBranchPanel(b) {
  const list = b.nodes.map((id) => byId.get(id));
  const first = list[0], planet = planetOf[first.planet] || { color: '#b48cff' };
  const giver = first.mission && first.mission.giver ? first.mission.giver.name : null;
  const totals = list.reduce((a, n) => { for (const r of (n.mission && n.mission.rewards) || []) if (r.kind === 'gold' || r.kind === 'xp') a[r.kind] = (a[r.kind] || 0) + r.amount; return a; }, {});
  pinner.innerHTML = `<div class="ph" style="--pc:${planet.color}"><button class="close" aria-label="Close" data-close>✕</button>
    <div class="top">${giver ? `<img class="pt" src="${portrait(giver)}" alt="" onerror="this.style.visibility='hidden'">` : ''}<div><div class="kind">Branch · ${esc(kindName(first))}</div>
    <h2>${esc(b.name)}</h2><div class="sub">${list.length} steps${b.ship ? ' · ' + esc(b.ship) : ''}</div></div></div>
    <div class="tags">${themeTags(b.themes)}</div>
    ${availabilityHTML({ ...first, from: b.from, due: b.to })}</div>
    <div class="body"><h4>Steps in order</h4><div class="steps">${list.map((n) => stepBtn(n)).join('')}</div>
    <h4>Across the branch</h4><dl class="kv"><dt>Gold</dt><dd>${(totals.gold || 0).toLocaleString()}</dd><dt>XP</dt><dd>${(totals.xp || 0).toLocaleString()}</dd>
    <dt>Givers</dt><dd>${esc([...new Set(list.map((n) => n.mission && n.mission.giver && n.mission.giver.name).filter(Boolean))].join(', ') || '—')}</dd></dl>
    <div class="note">Select a step for its dialog and criteria.</div></div>`;
}
pinner.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab],[data-go],[data-close]');
  if (!t) return;
  if (t.dataset.close != null) closePanel();
  else if (t.dataset.tab) { tab = t.dataset.tab; renderPanel(); }
  else if (t.dataset.go) select(byId.get(t.dataset.go));
});
const factionName = (key) => (voicepacks && voicepacks.factions && voicepacks.factions[key] && voicepacks.factions[key].name) || key || '';

// ─── the HUD ──────────────────────────────────────────────────────────────────────────────────────────────────────
const chips = document.getElementById('chips');
chips.innerHTML = S.themes.map((t, i) => `<button class="chip" data-t="${t.id}" style="--c:${t.color}" title="${esc(t.blurb)} (${i + 1})"><i></i>${esc(t.name)}<em>${S.nodes.filter((n) => n.themes.includes(t.id)).length}</em></button>`).join('');
chips.addEventListener('click', (e) => { const c = e.target.closest('[data-t]'); if (c) toggleTheme(c.dataset.t); });
function toggleTheme(id) {
  if (state.themes.has(id)) state.themes.delete(id); else state.themes.add(id);
  chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', state.themes.has(c.dataset.t)));
  dirty();
}
document.getElementById('path').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  state.path = b.dataset.v;
  document.querySelectorAll('#path button').forEach((x) => x.classList.toggle('on', x === b));
  dirty();
});
const q = document.getElementById('q');
q.addEventListener('input', () => { state.q = q.value.trim(); dirty(); });
q.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !state.q) return;
  const hit = S.nodes.find((n) => matchesQuery(n) && n.kind !== 'milestone');
  if (hit) { select(hit, false); flyTo(hit.x, Math.max(state.tk, 180)); }
});
document.getElementById('fit').addEventListener('click', () => fit());
document.getElementById('stats').textContent = `${S.nodes.filter((n) => n.mission).length} missions · ${S.branches.filter((b) => b.forks).length} branches · ${S.order.length} planets`;

// ─── loop ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function frame(now) {
  const intro = clamp((now - state.t0) / 1400, 0, 1);
  const moving = Math.abs(state.k - state.tk) > 0.01 || Math.abs(state.ox - state.tox) > 0.0005;
  if (moving) { state.k = lerp(state.k, state.tk, 0.2); state.ox = lerp(state.ox, state.tox, 0.2); needs = true; }
  if (intro < 1 || intro !== state.intro) { state.intro = intro; needs = true; }
  if (state.sel) needs = true;   // the selection pulses
  if (needs) { needs = false; draw(now); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.getElementById('loading').classList.add('gone');

// deep link: #P-VER-04 selects that node
if (location.hash.length > 1 && byId.get(decodeURIComponent(location.hash.slice(1)))) {
  const n = byId.get(decodeURIComponent(location.hash.slice(1)));
  setTimeout(() => { select(n, false); flyTo(n.x, 220); }, 200);
}
window.__story = { S, select: (id) => select(byId.get(id)), toggleTheme, flyTo, state };

// ─── helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────
function hexA(hex, a) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(v, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a, 0, 1)})`;
}
function shade(hex, f) {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  const c = (v) => clamp(Math.round(v + (f < 0 ? v * f : (255 - v) * f)), 0, 255);
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}
function roundRect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
