const STATE_COLORS = {
  Placing: 0x2288ff,
  Building: 0xccaa22,
  Complete: 0x33cc55,
  Damaged: 0xdd6622,
  Destroyed: 0x552222,
  Upgrading: 0x22ccdd,
  Selling: 0xaa44cc,
};

function lerpColor(a, b, t) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

export function drawStructures(g, world, opts) {
  opts = opts || {};
  const selectedId = opts.selectedId != null ? opts.selectedId : null;
  const proj = opts.project || ((x, y) => ({ x, y }));
  const tile = opts.tileSize || 24;

  g.clear();

  const structures = world.structures || [];

  // First pass: range circles (behind) for complete towers and selection
  for (let i = 0; i < structures.length; i++) {
    const s = structures[i];
    if (!s) continue;
    if (s.state === 'Destroyed') continue;
    const isSel = s.id === selectedId;
    const isTower = s.category === 'tower' || s.kind === 'antiground' || s.kind === 'antiair' ||
      (s.weapon != null) || (s.range != null && s.category !== 'wall' && s.category !== 'moat');

    if (isTower && (isSel || s.state === 'Complete' || s.state === 'Damaged' || s.state === 'Aiming' || s.state === 'Firing')) {
      const range = (s.range != null ? s.range : 3) * tile;
      const p = proj(s.x, s.y);
      const canAir = !!(s.canTargetAir || s.kind === 'antiair' || (s.canTarget && (s.canTarget === 'Both' || s.canTarget === 'Air')));
      const ringColor = canAir ? 0x66ccff : 0xffaa66;
      if (isSel) {
        // dashed selection ring
        drawDashedCircle(g, p.x, p.y, range, ringColor, 2, 0.9);
      } else {
        g.lineStyle(1, ringColor, 0.18);
        g.drawCircle(p.x, p.y, range);
      }
    }
  }

  // Second pass: structure bodies
  for (let i = 0; i < structures.length; i++) {
    const s = structures[i];
    if (!s) continue;
    drawOneStructure(g, s, s.id === selectedId, proj, tile);
  }
}

function drawOneStructure(g, s, isSel, proj, tile) {
  const p = proj(s.x, s.y);
  const cat = s.category || (s.kind === 'wall' ? 'wall' : s.kind === 'moat' ? 'moat' : 'tower');

  const baseColor = STATE_COLORS[s.state] || 0x888888;

  // Build progress tint (blend building->complete color)
  let bodyColor = baseColor;
  if (s.state === 'Building') {
    const prog = clamp01(s.buildProgress != null ? s.buildProgress : (s.buildTimer != null && s.buildTime ? 1 - s.buildTimer / s.buildTime : 0));
    bodyColor = lerpColor(STATE_COLORS.Building, STATE_COLORS.Complete, prog);
  } else if (s.state === 'Upgrading') {
    const prog = clamp01(s.upgradeProgress != null ? s.upgradeProgress : 0);
    bodyColor = lerpColor(STATE_COLORS.Upgrading, STATE_COLORS.Complete, prog);
  }

  const alpha = (s.state === 'Placing') ? 0.5 : 1.0;

  if (cat === 'wall' || cat === 'moat') {
    drawTerrainPiece(g, s, p, tile, cat, bodyColor, alpha, isSel);
    return;
  }

  // Tower body
  const halfW = tile * 0.42;
  const halfH = tile * 0.42;

  // shadow anchor
  g.beginFill(0x000000, 0.18 * alpha);
  g.drawEllipse(p.x + 3, p.y + halfH + 2, halfW, halfH * 0.4);
  g.endFill();

  // base plate
  g.beginFill(0x333338, alpha);
  g.drawRect(p.x - halfW, p.y - halfH + tile * 0.15, halfW * 2, halfH * 2 - tile * 0.15);
  g.endFill();

  // body
  g.lineStyle(isSel ? 2 : 1, isSel ? 0xffffff : 0x111111, alpha);
  g.beginFill(bodyColor, alpha);
  const bw = halfW * 1.5;
  const bh = halfH * 1.5;
  g.drawRect(p.x - bw / 2, p.y - bh / 2, bw, bh);
  g.endFill();

  // damage smoke marker (hp ratio)
  const hpr = s.maxHp ? clamp01(s.hp / s.maxHp) : 1;
  if (hpr < 1 && s.state !== 'Placing' && s.state !== 'Destroyed') {
    g.beginFill(0x222222, (1 - hpr) * 0.4);
    g.drawCircle(p.x - bw * 0.25, p.y - bh * 0.5, tile * 0.12 * (1 - hpr) + 1);
    g.endFill();
  }

  // weapon barrel oriented toward target angle
  const ang = (s.aimAngle != null) ? s.aimAngle : (s.turretAngle != null ? s.turretAngle : -Math.PI / 2);
  const canAir = !!(s.canTargetAir || s.kind === 'antiair' || (s.canTarget && (s.canTarget === 'Both' || s.canTarget === 'Air')));
  const barrelLen = tile * 0.55;
  const barrelColor = canAir ? 0x99ddff : 0xffcc88;
  g.lineStyle(3, barrelColor, alpha);
  g.moveTo(p.x, p.y);
  g.lineTo(p.x + Math.cos(ang) * barrelLen, p.y + Math.sin(ang) * barrelLen);
  g.lineStyle(0);

  // tier pips
  const tier = s.tier || 1;
  for (let t = 0; t < tier; t++) {
    g.beginFill(0xffff66, alpha);
    g.drawRect(p.x - bw / 2 + t * (tile * 0.14) + 1, p.y + bh / 2 + 2, tile * 0.1, tile * 0.1);
    g.endFill();
  }

  // firing flash
  if (s.state === 'Firing' || s.firingFlash) {
    g.beginFill(0xffffee, 0.7 * alpha);
    g.drawCircle(p.x + Math.cos(ang) * barrelLen, p.y + Math.sin(ang) * barrelLen, tile * 0.18);
    g.endFill();
  }

  // air-target indicator dot
  if (canAir) {
    g.beginFill(0x66ccff, alpha);
    g.drawCircle(p.x, p.y - bh / 2 - 3, 2);
    g.endFill();
  }
}

function drawTerrainPiece(g, s, p, tile, cat, bodyColor, alpha, isSel) {
  const fw = (s.footprintW || s.footprint && s.footprint.w || 1) * tile;
  const fh = (s.footprintH || s.footprint && s.footprint.h || 1) * tile;
  const x0 = p.x - fw / 2;
  const y0 = p.y - fh / 2;

  if (cat === 'moat') {
    // moat = dug water trench
    g.beginFill(0x113355, alpha * 0.9);
    g.drawRect(x0, y0, fw, fh);
    g.endFill();
    g.lineStyle(2, 0x2266aa, alpha * 0.8);
    g.drawRect(x0, y0, fw, fh);
    // ripple lines
    g.lineStyle(1, 0x3399cc, alpha * 0.5);
    for (let yy = y0 + 4; yy < y0 + fh; yy += 6) {
      g.moveTo(x0 + 2, yy);
      g.lineTo(x0 + fw - 2, yy);
    }
    g.lineStyle(0);
  } else {
    // wall = solid block
    g.beginFill(0x000000, 0.2 * alpha);
    g.drawRect(x0 + 3, y0 + 3, fw, fh);
    g.endFill();
    g.lineStyle(isSel ? 2 : 1, isSel ? 0xffffff : 0x222222, alpha);
    g.beginFill(bodyColor, alpha);
    g.drawRect(x0, y0, fw, fh);
    g.endFill();
    // brick seams
    g.lineStyle(1, 0x000000, 0.25 * alpha);
    for (let yy = y0 + fh / 3; yy < y0 + fh; yy += fh / 3) {
      g.moveTo(x0, yy);
      g.lineTo(x0 + fw, yy);
    }
    g.lineStyle(0);
  }

  // hp damage overlay
  const hpr = s.maxHp ? clamp01(s.hp / s.maxHp) : 1;
  if (hpr < 1 && s.state !== 'Destroyed') {
    g.beginFill(0x000000, (1 - hpr) * 0.35);
    g.drawRect(x0, y0, fw, fh);
    g.endFill();
  }

  if (isSel) {
    g.lineStyle(2, 0xffffff, 0.9);
    g.drawRect(x0 - 2, y0 - 2, fw + 4, fh + 4);
    g.lineStyle(0);
  }
}

function drawDashedCircle(g, cx, cy, r, color, width, alpha) {
  const segs = Math.max(24, Math.floor(r / 4));
  const dash = 2; // draw one, skip one
  g.lineStyle(width, color, alpha);
  for (let i = 0; i < segs; i++) {
    if (i % dash !== 0) continue;
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    g.moveTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
    g.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
  }
  g.lineStyle(0);
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export default drawStructures;