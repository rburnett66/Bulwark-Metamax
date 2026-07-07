const StateColors = {
  Placing: 0x888888,
  Building: 0xcc9944,
  Complete: 0x44aa66,
  Damaged: 0xaa6644,
  Destroyed: 0x442222,
  Upgrading: 0x44aacc,
  Selling: 0xaaaa44,
};

const DomainColors = {
  ground: 0x995544,
  water: 0x4488cc,
  air: 0xccccdd,
};

function colorForArmor(armor) {
  switch (armor) {
    case 'Organic': return 0xdd8844;
    case 'Machinery': return 0x8899aa;
    case 'Aircraft': return 0xccccee;
    case 'Energy': return 0xcc66ee;
    case 'Structure': return 0x778899;
    default: return 0xffffff;
  }
}

// Draw a health bar above an entity
function drawHpBar(g, x, y, w, frac, ownerFriendly) {
  const h = 3;
  const bx = x - w / 2;
  const by = y;
  g.beginFill(0x000000, 0.6);
  g.drawRect(bx - 1, by - 1, w + 2, h + 2);
  g.endFill();
  const col = ownerFriendly ? 0x33dd55 : 0xdd3333;
  g.beginFill(col, 1);
  g.drawRect(bx, by, w * Math.max(0, Math.min(1, frac)), h);
  g.endFill();
}

// ---- Attacker units ----

function drawWalker(g, u, project) {
  const p = project(u.x, u.y, 0);
  const col = colorForArmor(u.armorClass);
  // shadow
  g.beginFill(0x000000, 0.28);
  g.drawEllipse(p.x, p.y + 4, 9, 4);
  g.endFill();
  // legs / body
  g.beginFill(col, 1);
  g.drawRect(p.x - 7, p.y - 12, 14, 14);
  g.endFill();
  // head/sensor
  g.beginFill(0x222222, 1);
  g.drawRect(p.x - 3, p.y - 16, 6, 5);
  g.endFill();
  // weapon nub aimed at target
  if (u.targetAngle != null) {
    const ax = p.x + Math.cos(u.targetAngle) * 10;
    const ay = (p.y - 6) + Math.sin(u.targetAngle) * 6;
    g.lineStyle(2, 0x333333, 1);
    g.moveTo(p.x, p.y - 6);
    g.lineTo(ax, ay);
    g.lineStyle(0);
  }
  drawHpBar(g, p.x, p.y - 22, 16, u.hp / u.maxHp, false);
}

function drawFloater(g, u, project) {
  const p = project(u.x, u.y, 0);
  const col = colorForArmor(u.armorClass);
  const submerged = !!u.submerged;
  // wake ripple
  g.lineStyle(1, 0x88ccee, 0.5);
  g.drawEllipse(p.x, p.y, 12, 5);
  g.lineStyle(0);
  g.beginFill(col, submerged ? 0.55 : 1);
  g.drawEllipse(p.x, p.y - 4, 9, 6);
  g.endFill();
  if (!submerged) {
    g.beginFill(0x222222, 1);
    g.drawRect(p.x - 2, p.y - 10, 4, 4);
    g.endFill();
  }
  drawHpBar(g, p.x, p.y - 16, 16, u.hp / u.maxHp, false);
}

function drawFlyer(g, u, project) {
  const alt = u.altitude || 24;
  const ground = project(u.x, u.y, 0);
  const p = project(u.x, u.y, alt);
  const col = colorForArmor(u.armorClass);
  // altitude shadow (dim, offset), fade with altitude
  const shadowAlpha = Math.max(0.08, 0.32 - alt / 200);
  g.beginFill(0x000000, shadowAlpha);
  g.drawEllipse(ground.x, ground.y + 4, 8, 3.5);
  g.endFill();
  // rotor cross
  g.lineStyle(2, 0xaaaaaa, 0.8);
  g.moveTo(p.x - 12, p.y);
  g.lineTo(p.x + 12, p.y);
  g.moveTo(p.x, p.y - 8);
  g.lineTo(p.x, p.y + 8);
  g.lineStyle(0);
  // body
  g.beginFill(col, 1);
  g.drawRect(p.x - 6, p.y - 5, 12, 10);
  g.endFill();
  drawHpBar(g, p.x, p.y - 14, 16, u.hp / u.maxHp, false);
}

// ---- Player base ----

function drawBase(g, base, project) {
  const p = project(base.x, base.y, 0);
  g.beginFill(0x000000, 0.3);
  g.drawEllipse(p.x, p.y + 8, 30, 12);
  g.endFill();
  g.beginFill(0x556699, 1);
  g.drawRect(p.x - 24, p.y - 30, 48, 38);
  g.endFill();
  g.beginFill(0x334466, 1);
  g.drawRect(p.x - 24, p.y - 30, 48, 8);
  g.endFill();
  // battlements
  g.beginFill(0x556699, 1);
  for (let i = -20; i <= 16; i += 12) {
    g.drawRect(p.x + i, p.y - 36, 8, 8);
  }
  g.endFill();
  drawHpBar(g, p.x, p.y - 44, 52, base.hp / base.maxHp, true);
}

// ---- Structures (towers / walls / moats) ----

function drawTower(g, s, project) {
  const p = project(s.x, s.y, 0);
  const stateCol = StateColors[s.state] || StateColors.Complete;
  const isAA = s.canTargetAir;
  g.beginFill(0x000000, 0.3);
  g.drawEllipse(p.x, p.y + 6, 16, 6);
  g.endFill();
  // base plinth
  g.beginFill(0x555555, 1);
  g.drawRect(p.x - 12, p.y - 6, 24, 10);
  g.endFill();
  // tier stacking
  const tier = s.tier || 1;
  const bodyCol = isAA ? 0x5577cc : 0x777777;
  for (let t = 0; t < tier; t++) {
    const w = 20 - t * 3;
    const yy = p.y - 6 - (t + 1) * 10;
    g.beginFill(bodyCol, 1);
    g.drawRect(p.x - w / 2, yy, w, 10);
    g.endFill();
  }
  const topY = p.y - 6 - tier * 10;
  // turret head
  g.beginFill(stateCol, 1);
  g.drawCircle(p.x, topY, 6);
  g.endFill();
  // barrel aimed at target
  const ang = s.aimAngle != null ? s.aimAngle : (isAA ? -Math.PI / 3 : 0);
  const bl = isAA ? 14 : 12;
  g.lineStyle(isAA ? 3 : 4, 0x222222, 1);
  g.moveTo(p.x, topY);
  g.lineTo(p.x + Math.cos(ang) * bl, topY + Math.sin(ang) * bl);
  g.lineStyle(0);
  drawHpBar(g, p.x, topY - 12, 22, s.hp / s.maxHp, true);
}

function drawWall(g, s, project) {
  const p = project(s.x, s.y, 0);
  const isMoat = s.kind === 'moat';
  g.beginFill(0x000000, 0.25);
  g.drawEllipse(p.x, p.y + 4, 18, 6);
  g.endFill();
  if (isMoat) {
    g.beginFill(0x225577, 1);
    g.drawRect(p.x - 16, p.y - 8, 32, 16);
    g.endFill();
    g.lineStyle(1, 0x4499cc, 0.6);
    g.moveTo(p.x - 14, p.y - 2);
    g.lineTo(p.x + 14, p.y - 2);
    g.moveTo(p.x - 14, p.y + 3);
    g.lineTo(p.x + 14, p.y + 3);
    g.lineStyle(0);
  } else {
    const stateCol = StateColors[s.state] || 0x998877;
    g.beginFill(0x776655, 1);
    g.drawRect(p.x - 16, p.y - 16, 32, 22);
    g.endFill();
    g.beginFill(stateCol, 0.5);
    g.drawRect(p.x - 16, p.y - 16, 32, 22);
    g.endFill();
    // crenellations
    g.beginFill(0x776655, 1);
    for (let i = -14; i <= 8; i += 8) {
      g.drawRect(p.x + i, p.y - 20, 5, 5);
    }
    g.endFill();
  }
  drawHpBar(g, p.x, p.y - 26, 30, s.hp / s.maxHp, true);
}

// ---- Dispatcher ----

export function drawEntity(g, e, project) {
  switch (e.entType) {
    case 'base': drawBase(g, e, project); break;
    case 'walker': drawWalker(g, e, project); break;
    case 'floater': drawFloater(g, e, project); break;
    case 'flyer': drawFlyer(g, e, project); break;
    case 'tower': drawTower(g, e, project); break;
    case 'wall': drawWall(g, e, project); break;
    default: break;
  }
}

export function drawAttacker(g, u, project) {
  switch (u.domain) {
    case 'water': drawFloater(g, u, project); break;
    case 'air': drawFlyer(g, u, project); break;
    default: drawWalker(g, u, project); break;
  }
}

export function drawStructure(g, s, project) {
  if (s.kind === 'wall' || s.kind === 'moat') drawWall(g, s, project);
  else drawTower(g, s, project);
}

export { drawBase, drawWalker, drawFloater, drawFlyer, drawTower, drawWall, DomainColors, StateColors, colorForArmor };