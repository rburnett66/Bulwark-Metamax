/**
 * src/render/voxel/live3d.js — Tier C: a LIVE 3D voxel model with real yaw/pitch/roll
 * (rendering-tiers spec §3C). Each instance re-renders its own canvas texture, so each is its own
 * draw call and NEVER batches — that is why the §5 cap exists. This module enforces it too: builds
 * beyond MAX_LIVE_3D return null and the caller falls back to the baked Tier B path.
 *
 * §6 seam: the face shader here IS the baked pipeline's — same WALL/RANGE lighting ramp, same
 * world-fixed light azimuth, palette straight from the model's voxel colours, same 0.75px outline
 * stroke. At zero pitch/roll a frame from this renderer matches the baked frame.
 *
 * Needs global PIXI (v7). Canvas 2D + Sprite — no shaders, RN-safe.
 */

import { MAX_LIVE_3D } from '../../data/renderTiers.js';

const WALL = 0.52, RANGE = 0.46;              // the baked pipeline's lighting ramp (Stack Forge)
const EPS = 0.01;                             // re-render threshold (rad) per orientation axis

export const live3dRegistry = { count: 0 };   // live instances on screen — the §5 cap counts these

function u8FromB64(s) {
  const bin = atob(s), a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}

// local face normals and, per face, its two in-plane axes (indices into [ex, ey, ez])
const FACES = [
  { n: [0, 0, 1], u: 0, v: 1 },   // top
  { n: [0, 0, -1], u: 0, v: 1 },  // bottom (visible under roll — baked never shows it, live must)
  { n: [1, 0, 0], u: 1, v: 2 },   // +x
  { n: [-1, 0, 0], u: 1, v: 2 },  // -x
  { n: [0, 1, 0], u: 0, v: 2 },   // +y
  { n: [0, -1, 0], u: 0, v: 2 },  // -y
];

/** Extract the exposed voxel faces of a pack-embedded model ({nx,ny,nz,b64} — RGBA, a>0 = filled). */
function buildFaces(model) {
  const { nx, ny, nz } = model, data = u8FromB64(model.b64);
  const at = (x, y, z) => (x >= 0 && x < nx && y >= 0 && y < ny && z >= 0 && z < nz) ? data[((z * ny + y) * nx + x) * 4 + 3] > 0 : false;
  const faces = [];
  const cx = nx / 2, cy = ny / 2, cz = nz / 2;
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const i = ((z * ny + y) * nx + x) * 4;
    if (data[i + 3] === 0) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const push = (f) => faces.push({ x: x + 0.5 - cx, y: y + 0.5 - cy, z: z + 0.5 - cz, f, r, g, b, d: 0 });
    if (!at(x, y, z + 1)) push(0);
    if (!at(x, y, z - 1)) push(1);
    if (!at(x + 1, y, z)) push(2);
    if (!at(x - 1, y, z)) push(3);
    if (!at(x, y + 1, z)) push(4);
    if (!at(x, y - 1, z)) push(5);
  }
  return faces;
}

/**
 * Build a live-3D instance for a pack that embeds a voxel model (pack.model). Returns null when the
 * pack has no model OR the §5 cap is reached — callers MUST fall back to the baked path on null.
 * The sprite is sized so the model footprint spans the same screen box as the baked sprite would.
 */
export function buildLive3D(pack, tilePx, radius, spriteOverCollision) {
  if (!pack || !pack.model || !pack.model.b64) return null;
  if (live3dRegistry.count >= MAX_LIVE_3D) return null;
  const m = pack.model;
  const faces = buildFaces(m);
  if (!faces.length) return null;
  const h = (pack.voxel && pack.voxel.height) || 1.8;
  const targetW = tilePx * 2 * (radius || 0.3) * (spriteOverCollision || 4 / 3);
  const S = Math.max(1, targetW / m.nx);                              // screen px per voxel
  const R = Math.ceil(Math.sqrt(m.nx * m.nx + m.ny * m.ny + m.nz * m.nz * h * h) / 2) + 2;
  const cv = document.createElement('canvas'); cv.width = cv.height = Math.ceil(2 * R * S);
  const ctx = cv.getContext('2d'); ctx.lineWidth = 0.75; ctx.lineJoin = 'round';   // §6: same outline as baked
  const tex = PIXI.Texture.from(cv);
  const spr = new PIXI.Sprite(tex);
  spr.anchor.set(0.5, 0.5);
  const c = new PIXI.Container();
  c.addChild(spr);
  c.__live3d = {
    faces, h, S, cv, ctx, tex, R,
    el: (pack.camera && pack.camera.elevation) || 30,
    lightAz: (pack.light && pack.light.azimuth) || 135,
    lightK: (pack.light && pack.light.contrast) || 55,
    yaw: NaN, pitch: NaN, roll: NaN,                                  // force first render
  };
  live3dRegistry.count++;
  const origDestroy = c.destroy.bind(c);
  c.destroy = (opts) => { live3dRegistry.count--; c.__live3d = null; tex.destroy(true); origDestroy(opts); };
  return c;
}

/** Re-render on orientation change (yaw = heading, roll = bank, pitch = dive). Radians. */
export function updateLive3D(c, yaw, pitch, roll) {
  const L = c.__live3d;
  if (!L) return;
  if (Math.abs(yaw - L.yaw) < EPS && Math.abs(pitch - L.pitch) < EPS && Math.abs(roll - L.roll) < EPS) return;
  L.yaw = yaw; L.pitch = pitch; L.roll = roll;
  const { ctx, cv, S, R, faces, h } = L;
  ctx.clearRect(0, 0, cv.width, cv.height);
  // world basis = Rz(yaw) · Ry(pitch) · Rx(roll) applied to the local axes (x fwd, y right, z up);
  // grid y is image-down, so the same handedness as the baked renderer.
  const cy0 = Math.cos(yaw), sy0 = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  const rot = (x, y, z) => {
    const y1 = y * cr - z * sr, z1 = y * sr + z * cr;                 // roll about +x (forward)
    const x2 = x * cp + z1 * sp, z2 = -x * sp + z1 * cp;              // pitch about +y
    return [x2 * cy0 - y1 * sy0, x2 * sy0 + y1 * cy0, z2];            // yaw about +z
  };
  const ex = rot(1, 0, 0), ey = rot(0, 1, 0), ez = rot(0, 0, h);      // voxel box axes (z stretched)
  const en = [rot(0, 0, 1), ex, ey];                                  // unit normals base: ez^, ex^, ey^
  const eR = L.el * Math.PI / 180, se = Math.sin(eR), ce = Math.cos(eR);
  const la = L.lightAz * Math.PI / 180, Lx = Math.cos(la), Ly = -Math.sin(la);
  const k = Math.max(0, Math.min(1, L.lightK / 100));
  // per-face-kind rotated normal, visibility (n·view, view = (0, ce, se)) and §6 shade — 6 kinds only
  const kinds = [];
  const normFor = [en[0], [-en[0][0], -en[0][1], -en[0][2]], en[1], [-en[1][0], -en[1][1], -en[1][2]], en[2], [-en[2][0], -en[2][1], -en[2][2]]];
  for (let i = 0; i < 6; i++) {
    const n = normFor[i];
    const vis = n[1] * ce + n[2] * se;
    const topness = Math.max(0, n[2]);
    const wall = Math.max(0.3, Math.min(1, WALL + k * RANGE * (n[0] * Lx + n[1] * Ly)));
    kinds.push({ vis, shade: wall + (1 - wall) * topness });
  }
  const axes = [ex, ey, ez];
  const cx = cv.width / 2, cyc = cv.height / 2;
  const vis = [];
  for (const f of faces) {
    if (kinds[f.f].vis <= 0.02) continue;
    const wy = f.x * ex[1] + f.y * ey[1] + f.z * ez[1], wz = f.x * ex[2] + f.y * ey[2] + f.z * ez[2];
    f.d = wy * ce + wz * se;
    vis.push(f);
  }
  vis.sort((a, b) => a.d - b.d);
  for (const f of vis) {
    const kind = FACES[f.f], K = kinds[f.f], s = K.shade;
    const col = 'rgb(' + ((f.r * s) | 0) + ',' + ((f.g * s) | 0) + ',' + ((f.b * s) | 0) + ')';
    ctx.fillStyle = col; ctx.strokeStyle = col;
    // face centre = voxel centre + half a voxel along the local normal (ez already carries h)
    const n = kind.n;
    const bx = f.x + n[0] * 0.5, by = f.y + n[1] * 0.5, bz = f.z + n[2] * 0.5;
    const CWx = bx * ex[0] + by * ey[0] + bz * ez[0];
    const CWy = bx * ex[1] + by * ey[1] + bz * ez[1];
    const CWz = bx * ex[2] + by * ey[2] + bz * ez[2];
    const U = axes[kind.u], V = axes[kind.v];
    const pX = (wx) => cx + S * wx;
    const pY = (wy2, wz2) => cyc + S * (wy2 * se - wz2 * ce);
    ctx.beginPath();
    ctx.moveTo(pX(CWx + (U[0] + V[0]) / 2), pY(CWy + (U[1] + V[1]) / 2, CWz + (U[2] + V[2]) / 2));
    ctx.lineTo(pX(CWx + (U[0] - V[0]) / 2), pY(CWy + (U[1] - V[1]) / 2, CWz + (U[2] - V[2]) / 2));
    ctx.lineTo(pX(CWx - (U[0] + V[0]) / 2), pY(CWy - (U[1] + V[1]) / 2, CWz - (U[2] + V[2]) / 2));
    ctx.lineTo(pX(CWx - (U[0] - V[0]) / 2), pY(CWy - (U[1] - V[1]) / 2, CWz - (U[2] - V[2]) / 2));
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  L.tex.baseTexture.update();
}
