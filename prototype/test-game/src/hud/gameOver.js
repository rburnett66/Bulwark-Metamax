// src/hud/gameOver.js
// Win/Lose overlay + replay trigger.
// Reads the strict sim world state (never mutates it) and presents a
// screen-space overlay when the battle ends (win = survived all waves,
// lose = base HP reached 0). Provides a "REPLAY" button that re-drives the
// deterministic headless core from the battle log and reports the result,
// plus a "RESTART" button that reboots a fresh session with the same seed.
//
// Built with PRIMITIVES only (rectangles + text) via pixi.js.

import { PIXI } from '../render/renderer.js';

/**
 * GameOverOverlay
 *
 * Usage:
 *   const overlay = new GameOverOverlay({
 *     app,                // pixi.Application
 *     layer,              // parent Container (HUD layer)
 *     onRestart,          // () => void   -> boot a fresh session
 *     onReplayVerify,     // () => {ok, detail}  -> re-drive headless from log
 *   });
 *   // each frame / on state change:
 *   overlay.sync(world);
 */
export class GameOverOverlay {
  constructor({ app, layer, onRestart, onReplayVerify } = {}) {
    this.app = app;
    this.parentLayer = layer || (app && app.stage);
    this.onRestart = typeof onRestart === 'function' ? onRestart : () => {};
    this.onReplayVerify =
      typeof onReplayVerify === 'function' ? onReplayVerify : () => ({ ok: false, detail: 'no verifier' });

    this._lastOutcome = null; // 'win' | 'lose' | null
    this._visible = false;
    this._replayResultText = '';

    this._buildDisplay();
    this._layout();
    this.hide();

    // reposition on resize
    if (this.app && this.app.renderer) {
      this._onResize = () => this._layout();
      window.addEventListener('resize', this._onResize);
    }
  }

  _screenSize() {
    const r = this.app && this.app.renderer;
    if (r && r.screen) return { w: r.screen.width, h: r.screen.height };
    if (r) return { w: r.width, h: r.height };
    return { w: 960, h: 640 };
  }

  _buildDisplay() {
    // Root container lives on top of the HUD layer.
    this.root = new PIXI.Container();
    this.root.zIndex = 10000;
    this.root.eventMode = 'static';

    // Dim backdrop that eats pointer events so the game underneath is inert.
    this.backdrop = new PIXI.Graphics();
    this.backdrop.eventMode = 'static';
    this.backdrop.cursor = 'default';
    this.backdrop.on('pointerdown', (e) => {
      // swallow; do nothing (keep overlay modal)
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    });
    this.root.addChild(this.backdrop);

    // Panel
    this.panel = new PIXI.Container();
    this.root.addChild(this.panel);

    this.panelBg = new PIXI.Graphics();
    this.panel.addChild(this.panelBg);

    // Title text
    this.titleText = new PIXI.Text('', {
      fontFamily: 'monospace',
      fontSize: 42,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center',
    });
    this.titleText.anchor.set(0.5, 0.5);
    this.panel.addChild(this.titleText);

    // Subtitle / stats text
    this.subText = new PIXI.Text('', {
      fontFamily: 'monospace',
      fontSize: 16,
      fill: 0xdddddd,
      align: 'center',
      lineHeight: 22,
    });
    this.subText.anchor.set(0.5, 0.5);
    this.panel.addChild(this.subText);

    // Replay verify result text
    this.replayText = new PIXI.Text('', {
      fontFamily: 'monospace',
      fontSize: 14,
      fill: 0x9fe6ff,
      align: 'center',
      lineHeight: 20,
    });
    this.replayText.anchor.set(0.5, 0.5);
    this.panel.addChild(this.replayText);

    // Buttons
    this.btnRestart = this._makeButton('RESTART', 0x2e7d32, 0x43a047, () => {
      this._replayResultText = '';
      this.replayText.text = '';
      this.onRestart();
    });
    this.btnReplay = this._makeButton('VERIFY REPLAY', 0x1565c0, 0x1e88e5, () => {
      this._runReplayVerify();
    });
    this.panel.addChild(this.btnRestart);
    this.panel.addChild(this.btnReplay);

    if (this.parentLayer) {
      this.parentLayer.sortableChildren = true;
      this.parentLayer.addChild(this.root);
    }
  }

  _makeButton(label, baseColor, hoverColor, onClick) {
    const btn = new PIXI.Container();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    const bg = new PIXI.Graphics();
    btn.addChild(bg);

    const txt = new PIXI.Text(label, {
      fontFamily: 'monospace',
      fontSize: 16,
      fontWeight: 'bold',
      fill: 0xffffff,
    });
    txt.anchor.set(0.5, 0.5);
    btn.addChild(txt);

    btn._w = 200;
    btn._h = 48;
    btn._baseColor = baseColor;
    btn._hoverColor = hoverColor;
    btn._bg = bg;
    btn._txt = txt;
    btn._hover = false;

    const redraw = () => {
      bg.clear();
      const c = btn._hover ? hoverColor : baseColor;
      bg.beginFill(c, 1);
      bg.lineStyle(2, 0xffffff, 0.35);
      bg.drawRoundedRect(-btn._w / 2, -btn._h / 2, btn._w, btn._h, 8);
      bg.endFill();
    };
    btn._redraw = redraw;
    redraw();

    btn.on('pointerover', () => {
      btn._hover = true;
      redraw();
    });
    btn.on('pointerout', () => {
      btn._hover = false;
      redraw();
    });
    btn.on('pointerdown', (e) => {
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      onClick();
    });

    return btn;
  }

  _layout() {
    const { w, h } = this._screenSize();

    // Backdrop covers full screen.
    this.backdrop.clear();
    this.backdrop.beginFill(0x000000, 0.6);
    this.backdrop.drawRect(0, 0, w, h);
    this.backdrop.endFill();
    // Ensure hit area covers everything even if size shrinks later.
    this.backdrop.hitArea = new PIXI.Rectangle(0, 0, w, h);

    // Panel dimensions
    const pw = Math.min(520, Math.max(360, w * 0.6));
    const ph = 340;
    const px = w / 2;
    const py = h / 2;

    this.panelBg.clear();
    this.panelBg.beginFill(0x161a22, 0.96);
    this.panelBg.lineStyle(3, 0x3d4658, 1);
    this.panelBg.drawRoundedRect(-pw / 2, -ph / 2, pw, ph, 14);
    this.panelBg.endFill();

    this.panel.position.set(px, py);

    this.titleText.position.set(0, -ph / 2 + 55);
    this.subText.position.set(0, -ph / 2 + 130);
    this.replayText.position.set(0, ph / 2 - 105);

    // Buttons row
    const btnY = ph / 2 - 45;
    const gap = 24;
    const totalW = this.btnRestart._w + this.btnReplay._w + gap;
    this.btnRestart.position.set(-totalW / 2 + this.btnRestart._w / 2, btnY);
    this.btnReplay.position.set(totalW / 2 - this.btnReplay._w / 2, btnY);
  }

  _runReplayVerify() {
    let result;
    try {
      result = this.onReplayVerify();
    } catch (err) {
      result = { ok: false, detail: 'replay threw: ' + (err && err.message ? err.message : String(err)) };
    }
    if (!result) result = { ok: false, detail: 'no result' };
    if (result.ok) {
      this.replayText.style.fill = 0x7cff9a;
      this._replayResultText = 'REPLAY OK — determinism verified.\n' + (result.detail || '');
    } else {
      this.replayText.style.fill = 0xff8888;
      this._replayResultText = 'REPLAY MISMATCH!\n' + (result.detail || '');
    }
    this.replayText.text = this._replayResultText;
  }

  _computeOutcome(world) {
    if (!world) return null;
    // Prefer explicit sim flags if present.
    const g = world.game || world;
    // Common shapes: world.status / world.game.status / world.outcome
    const status =
      (g && g.status) ||
      (world && world.status) ||
      (g && g.outcome) ||
      (world && world.outcome) ||
      null;

    if (status === 'win' || status === 'won' || status === 'victory') return 'win';
    if (status === 'lose' || status === 'lost' || status === 'defeat' || status === 'gameover') return 'lose';

    // Fallback: derive from base HP + wave progress.
    const base = (world.base) || (g && g.base) || null;
    const baseHp = base ? (base.hp != null ? base.hp : base.health) : null;
    if (baseHp != null && baseHp <= 0) return 'lose';

    // Win detection: all waves cleared and no attackers remain.
    const wavesTotal =
      (world.waves && (world.waves.total != null ? world.waves.total : world.waves.count)) ||
      (g && g.waves && (g.waves.total != null ? g.waves.total : g.waves.count)) ||
      null;
    const wavesDone =
      (world.waves && (world.waves.completed != null ? world.waves.completed : world.waves.cleared)) ||
      (g && g.waves && (g.waves.completed != null ? g.waves.completed : g.waves.cleared)) ||
      null;
    const attackers =
      (world.attackers && world.attackers.length) ||
      (world.units && world.units.length) ||
      0;

    if (wavesTotal != null && wavesDone != null && wavesDone >= wavesTotal && attackers === 0) {
      return 'win';
    }

    if (world.won === true) return 'win';
    if (world.lost === true) return 'lose';

    return null;
  }

  _statLine(world) {
    const g = world.game || world;
    const base = (world.base) || (g && g.base) || null;
    const baseHp = base ? Math.max(0, Math.round(base.hp != null ? base.hp : (base.health || 0))) : 0;
    const baseMax = base ? Math.round(base.maxHp != null ? base.maxHp : (base.hpMax || base.hp || 0)) : 0;

    const wavesDone =
      (world.waves && (world.waves.completed != null ? world.waves.completed : world.waves.cleared)) != null
        ? (world.waves.completed != null ? world.waves.completed : world.waves.cleared)
        : (g && g.waves && (g.waves.completed != null ? g.waves.completed : g.waves.cleared)) || 0;
    const wavesTotal =
      (world.waves && (world.waves.total != null ? world.waves.total : world.waves.count)) != null
        ? (world.waves.total != null ? world.waves.total : world.waves.count)
        : (g && g.waves && (g.waves.total != null ? g.waves.total : g.waves.count)) || 0;

    const gold = Math.round(
      (world.economy && world.economy.gold) != null
        ? world.economy.gold
        : (world.gold != null ? world.gold : (g && g.gold) || 0)
    );

    const tick = world.tick != null ? world.tick : (g && g.tick) || 0;
    const seed = world.seed != null ? world.seed : (g && g.seed) || 0;

    return (
      `Base HP: ${baseHp}/${baseMax}\n` +
      `Waves: ${wavesDone}/${wavesTotal}\n` +
      `Gold: ${gold}\n` +
      `Ticks: ${tick}   Seed: ${seed}`
    );
  }

  /**
   * sync(world) — called each frame. Shows overlay on win/lose, hides otherwise.
   */
  sync(world) {
    const outcome = this._computeOutcome(world);

    if (!outcome) {
      if (this._visible) this.hide();
      this._lastOutcome = null;
      return;
    }

    // New outcome -> configure text once.
    if (outcome !== this._lastOutcome) {
      this._lastOutcome = outcome;
      if (outcome === 'win') {
        this.titleText.text = 'VICTORY';
        this.titleText.style.fill = 0x7cff9a;
        this.panelBg.tint = 0xffffff;
      } else {
        this.titleText.text = 'DEFEAT';
        this.titleText.style.fill = 0xff6b6b;
      }
      this.subText.text = this._statLine(world);
      // Reset replay result whenever a fresh outcome is presented.
      this._replayResultText = '';
      this.replayText.text = '';
    } else {
      // Keep stat line reasonably fresh.
      this.subText.text = this._statLine(world);
    }

    if (!this._visible) this.show();
  }

  show() {
    this._visible = true;
    this.root.visible = true;
    this.root.eventMode = 'static';
    this._layout();
  }

  hide() {
    this._visible = false;
    this.root.visible = false;
  }

  isVisible() {
    return this._visible;
  }

  destroy() {
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    if (this.root && this.root.parent) this.root.parent.removeChild(this.root);
    if (this.root) this.root.destroy({ children: true });
    this.root = null;
  }
}

export default GameOverOverlay;