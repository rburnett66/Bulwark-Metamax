const PHASES = { BUILD: 'BUILD', COMBAT: 'COMBAT' };

export class WaveControls {
  constructor(app, world, controller, session) {
    this.app = app;
    this.world = world;
    this.controller = controller;
    this.session = session;

    this.container = new PIXI.Container();
    this.container.zIndex = 1000;

    // Panel background
    this.bg = new PIXI.Graphics();
    this.container.addChild(this.bg);

    // Wave / phase indicator text
    this.waveText = new PIXI.Text('Wave 0', {
      fontFamily: 'monospace',
      fontSize: 16,
      fill: 0xffffff,
      fontWeight: 'bold',
    });
    this.waveText.x = 12;
    this.waveText.y = 8;
    this.container.addChild(this.waveText);

    this.phaseText = new PIXI.Text('BUILD', {
      fontFamily: 'monospace',
      fontSize: 12,
      fill: 0xaad4ff,
    });
    this.phaseText.x = 12;
    this.phaseText.y = 30;
    this.container.addChild(this.phaseText);

    this.progressText = new PIXI.Text('', {
      fontFamily: 'monospace',
      fontSize: 11,
      fill: 0xcccccc,
    });
    this.progressText.x = 12;
    this.progressText.y = 48;
    this.container.addChild(this.progressText);

    // Start-wave button
    this.button = new PIXI.Container();
    this.button.x = 12;
    this.button.y = 70;
    this.container.addChild(this.button);

    this.btnBg = new PIXI.Graphics();
    this.button.addChild(this.btnBg);

    this.btnText = new PIXI.Text('START WAVE', {
      fontFamily: 'monospace',
      fontSize: 14,
      fill: 0xffffff,
      fontWeight: 'bold',
    });
    this.button.addChild(this.btnText);

    this.button.eventMode = 'static';
    this.button.cursor = 'pointer';
    this.button.on('pointertap', () => this.onStartWave());
    this.button.on('pointerover', () => { this._hover = true; });
    this.button.on('pointerout', () => { this._hover = false; });

    // Speed control button
    this.speedButton = new PIXI.Container();
    this.speedButton.x = 12;
    this.speedButton.y = 108;
    this.container.addChild(this.speedButton);

    this.speedBg = new PIXI.Graphics();
    this.speedButton.addChild(this.speedBg);

    this.speedText = new PIXI.Text('SPEED 1x', {
      fontFamily: 'monospace',
      fontSize: 12,
      fill: 0xffffff,
    });
    this.speedButton.addChild(this.speedText);

    this.speedButton.eventMode = 'static';
    this.speedButton.cursor = 'pointer';
    this.speedButton.on('pointertap', () => this.onSpeedToggle());

    this._hover = false;
    this._btnEnabled = true;
    this._speeds = [1, 2, 4, 0];
    this._speedIdx = 0;

    this._layout();
  }

  _layout() {
    const w = 150;
    const h = 138;
    this.bg.clear();
    this.bg.beginFill(0x101820, 0.85);
    this.bg.lineStyle(1, 0x335577, 0.8);
    this.bg.drawRoundedRect(0, 0, w, h, 6);
    this.bg.endFill();

    this._drawButton();
    this._drawSpeed();
  }

  _drawButton() {
    const w = 126;
    const h = 30;
    let fill = 0x2a6a2a;
    if (!this._btnEnabled) fill = 0x444444;
    else if (this._hover) fill = 0x3a8a3a;

    this.btnBg.clear();
    this.btnBg.beginFill(fill, this._btnEnabled ? 1 : 0.6);
    this.btnBg.lineStyle(1, 0x88cc88, this._btnEnabled ? 0.9 : 0.3);
    this.btnBg.drawRoundedRect(0, 0, w, h, 4);
    this.btnBg.endFill();

    this.btnText.x = (w - this.btnText.width) / 2;
    this.btnText.y = (h - this.btnText.height) / 2;
    this.btnText.alpha = this._btnEnabled ? 1 : 0.5;
  }

  _drawSpeed() {
    const w = 126;
    const h = 22;
    this.speedBg.clear();
    this.speedBg.beginFill(0x223344, 1);
    this.speedBg.lineStyle(1, 0x557799, 0.8);
    this.speedBg.drawRoundedRect(0, 0, w, h, 4);
    this.speedBg.endFill();
    this.speedText.x = (w - this.speedText.width) / 2;
    this.speedText.y = (h - this.speedText.height) / 2;
  }

  onStartWave() {
    if (!this._btnEnabled) return;
    this.controller.startWave();
  }

  onSpeedToggle() {
    this._speedIdx = (this._speedIdx + 1) % this._speeds.length;
    const spd = this._speeds[this._speedIdx];
    if (this.session) this.session.speed = spd;
    if (this.controller && this.controller.setSpeed) this.controller.setSpeed(spd);
    this.speedText.text = spd === 0 ? 'PAUSED' : ('SPEED ' + spd + 'x');
    this._drawSpeed();
  }

  update() {
    const w = this.world;
    if (!w || !w.state) return;
    const s = w.state;

    const waveState = s.waves || {};
    const current = waveState.current != null ? waveState.current : 0;
    const total = waveState.total != null ? waveState.total : (waveState.count || 0);
    const active = !!waveState.active;
    const spawnedAll = !!waveState.spawnedAll;
    const aliveAttackers = countAttackers(s);
    const pending = waveState.pendingSpawns != null ? waveState.pendingSpawns : 0;

    this.waveText.text = 'Wave ' + current + ' / ' + total;

    let phase = active ? PHASES.COMBAT : PHASES.BUILD;
    if (s.gameOver) phase = s.win ? 'VICTORY' : 'DEFEAT';

    this.phaseText.text = phase;
    this.phaseText.style.fill = active ? 0xffcc66 : 0xaad4ff;

    if (active) {
      this.progressText.text = 'enemies: ' + aliveAttackers +
        (pending > 0 ? ' (+' + pending + ')' : '');
    } else if (current >= total && current > 0) {
      this.progressText.text = 'all waves cleared';
    } else {
      this.progressText.text = 'ready to send';
    }

    // Button enabled only during BUILD phase and not game over and waves remain
    const canStart = !active && !s.gameOver && current < total;
    if (canStart !== this._btnEnabled) {
      this._btnEnabled = canStart;
    }
    this._drawButton();
  }

  resize(width, height) {
    // Anchor bottom-left
    this.container.x = 12;
    this.container.y = height - 138 - 12;
  }
}

function countAttackers(s) {
  let n = 0;
  const ents = s.entities || {};
  if (Array.isArray(ents)) {
    for (const e of ents) {
      if (e && e.faction === 'attacker' && !e.dead) n++;
      else if (e && (e.type === 'walker' || e.type === 'floater' || e.type === 'flyer') && !e.dead) n++;
    }
    return n;
  }
  const list = s.attackers || s.units || [];
  for (const e of list) {
    if (e && !e.dead) n++;
  }
  return n;
}

export default WaveControls;