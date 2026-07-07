// src/hud/selectionPanel.js
// Selected-structure panel: name, damage, level, upgrade (+price), repair, sell.
// Screen-space HUD element built from pixi.js primitives. READS sim state,
// issues commands via the controller. Never mutates sim state directly.

const PIXI = window.PIXI;

const PANEL_W = 230;
const PANEL_H = 210;
const PAD = 12;
const BTN_H = 30;
const BTN_GAP = 8;

const COLORS = {
  bg: 0x101820,
  bgAlpha: 0.92,
  border: 0x3a5060,
  title: 0xffffff,
  text: 0xc8d4dc,
  sub: 0x8fa0ac,
  btn: 0x264056,
  btnHover: 0x35597a,
  btnDisabled: 0x1a242c,
  btnText: 0xe6eef4,
  btnTextDisabled: 0x556069,
  upgrade: 0x2f6a3a,
  upgradeHover: 0x3f8a4c,
  repair: 0x5a5030,
  repairHover: 0x7a6c40,
  sell: 0x6a2f2f,
  sellHover: 0x8a3f3f,
  hpGood: 0x4caf50,
  hpMid: 0xd8a33a,
  hpBad: 0xc0392b,
  rangeCircle: 0x66ccff,
};

// Lifecycle state names used across the sim (see lifecycle.js).
const STATE_LABEL = {
  Placing: 'Placing',
  Building: 'Building',
  Complete: 'Complete',
  Damaged: 'Damaged',
  Upgrading: 'Upgrading',
  Selling: 'Selling',
  Destroyed: 'Destroyed',
};

function makeButton(label, w, baseColor, hoverColor) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  c.addChild(g);
  const txt = new PIXI.Text(label, {
    fontFamily: 'monospace',
    fontSize: 13,
    fill: COLORS.btnText,
    align: 'center',
  });
  txt.anchor.set(0.5);
  c.addChild(txt);

  c._g = g;
  c._txt = txt;
  c._w = w;
  c._baseColor = baseColor;
  c._hoverColor = hoverColor;
  c._hover = false;
  c._enabled = true;

  c.eventMode = 'static';
  c.cursor = 'pointer';

  c.redraw = function () {
    g.clear();
    let fill;
    if (!c._enabled) {
      fill = COLORS.btnDisabled;
    } else {
      fill = c._hover ? c._hoverColor : c._baseColor;
    }
    g.beginFill(fill, 1);
    g.lineStyle(1, COLORS.border, 0.8);
    g.drawRoundedRect(0, 0, c._w, BTN_H, 4);
    g.endFill();
    txt.position.set(c._w / 2, BTN_H / 2);
    txt.style.fill = c._enabled ? COLORS.btnText : COLORS.btnTextDisabled;
  };

  c.setLabel = function (s) {
    txt.text = s;
  };

  c.setEnabled = function (en) {
    c._enabled = en;
    c.cursor = en ? 'pointer' : 'default';
    c.redraw();
  };

  c.setWidth = function (w) {
    c._w = w;
    c.redraw();
  };

  c.on('pointerover', () => {
    c._hover = true;
    c.redraw();
  });
  c.on('pointerout', () => {
    c._hover = false;
    c.redraw();
  });

  c.redraw();
  return c;
}

export function createSelectionPanel(opts) {
  opts = opts || {};
  const controller = opts.controller || null;
  const session = opts.session || null;
  const getWorld = opts.getWorld || (() => null);
  const tables = opts.tables || (opts.config && opts.config.data && opts.config.data.tables) || null;

  const root = new PIXI.Container();
  root.visible = false;

  // Background
  const bg = new PIXI.Graphics();
  root.addChild(bg);

  function drawBg() {
    bg.clear();
    bg.beginFill(COLORS.bg, COLORS.bgAlpha);
    bg.lineStyle(2, COLORS.border, 1);
    bg.drawRoundedRect(0, 0, PANEL_W, PANEL_H, 6);
    bg.endFill();
  }
  drawBg();

  // Title (name)
  const titleTxt = new PIXI.Text('', {
    fontFamily: 'monospace',
    fontSize: 15,
    fontWeight: 'bold',
    fill: COLORS.title,
  });
  titleTxt.position.set(PAD, PAD);
  root.addChild(titleTxt);

  // Sub line (kind / tier / state)
  const subTxt = new PIXI.Text('', {
    fontFamily: 'monospace',
    fontSize: 11,
    fill: COLORS.sub,
  });
  subTxt.position.set(PAD, PAD + 20);
  root.addChild(subTxt);

  // Stats block
  const statTxt = new PIXI.Text('', {
    fontFamily: 'monospace',
    fontSize: 12,
    fill: COLORS.text,
    lineHeight: 16,
  });
  statTxt.position.set(PAD, PAD + 40);
  root.addChild(statTxt);

  // HP bar
  const hpBar = new PIXI.Graphics();
  root.addChild(hpBar);
  const hpBarY = PAD + 96;
  const hpBarW = PANEL_W - PAD * 2;
  const hpBarH = 12;

  function drawHpBar(cur, max, state) {
    hpBar.clear();
    hpBar.beginFill(0x000000, 0.5);
    hpBar.drawRect(PAD, hpBarY, hpBarW, hpBarH);
    hpBar.endFill();
    let frac = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
    let col = COLORS.hpGood;
    if (frac < 0.34) col = COLORS.hpBad;
    else if (frac < 0.67) col = COLORS.hpMid;
    if (state === 'Building' || state === 'Placing' || state === 'Upgrading') {
      col = COLORS.rangeCircle;
    }
    hpBar.beginFill(col, 1);
    hpBar.drawRect(PAD, hpBarY, hpBarW * frac, hpBarH);
    hpBar.endFill();
    hpBar.lineStyle(1, COLORS.border, 0.8);
    hpBar.drawRect(PAD, hpBarY, hpBarW, hpBarH);
  }

  // Progress line (for build/upgrade)
  const progTxt = new PIXI.Text('', {
    fontFamily: 'monospace',
    fontSize: 10,
    fill: COLORS.rangeCircle,
  });
  progTxt.position.set(PAD, hpBarY + hpBarH + 3);
  root.addChild(progTxt);

  // Buttons row
  const btnAreaY = PAD + 130;
  const halfW = (PANEL_W - PAD * 2 - BTN_GAP) / 2;

  const upgradeBtn = makeButton('Upgrade', halfW, COLORS.upgrade, COLORS.upgradeHover);
  upgradeBtn.position.set(PAD, btnAreaY);
  root.addChild(upgradeBtn);

  const repairBtn = makeButton('Repair', halfW, COLORS.repair, COLORS.repairHover);
  repairBtn.position.set(PAD + halfW + BTN_GAP, btnAreaY);
  root.addChild(repairBtn);

  const sellBtn = makeButton('Sell', PANEL_W - PAD * 2, COLORS.sell, COLORS.sellHover);
  sellBtn.position.set(PAD, btnAreaY + BTN_H + BTN_GAP);
  root.addChild(sellBtn);

  // ---- data helpers ----------------------------------------------------

  function findStructure(world, id) {
    if (!world || id == null) return null;
    const list = world.structures || (world.entities && world.entities.structures) || null;
    if (!list) return null;
    if (Array.isArray(list)) {
      for (let i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === id) return list[i];
      }
      return null;
    }
    // map/object keyed by id
    return list[id] || null;
  }

  function getSelectedId() {
    if (session && session.selectedStructureId != null) return session.selectedStructureId;
    if (session && session.ui && session.ui.selectedStructureId != null) return session.ui.selectedStructureId;
    return null;
  }

  function structDef(structure) {
    if (!structure) return null;
    if (structure.def) return structure.def;
    if (tables && tables.structures) {
      const defs = tables.structures;
      const key = structure.defId || structure.kind || structure.type;
      if (Array.isArray(defs)) {
        for (let i = 0; i < defs.length; i++) {
          if (defs[i] && (defs[i].id === key || defs[i].StructureID === key)) return defs[i];
        }
      } else if (defs[key]) {
        return defs[key];
      }
    }
    return null;
  }

  function num(v, d) {
    return (typeof v === 'number' && isFinite(v)) ? v : d;
  }

  function currentDps(structure) {
    if (structure.dps != null) return num(structure.dps, 0);
    if (structure.weapon && structure.weapon.dps != null) return num(structure.weapon.dps, 0);
    const def = structDef(structure);
    if (def) {
      const t = num(structure.tier, 1);
      const key = 'DPS T' + t;
      if (def[key] != null) return num(def[key], 0);
      if (def.dps != null) return num(def.dps, 0);
    }
    return 0;
  }

  function maxHp(structure) {
    if (structure.maxHp != null) return num(structure.maxHp, 1);
    const def = structDef(structure);
    if (def) {
      const t = num(structure.tier, 1);
      const key = 'HP T' + t;
      if (def[key] != null) return num(def[key], 1);
      if (def.hp != null) return num(def.hp, 1);
    }
    return num(structure.hp, 1);
  }

  function canTargetLabel(structure) {
    const def = structDef(structure);
    let ct = structure.canTarget || (def && (def['Can Target'] || def.canTarget));
    if (!ct) return '';
    if (ct === 'Both') return 'Anti-Air/Ground';
    if (ct === 'Air') return 'Anti-Air';
    if (ct === 'Ground') return 'Anti-Ground';
    return ct;
  }

  // ---- pricing (from assumptions upgrade/cost curves) ------------------

  function assumption(name, dflt) {
    if (tables && tables.assumptions) {
      const a = tables.assumptions;
      if (a[name] != null) return a[name];
      // array-of-rows form
      if (Array.isArray(a)) {
        for (let i = 0; i < a.length; i++) {
          if (a[i] && (a[i].Parameter === name || a[i].param === name)) {
            return a[i].Value != null ? a[i].Value : a[i].value;
          }
        }
      }
    }
    return dflt;
  }

  function upgradeCost(structure) {
    // Prefer sim-derived value if present.
    if (structure.upgradeCost != null) return num(structure.upgradeCost, 0);
    const def = structDef(structure);
    const t = num(structure.tier, 1);
    if (t >= 3) return null; // max tier
    const nextT = t + 1;
    if (def) {
      const key = 'Cost T' + nextT;
      const curKey = 'Cost T' + t;
      if (def[key] != null) {
        const next = num(def[key], 0);
        const cur = num(def[curKey], 0);
        return Math.max(0, Math.round(next - cur));
      }
      // fall back to base cost * multiplier
      const base = num(def['Cost T1'] || def.cost, 0);
      const mCur = t === 1 ? 1 : num(assumption('Upgrade_Cost_x_T2', 2.5), 2.5);
      const mNext = nextT === 2
        ? num(assumption('Upgrade_Cost_x_T2', 2.5), 2.5)
        : num(assumption('Upgrade_Cost_x_T3', 5), 5);
      return Math.max(0, Math.round(base * mNext - base * mCur));
    }
    return null;
  }

  function sellRefund(structure) {
    if (structure.sellRefund != null) return num(structure.sellRefund, 0);
    const def = structDef(structure);
    const t = num(structure.tier, 1);
    let invested = 0;
    if (def) {
      const key = 'Cost T' + t;
      invested = num(def[key] || def.cost || def['Cost T1'], 0);
    } else if (structure.cost != null) {
      invested = num(structure.cost, 0);
    }
    const refundRate = num(assumption('Sell_Refund_Rate', 0.5), 0.5);
    return Math.round(invested * refundRate);
  }

  function playerGold() {
    const world = getWorld();
    if (!world) return 0;
    if (world.economy && world.economy.gold != null) return world.economy.gold;
    if (world.gold != null) return world.gold;
    return 0;
  }

  // ---- command emission ------------------------------------------------

  function emit(cmd) {
    if (!controller) return;
    if (typeof controller.dispatch === 'function') controller.dispatch(cmd);
    else if (typeof controller.sendCommand === 'function') controller.sendCommand(cmd);
    else if (typeof controller.command === 'function') controller.command(cmd);
  }

  let boundStructureId = null;

  upgradeBtn.on('pointertap', () => {
    if (!upgradeBtn._enabled) return;
    emit({ type: 'upgrade', id: boundStructureId, structureId: boundStructureId });
  });

  repairBtn.on('pointertap', () => {
    if (!repairBtn._enabled) return;
    emit({ type: 'repair', id: boundStructureId, structureId: boundStructureId });
  });

  sellBtn.on('pointertap', () => {
    if (!sellBtn._enabled) return;
    emit({ type: 'sell', id: boundStructureId, structureId: boundStructureId });
    // Deselect after sell
    if (session) {
      if ('selectedStructureId' in session) session.selectedStructureId = null;
      if (session.ui && 'selectedStructureId' in session.ui) session.ui.selectedStructureId = null;
    }
  });

  // ---- per-frame update ------------------------------------------------

  function update() {
    const world = getWorld();
    const selId = getSelectedId();
    const structure = findStructure(world, selId);

    if (!structure) {
      root.visible = false;
      boundStructureId = null;
      return;
    }

    boundStructureId = structure.id;
    root.visible = true;

    const def = structDef(structure);
    const name =
      structure.name ||
      (def && (def.name || def.Name || def.StructureID)) ||
      structure.kind ||
      structure.type ||
      'Structure';

    const tier = num(structure.tier, 1);
    const state = structure.state || structure.lifecycle || 'Complete';
    const stateLbl = STATE_LABEL[state] || state;

    titleTxt.text = String(name);

    const targetLbl = canTargetLabel(structure);
    let sub = 'Tier ' + tier + '  ·  ' + stateLbl;
    if (targetLbl) sub += '  ·  ' + targetLbl;
    subTxt.text = sub;

    const hp = num(structure.hp, 0);
    const mhp = maxHp(structure);
    const dps = currentDps(structure);
    const range = num(structure.range, (def && (def.Range || def.range)) || 0);

    let stats = '';
    stats += 'DMG  ' + (dps ? dps.toFixed(1) + ' dps' : '—') + '\n';
    stats += 'RNG  ' + (range ? range.toFixed(1) + ' tiles' : '—') + '\n';
    stats += 'HP   ' + Math.round(hp) + ' / ' + Math.round(mhp);
    statTxt.text = stats;

    drawHpBar(hp, mhp, state);

    // progress line for building / upgrading
    let prog = '';
    const isBuilding = state === 'Building' || state === 'Placing';
    const isUpgrading = state === 'Upgrading';
    if (isBuilding || isUpgrading) {
      let p = null;
      if (structure.buildProgress != null) p = structure.buildProgress;
      else if (structure.progress != null) p = structure.progress;
      else if (structure.buildTimer != null && structure.buildTime != null && structure.buildTime > 0) {
        p = 1 - structure.buildTimer / structure.buildTime;
      }
      if (p != null) {
        prog = (isUpgrading ? 'Upgrading… ' : 'Building… ') + Math.round(Math.max(0, Math.min(1, p)) * 100) + '%';
      } else {
        prog = isUpgrading ? 'Upgrading…' : 'Building…';
      }
    } else if (structure.repairing || state === 'Repairing') {
      let rp = structure.repairProgress != null ? structure.repairProgress : null;
      prog = 'Repairing…' + (rp != null ? ' ' + Math.round(rp * 100) + '%' : '');
    }
    progTxt.text = prog;

    // ---- button states ----
    const gold = playerGold();
    const busy = isBuilding || isUpgrading || state === 'Selling' || state === 'Destroyed';

    // Upgrade
    const uCost = upgradeCost(structure);
    if (uCost == null) {
      upgradeBtn.setLabel(tier >= 3 ? 'Max Tier' : 'Upgrade');
      upgradeBtn.setEnabled(false);
    } else {
      upgradeBtn.setLabel('Up ' + uCost + 'g');
      upgradeBtn.setEnabled(!busy && gold >= uCost);
    }

    // Repair (free but consumes troops + time; only when damaged)
    const damaged = hp < mhp - 0.01;
    const troops = world && (
      (world.economy && world.economy.troops) != null ? world.economy.troops :
      (world.troops != null ? world.troops : null)
    );
    let repairOk = damaged && !busy;
    if (troops != null && troops <= 0) repairOk = false;
    if (structure.repairing) repairOk = false;
    repairBtn.setLabel(structure.repairing ? 'Repairing' : 'Repair');
    repairBtn.setEnabled(repairOk);

    // Sell
    const refund = sellRefund(structure);
    sellBtn.setLabel('Sell +' + refund + 'g');
    sellBtn.setEnabled(state !== 'Selling' && state !== 'Destroyed');
  }

  // ---- layout / API ----------------------------------------------------

  function setPosition(x, y) {
    root.position.set(x, y);
  }

  return {
    view: root,
    root,
    update,
    setPosition,
    width: PANEL_W,
    height: PANEL_H,
    destroy() {
      root.destroy({ children: true });
    },
  };
}

export default createSelectionPanel;