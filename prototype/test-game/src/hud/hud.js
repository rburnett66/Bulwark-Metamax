// src/hud/hud.js
// Screen-space HUD root: base HP, gold, wave counter, controls.
// Reads sim world state; issues commands via controller/session callbacks.
// Uses pixi.js primitives ONLY. Never mutates sim state.

import { BuildPalette } from './buildPalette.js';
import { SelectionPanel } from './selectionPanel.js';
import { WaveControls } from './waveControls.js';
import { GameOverOverlay } from './gameOver.js';

const PIXI = window.PIXI;

const COL = {
  panelBg: 0x11151c,
  panelBorder: 0x2a3542,
  text: 0xe8eef4,
  textDim: 0x8a97a6,
  hp: 0x54d67a,
  hpBad: 0xd65454,
  hpBg: 0x223,
  gold: 0xf2c744,
  wave: 0x6fb8e6,
  goldUp: 0x7ee08a,
  goldDown: 0xe07e7e,
};

function label(txt, size, color) {
  return new PIXI.Text(txt, {
    fontFamily: 'monospace',
    fontSize: size,
    fill: color,
    fontWeight: 'bold',
  });
}

/**
 * HUD — screen-space overlay. Sits in the HUD layer (topmost, never rotates).
 *
 * @param {object} opts
 * @param {PIXI.Container} opts.layer   - HUD render layer container
 * @param {object} opts.session         - session state glue
 * @param {object} opts.controller      - input controller (issues commands)
 * @param {function} opts.getWorld      - () => current sim world snapshot
 * @param {function} opts.onReplay      - callback to trigger replay
 * @param {number} opts.screenW
 * @param {number} opts.screenH
 */
export class HUD {
  constructor(opts) {
    this.layer = opts.layer;
    this.session = opts.session;
    this.controller = opts.controller;
    this.getWorld = opts.getWorld;
    this.onReplay = opts.onReplay || (() => {});
    this.screenW = opts.screenW || 1280;
    this.screenH = opts.screenH || 720;

    this.root = new PIXI.Container();
    this.root.zIndex = 10000;
    this.layer.addChild(this.root);

    // Animated gold display state
    this._displayGold = 0;
    this._lastGold = null;
    this._goldFlashTimer = 0;
    this._goldFlashDir = 0;

    this._buildTopBar();
    this._buildControls();

    // Sub-panels
    this.buildPalette = new BuildPalette({
      root: this.root,
      session: this.session,
      controller: this.controller,
      getWorld: this.getWorld,
      x: 8,
      y: this.screenH - 132,
    });

    this.selectionPanel = new SelectionPanel({
      root: this.root,
      session: this.session,
      controller: this.controller,
      getWorld: this.getWorld,
      x: this.screenW - 268,
      y: 96,
    });

    this.waveControls = new WaveControls({
      root: this.root,
      session: this.session,
      controller: this.controller,
      getWorld: this.getWorld,
      x: this.screenW / 2 - 120,
      y: this.screenH - 60,
    });

    this.gameOver = new GameOverOverlay({
      root: this.root,
      screenW: this.screenW,
      screenH: this.screenH,
      onReplay: this.onReplay,
    });
  }

  _buildTopBar() {
    const bar = new PIXI.Container();
    this.root.addChild(bar);
    this.topBar = bar;

    const bg = new PIXI.Graphics();
    bg.beginFill(COL.panelBg, 0.9);
    bg.lineStyle(1, COL.panelBorder, 1);
    bg.drawRect(0, 0, this.screenW, 42);
    bg.endFill();
    bar.addChild(bg);

    // ---- Base HP ----
    this.hpLabel = label('BASE', 12, COL.textDim);
    this.hpLabel.position.set(12, 6);
    bar.addChild(this.hpLabel);

    this.hpBarBg = new PIXI.Graphics();
    bar.addChild(this.hpBarBg);
    this.hpBarFill = new PIXI.Graphics();
    bar.addChild(this.hpBarFill);
    this._hpBarX = 60;
    this._hpBarY = 22;
    this._hpBarW = 180;
    this._hpBarH = 12;

    this.hpText = label('0 / 0', 12, COL.text);
    this.hpText.position.set(this._hpBarX + this._hpBarW + 8, 6);
    bar.addChild(this.hpText);

    // ---- Gold ----
    this.goldIcon = new PIXI.Graphics();
    this.goldIcon.beginFill(COL.gold);
    this.goldIcon.drawCircle(0, 0, 8);
    this.goldIcon.endFill();
    this.goldIcon.position.set(this.screenW * 0.5 - 60, 21);
    bar.addChild(this.goldIcon);

    this.goldText = label('0', 20, COL.gold);
    this.goldText.position.set(this.screenW * 0.5 - 46, 10);
    bar.addChild(this.goldText);

    this.goldDelta = label('', 13, COL.goldUp);
    this.goldDelta.position.set(this.screenW * 0.5 + 60, 12);
    bar.addChild(this.goldDelta);

    // ---- Wave counter ----
    this.waveText = label('WAVE 0 / 0', 16, COL.wave);
    this.waveText.anchor.set(1, 0);
    this.waveText.position.set(this.screenW - 12, 12);
    bar.addChild(this.waveText);

    this.phaseText = label('', 11, COL.textDim);
    this.phaseText.anchor.set(1, 0);
    this.phaseText.position.set(this.screenW - 130, 15);
    bar.addChild(this.phaseText);
  }

  _buildControls() {
    // Bottom-left global controls: pause, speed, mode toggle
    const c = new PIXI.Container();
    c.position.set(8, this.screenH - 172);
    this.root.addChild(c);
    this.controlsBox = c;

    const bg = new PIXI.Graphics();
    bg.beginFill(COL.panelBg, 0.9);
    bg.lineStyle(1, COL.panelBorder, 1);
    bg.drawRect(0, 0, 320, 32);
    bg.endFill();
    c.addChild(bg);

    this._pauseBtn = this._makeButton(c, 4, 4, 68, 24, 'PAUSE', () => {
      this.session.paused = !this.session.paused;
      this._refreshControlLabels();
    });

    this._speedBtn = this._makeButton(c, 78, 4, 60, 24, '1x', () => {
      const speeds = [1, 2, 4];
      const cur = this.session.speed || 1;
      const idx = speeds.indexOf(cur);
      this.session.speed = speeds[(idx + 1) % speeds.length];
      this._refreshControlLabels();
    });

    this._modeBtn = this._makeButton(c, 144, 4, 84, 24, 'BUILD', () => {
      this.session.mode = this.session.mode === 'build' ? 'deploy' : 'build';
      this.session.selectedStructureId = null;
      this.session.selectedBuildKey = null;
      this._refreshControlLabels();
    });

    this._replayBtn = this._makeButton(c, 234, 4, 82, 24, 'REPLAY', () => {
      this.onReplay();
    });

    this._refreshControlLabels();
  }

  _makeButton(parent, x, y, w, h, text, onClick) {
    const btn = new PIXI.Container();
    btn.position.set(x, y);
    parent.addChild(btn);

    const g = new PIXI.Graphics();
    btn.addChild(g);
    const t = label(text, 12, COL.text);
    t.anchor.set(0.5);
    t.position.set(w / 2, h / 2);
    btn.addChild(t);

    const draw = (hover) => {
      g.clear();
      g.beginFill(hover ? 0x2c3846 : 0x1c2530, 1);
      g.lineStyle(1, COL.panelBorder, 1);
      g.drawRoundedRect(0, 0, w, h, 4);
      g.endFill();
    };
    draw(false);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.hitArea = new PIXI.Rectangle(0, 0, w, h);
    btn.on('pointerover', () => draw(true));
    btn.on('pointerout', () => draw(false));
    btn.on('pointertap', (e) => {
      e.stopPropagation();
      onClick();
    });

    btn._setText = (s) => { t.text = s; };
    return btn;
  }

  _refreshControlLabels() {
    this._pauseBtn._setText(this.session.paused ? 'RESUME' : 'PAUSE');
    this._speedBtn._setText((this.session.speed || 1) + 'x');
    this._modeBtn._setText(this.session.mode === 'deploy' ? 'DEPLOY' : 'BUILD');
  }

  // Called every render frame.
  update(dt) {
    const world = this.getWorld();
    if (!world) return;

    this._updateTopBar(world, dt);
    this._refreshControlLabels();

    this.buildPalette.update(world);
    this.selectionPanel.update(world);
    this.waveControls.update(world);
    this.gameOver.update(world);
  }

  _updateTopBar(world, dt) {
    const base = world.base || {};
    const maxHp = base.maxHp || base.hpMax || 1;
    const hp = Math.max(0, base.hp != null ? base.hp : 0);
    const frac = Math.max(0, Math.min(1, hp / maxHp));

    // HP bar
    this.hpBarBg.clear();
    this.hpBarBg.beginFill(COL.hpBg, 1);
    this.hpBarBg.lineStyle(1, COL.panelBorder, 1);
    this.hpBarBg.drawRect(this._hpBarX, this._hpBarY, this._hpBarW, this._hpBarH);
    this.hpBarBg.endFill();

    this.hpBarFill.clear();
    const hpColor = frac > 0.35 ? COL.hp : COL.hpBad;
    this.hpBarFill.beginFill(hpColor, 1);
    this.hpBarFill.drawRect(this._hpBarX + 1, this._hpBarY + 1,
      Math.max(0, (this._hpBarW - 2) * frac), this._hpBarH - 2);
    this.hpBarFill.endFill();

    this.hpText.text = Math.ceil(hp) + ' / ' + Math.ceil(maxHp);

    // ---- Gold (animated deltas) ----
    const econ = world.economy || {};
    const gold = econ.gold != null ? econ.gold : (econ.money != null ? econ.money : 0);

    if (this._lastGold == null) {
      this._lastGold = gold;
      this._displayGold = gold;
    }

    if (gold !== this._lastGold) {
      const diff = gold - this._lastGold;
      this._goldFlashDir = diff > 0 ? 1 : -1;
      this._goldFlashTimer = 1.0;
      this.goldDelta.text = (diff > 0 ? '+' : '') + Math.round(diff);
      this.goldDelta.style.fill = diff > 0 ? COL.goldUp : COL.goldDown;
      this._lastGold = gold;
    }

    // ease display gold toward real
    const dg = gold - this._displayGold;
    if (Math.abs(dg) < 0.5) this._displayGold = gold;
    else this._displayGold += dg * Math.min(1, dt * 8);
    this.goldText.text = Math.round(this._displayGold).toString();

    if (this._goldFlashTimer > 0) {
      this._goldFlashTimer -= dt;
      const a = Math.max(0, this._goldFlashTimer);
      this.goldDelta.alpha = a;
      this.goldDelta.y = 12 - (1 - a) * 8 * this._goldFlashDir;
    } else {
      this.goldDelta.alpha = 0;
    }

    // Bankruptcy tint
    this.goldText.style.fill = gold <= 0 ? COL.goldDown : COL.gold;

    // ---- Wave counter ----
    const w = world.waves || {};
    const cur = w.current != null ? w.current : (w.wave != null ? w.wave : 0);
    const total = w.total != null ? w.total : (w.count != null ? w.count : 0);
    this.waveText.text = 'WAVE ' + cur + ' / ' + total;

    let phase = 'BUILD';
    if (w.phase) phase = String(w.phase).toUpperCase();
    else if (w.active || w.inProgress) phase = 'COMBAT';
    this.phaseText.text = phase;
  }

  resize(w, h) {
    this.screenW = w;
    this.screenH = h;
    // Redraw top bar background width & reposition key elements.
    if (this.topBar) {
      const bg = this.topBar.getChildAt(0);
      bg.clear();
      bg.beginFill(COL.panelBg, 0.9);
      bg.lineStyle(1, COL.panelBorder, 1);
      bg.drawRect(0, 0, w, 42);
      bg.endFill();
      this.goldIcon.position.set(w * 0.5 - 60, 21);
      this.goldText.position.set(w * 0.5 - 46, 10);
      this.goldDelta.position.set(w * 0.5 + 60, 12);
      this.waveText.position.set(w - 12, 12);
      this.phaseText.position.set(w - 130, 15);
    }
  }

  destroy() {
    if (this.buildPalette && this.buildPalette.destroy) this.buildPalette.destroy();
    if (this.selectionPanel && this.selectionPanel.destroy) this.selectionPanel.destroy();
    if (this.waveControls && this.waveControls.destroy) this.waveControls.destroy();
    if (this.gameOver && this.gameOver.destroy) this.gameOver.destroy();
    if (this.root && this.root.parent) this.root.parent.removeChild(this.root);
    this.root.destroy({ children: true });
  }
}

export default HUD;