(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.mechanics=window.MMKit.mechanics||{};
MMKit.mechanics.DeterministicPlay = function (config, game) {
  config = config || {};
  var STEP = 1 / 60; // fixed timestep (T2)

  // ---- External-style balance table; core reads, never re-derives (T5) ----
  var BAL = {
    startGold: 120,
    baseHP: 100,
    repairPerHP: 0.3,
    sellFactor: 0.5,
    structures: {
      Cannon: { tiers: [
        { cost: 40, hp: 60,  dmg: 8,  range: 150, rate: 1.0 },
        { cost: 60, hp: 90,  dmg: 14, range: 180, rate: 1.2 },
        { cost: 90, hp: 130, dmg: 24, range: 210, rate: 1.5 }
      ]},
      Wall: { tiers: [
        { cost: 25, hp: 150, dmg: 0, range: 0, rate: 0 },
        { cost: 35, hp: 280, dmg: 0, range: 0, rate: 0 },
        { cost: 50, hp: 450, dmg: 0, range: 0, rate: 0 }
      ]}
    },
    enemies: {
      grunt:  { hp: 30, speed: 40, dmg: 5,  cost: 8 },
      runner: { hp: 18, speed: 72, dmg: 4,  cost: 6 },
      brute:  { hp: 90, speed: 26, dmg: 14, cost: 22 }
    },
    waves: [
      { reward: 40, list: [
        { t: 0.5, type: 'grunt' }, { t: 1.7, type: 'grunt' }, { t: 2.9, type: 'grunt' },
        { t: 4.1, type: 'grunt' }, { t: 5.3, type: 'grunt' }, { t: 6.5, type: 'grunt' }
      ]},
      { reward: 60, list: [
        { t: 0.5, type: 'grunt' }, { t: 1.3, type: 'runner' }, { t: 2.1, type: 'grunt' },
        { t: 2.9, type: 'runner' }, { t: 3.7, type: 'grunt' }, { t: 4.5, type: 'runner' },
        { t: 5.3, type: 'grunt' }, { t: 6.1, type: 'runner' }
      ]},
      { reward: 80, list: [
        { t: 0.5, type: 'brute' }, { t: 1.5, type: 'grunt' }, { t: 2.0, type: 'runner' },
        { t: 2.5, type: 'grunt' }, { t: 3.5, type: 'brute' }, { t: 4.5, type: 'runner' },
        { t: 5.0, type: 'runner' }, { t: 5.5, type: 'grunt' }, { t: 6.5, type: 'brute' },
        { t: 7.5, type: 'grunt' }
      ]}
    ],
    story: [
      'The Powder scouts cheer: the first Greenie probe is scattered!',
      'Chem fumes thin out. The Castle walls hold. Greenies regroup...',
      'The Greenie warhost breaks! The continent lane is ours.'
    ]
  };

  // ---- Deterministic core state (T1) ----
  var seed = (config.seed | 0) || 20240601;
  var rs = seed >>> 0;
  function rnd() { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; }

  game.score = 0;
  game.win = false;

  var laneY = R.H * 0.58;
  var castleX = 70;
  var spawnX = R.W - 40;

  var SLOT_N = 5;
  var slots = [];
  (function () {
    var x0 = castleX + 130, x1 = spawnX - 110;
    for (var i = 0; i < SLOT_N; i++) {
      slots.push({ x: x0 + i * ((x1 - x0) / (SLOT_N - 1)), structure: null });
    }
  })();

  var gold = BAL.startGold;
  var baseHP = BAL.baseHP;
  var wave = 0;                 // 0..2 (F3)
  var phase = 'BUILD';          // BUILD -> BATTLE -> COLLECT (F2)
  var simTime = 0, acc = 0, spawnIdx = 0;
  var enemies = [];
  var selSlot = -1;
  var staged = null;            // staged pick awaiting confirm (P1)
  var buttons = [];
  var beams = [];               // presentation only
  var flash = '';
  var flashT = 0;
  var battleLog = { seed: seed, inputs: [] }; // (T3)
  game.battleLog = battleLog;

  // presentation toggles (T4) — never touch core state
  var altPalette = false, captions = true;

  function logInput(a) { battleLog.inputs.push({ wave: wave + 1, phase: phase, t: Math.round(simTime * 1000), a: a }); }

  function tierStat(s) { return BAL.structures[s.type].tiers[s.tier - 1]; }
  function say(msg) { flash = msg; flashT = 1.6; }

  function inRect(px, py, r) { return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h; }

  function repairCost(s) {
    var st = tierStat(s);
    return Math.ceil((st.hp - s.hp) * BAL.repairPerHP);
  }
  function sellRefund(s) { return Math.floor(s.spent * BAL.sellFactor); }

  function commitStaged() {
    if (!staged) return;
    var slot = slots[selSlot];
    if (staged.kind === 'build') {
      var t0 = BAL.structures[staged.type].tiers[0];
      if (gold < t0.cost) { say('Not enough gold'); return; }
      gold -= t0.cost;
      slot.structure = { type: staged.type, tier: 1, hp: t0.hp, spent: t0.cost, cool: 0 };
      logInput('build:' + staged.type + '@' + selSlot);
    } else if (staged.kind === 'upgrade') {
      var s = slot.structure;
      var nx = BAL.structures[s.type].tiers[s.tier];
      if (gold < nx.cost) { say('Not enough gold'); return; }
      gold -= nx.cost;
      s.tier++; s.hp = nx.hp; s.spent += nx.cost;
      logInput('upgrade@' + selSlot + '->T' + s.tier);
    } else if (staged.kind === 'repair') {
      var s2 = slot.structure;
      var c = repairCost(s2);
      if (gold < c) { say('Not enough gold'); return; }
      gold -= c;
      s2.hp = tierStat(s2).hp;
      logInput('repair@' + selSlot);
    } else if (staged.kind === 'sell') {
      gold += sellRefund(slot.structure);
      slot.structure = null;
      logInput('sell@' + selSlot);
    }
    staged = null;
  }

  function startBattle() {
    logInput('ready:wave' + (wave + 1));
    phase = 'BATTLE';
    simTime = 0; acc = 0; spawnIdx = 0;
    enemies = [];
    selSlot = -1; staged = null;
  }

  function endSlice(won) {
    game.win = won;
    game.baseHP = baseHP;
    game.gold = gold;
    R.go(game.resultsState || 'RESULTS');
  }

  // ---- Fixed-step deterministic battle simulation (T1, T2, F5) ----
  function simStep() {
    simTime += STEP;
    var list = BAL.waves[wave].list;
    while (spawnIdx < list.length && list[spawnIdx].t <= simTime) {
      var sp = list[spawnIdx];
      var st = BAL.enemies[sp.type];
      enemies.push({
        type: sp.type, x: spawnX, y: laneY + ((spawnIdx % 3) - 1) * 9,
        hp: st.hp, max: st.hp, spd: st.speed, dmg: st.dmg, cost: st.cost, atk: 0
      });
      spawnIdx++;
    }
    var i, j, e;
    for (i = 0; i < enemies.length; i++) {
      e = enemies[i];
      e.atk -= STEP;
      // rightmost structure ahead of this enemy blocks it (single lane, F1)
      var blockSlot = null;
      for (j = 0; j < slots.length; j++) {
        if (slots[j].structure && slots[j].x < e.x) {
          if (!blockSlot || slots[j].x > blockSlot.x) blockSlot = slots[j];
        }
      }
      if (blockSlot && e.x <= blockSlot.x + 26) {
        if (e.atk <= 0) {
          e.atk = 1;
          blockSlot.structure.hp -= e.dmg;
          if (blockSlot.structure.hp <= 0) blockSlot.structure = null;
        }
      } else if (e.x <= castleX + 34) {
        if (e.atk <= 0) {
          e.atk = 1;
          baseHP -= e.dmg;
        }
      } else {
        var nx = e.x - e.spd * STEP;
        if (blockSlot && nx < blockSlot.x + 26) nx = blockSlot.x + 26;
        if (nx < castleX + 34) nx = castleX + 34;
        e.x = nx;
      }
    }
    // towers fire
    for (j = 0; j < slots.length; j++) {
      var s = slots[j].structure;
      if (!s || s.type !== 'Cannon') continue;
      var ts = tierStat(s);
      s.cool -= STEP;
      if (s.cool > 0) continue;
      var best = null, bd = 1e9;
      for (i = 0; i < enemies.length; i++) {
        e = enemies[i];
        var dx = e.x - slots[j].x, dy = e.y - laneY;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d <= ts.range && d < bd) { bd = d; best = e; }
      }
      if (best) {
        s.cool = 1 / ts.rate;
        best.hp -= ts.dmg;
        beams.push({ x1: slots[j].x, y1: laneY - 26, x2: best.x, y2: best.y, ttl: 0.12 });
      }
    }
    // deaths -> bounty equals current-tier Cost of slain unit
    for (i = enemies.length - 1; i >= 0; i--) {
      if (enemies[i].hp <= 0) {
        gold += enemies[i].cost;
        game.score += enemies[i].cost;
        enemies.splice(i, 1);
      }
    }
    if (baseHP <= 0) {
      baseHP = 0;
      endSlice(false); // F6: not recoverable
      return;
    }
    if (spawnIdx >= list.length && enemies.length === 0) {
      phase = 'COLLECT';
      var rw = BAL.waves[wave].reward;
      gold += rw;
      game.score += rw;
      logInput('waveclear:' + (wave + 1));
    }
  }

  function rebuildButtons() {
    buttons = [];
    if (phase !== 'BUILD') return;
    buttons.push({ x: R.W - 130, y: 14, w: 112, h: 36, label: 'READY', fn: startBattle, hot: true });
    if (selSlot < 0) return;
    var slot = slots[selSlot];
    var px = 14, py = R.H - 86, bw = 150, bh = 30, gap = 8, bx = px + 8;
    function opt(label, enabled, fn) {
      buttons.push({ x: bx, y: py + 34, w: bw, h: bh, label: label, fn: enabled ? fn : null });
      bx += bw + gap;
    }
    if (!staged) {
      if (!slot.structure) {
        var c1 = BAL.structures.Cannon.tiers[0].cost;
        var c2 = BAL.structures.Wall.tiers[0].cost;
        opt('Cannon (' + c1 + 'g)', true, function () { staged = { kind: 'build', type: 'Cannon', cost: c1, label: 'Build Cannon T1' }; });
        opt('Wall (' + c2 + 'g)', true, function () { staged = { kind: 'build', type: 'Wall', cost: c2, label: 'Build Wall T1' }; });
      } else {
        var s = slot.structure;
        var rc = repairCost(s);
        opt('Repair (' + rc + 'g)', rc > 0, function () { staged = { kind: 'repair', cost: rc, label: 'Repair ' + s.type }; });
        if (s.tier < 3) {
          var uc = BAL.structures[s.type].tiers[s.tier].cost;
          opt('Upgrade T' + (s.tier + 1) + ' (' + uc + 'g)', true, function () { staged = { kind: 'upgrade', cost: uc, label: 'Upgrade to T' + (s.tier + 1) }; });
        }
        var rf = sellRefund(s);
        opt('Sell (+' + rf + 'g)', true, function () { staged = { kind: 'sell', cost: 0, label: 'Sell ' + s.type + ' (+' + rf + 'g)' }; });
      }
    } else {
      opt('CONFIRM: ' + staged.label, true, commitStaged);
      opt('Cancel', true, function () { staged = null; });
    }
  }

  function update(dt) {
    if (!R.inGameplay()) return;
    flashT = Math.max(0, flashT - dt);
    for (var b = beams.length - 1; b >= 0; b--) { beams[b].ttl -= dt; if (beams[b].ttl <= 0) beams.splice(b, 1); }

    // presentation toggles only (T4)
    if (R.pressed('p')) altPalette = !altPalette;
    if (R.pressed('c')) captions = !captions;

    var mx = R.mouse.x, my = R.mouse.y;

    if (phase === 'BUILD') {
      // sim timer paused (F4)
      rebuildButtons();
      if (R.pressed('Enter')) { startBattle(); return; }
      if (R.mouse.clicked) {
        var hitBtn = false;
        for (var i = 0; i < buttons.length; i++) {
          if (inRect(mx, my, buttons[i])) {
            hitBtn = true;
            if (buttons[i].fn) buttons[i].fn();
            break;
          }
        }
        if (!hitBtn) {
          var picked = -1;
          for (var j = 0; j < slots.length; j++) {
            var dx = mx - slots[j].x, dy = my - laneY;
            if (dx * dx + dy * dy < 30 * 30) { picked = j; break; }
          }
          if (picked >= 0) { selSlot = picked; staged = null; logInput('select@' + picked); }
          else { selSlot = -1; staged = null; }
        }
      }
    } else if (phase === 'BATTLE') {
      acc += dt;
      if (acc > 0.25) acc = 0.25;
      while (acc >= STEP && phase === 'BATTLE') {
        acc -= STEP;
        simStep();
      }
    } else if (phase === 'COLLECT') {
      if (R.mouse.clicked || R.pressed('Enter')) {
        logInput('collect:' + (wave + 1));
        if (wave >= 2) { endSlice(true); return; } // cleared all 3 waves (F6)
        wave++;
        phase = 'BUILD';
        selSlot = -1; staged = null;
        say('Wave ' + (wave + 1) + ' — Build phase');
      }
    }
  }

  function draw() {
    var ctx = R.ctx;
    var col = altPalette
      ? { lane: '#3a3a52', castle: '#c9a24a', enemy: '#7fd07f', wall: '#8a8aa0', cannon: '#d0d0e8', beam: '#ffe680' }
      : { lane: '#4a3b2a', castle: '#d8b04c', enemy: '#59c94f', wall: '#9a8f7a', cannon: '#e8dcc0', beam: '#ffd24a' };

    // lane
    ctx.fillStyle = col.lane;
    ctx.fillRect(0, laneY - 14, R.W, 28);

    // castle base
    ctx.fillStyle = col.castle;
    ctx.fillRect(castleX - 42, laneY - 70, 62, 84);
    ctx.fillRect(castleX - 42, laneY - 84, 14, 16);
    ctx.fillRect(castleX - 4, laneY - 84, 14, 16);
    R.text('CASTLE', castleX - 11, laneY + 30, '11px monospace', '#fff', 'center');
    // base HP bar
    ctx.fillStyle = '#222'; ctx.fillRect(castleX - 42, laneY - 96, 62, 7);
    ctx.fillStyle = baseHP > 30 ? '#5ad25a' : '#e04a4a';
    ctx.fillRect(castleX - 42, laneY - 96, 62 * Math.max(0, baseHP) / BAL.baseHP, 7);

    // spawn portal
    ctx.fillStyle = col.enemy;
    ctx.beginPath(); ctx.arc(spawnX, laneY, 16, 0, Math.PI * 2); ctx.fill();
    R.text('GREENIES', spawnX, laneY + 32, '10px monospace', col.enemy, 'center');

    // slots + structures
    for (var j = 0; j < slots.length; j++) {
      var sl = slots[j];
      ctx.strokeStyle = j === selSlot ? '#ffe680' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = j === selSlot ? 3 : 1.5;
      ctx.beginPath(); ctx.arc(sl.x, laneY, 22, 0, Math.PI * 2); ctx.stroke();
      var s = sl.structure;
      if (s) {
        var ts = tierStat(s);
        if (s.type === 'Wall') {
          ctx.fillStyle = col.wall;
          ctx.fillRect(sl.x - 14, laneY - 34, 28, 42);
        } else {
          ctx.fillStyle = col.cannon;
          ctx.fillRect(sl.x - 11, laneY - 26, 22, 34);
          ctx.fillRect(sl.x - 3, laneY - 38, 20, 8);
          if (phase === 'BUILD' && j === selSlot) {
            ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(sl.x, laneY, ts.range, 0, Math.PI * 2); ctx.stroke();
          }
        }
        // tier pips
        for (var p = 0; p < s.tier; p++) {
          ctx.fillStyle = '#ffe680';
          ctx.fillRect(sl.x - 12 + p * 9, laneY + 12, 6, 5);
        }
        // hp bar
        ctx.fillStyle = '#222'; ctx.fillRect(sl.x - 16, laneY - 46, 32, 5);
        ctx.fillStyle = '#5ad25a'; ctx.fillRect(sl.x - 16, laneY - 46, 32 * s.hp / ts.hp, 5);
      }
    }

    // beams
    for (var b = 0; b < beams.length; b++) {
      var bm = beams[b];
      R.ctx.strokeStyle = col.beam; R.ctx.lineWidth = 2;
      R.ctx.beginPath(); R.ctx.moveTo(bm.x1, bm.y1); R.ctx.lineTo(bm.x2, bm.y2); R.ctx.stroke();
    }

    // enemies
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      var r = e.type === 'brute' ? 13 : e.type === 'runner' ? 7 : 10;
      ctx.fillStyle = col.enemy;
      ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222'; ctx.fillRect(e.x - 12, e.y - r - 9, 24, 4);
      ctx.fillStyle = '#9df06a'; ctx.fillRect(e.x - 12, e.y - r - 9, 24 * e.hp / e.max, 4);
    }

    // HUD
    R.text('Gold: ' + gold + 'g', 16, 30, 'bold 18px monospace', '#ffd24a', 'left');
    R.text('Base HP: ' + baseHP + '/' + BAL.baseHP, 16, 52, '14px monospace', '#fff', 'left');
    R.text('Wave ' + (wave + 1) + ' / 3', R.W / 2, 30, 'bold 18px monospace', '#fff', 'center');
    R.text('Score: ' + game.score, R.W / 2, 52, '13px monospace', '#ccc', 'center');

    if (phase === 'BUILD') {
      // buttons
      for (var k = 0; k < buttons.length; k++) {
        var bt = buttons[k];
        R.ctx.fillStyle = bt.hot ? '#3a7d3a' : (bt.fn ? '#33415e' : '#2a2a33');
        R.roundRect(bt.x, bt.y, bt.w, bt.h, 6);
        R.ctx.fill();
        R.text(bt.label, bt.x + bt.w / 2, bt.y + bt.h / 2 + 5, '12px monospace', bt.fn ? '#fff' : '#777', 'center');
      }
      if (captions) {
        var hint = selSlot < 0
          ? 'BUILD PHASE — click a slot to place / manage a structure, then READY'
          : (staged ? 'Confirm to commit "' + staged.label + '"' : 'Pick an option for slot ' + (selSlot + 1));
        R.text(hint, R.W / 2, R.H - 14, '13px monospace', '#cfe0ff', 'center');
      }
    } else if (phase === 'BATTLE') {
      if (captions) R.text('BATTLE — t=' + simTime.toFixed(1) + 's  Greenies left: ' + (BAL.waves[wave].list.length - spawnIdx + enemies.length), R.W / 2, R.H - 14, '13px monospace', '#ffb0a0', 'center');
    } else if (phase === 'COLLECT') {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(R.W / 2 - 250, R.H / 2 - 80, 500, 160);
      R.text('WAVE ' + (wave + 1) + ' CLEARED!', R.W / 2, R.H / 2 - 48, 'bold 22px monospace', '#ffe680', 'center');
      R.text(BAL.story[wave], R.W / 2, R.H / 2 - 16, '13px monospace', '#fff', 'center');
      R.text('Collected +' + BAL.waves[wave].reward + 'g reward', R.W / 2, R.H / 2 + 14, '14px monospace', '#ffd24a', 'center');
      R.text(wave >= 2 ? 'Click to finish the slice' : 'Click to return to Build phase', R.W / 2, R.H / 2 + 48, '13px monospace', '#cfe0ff', 'center');
    }

    if (flashT > 0) {
      R.text(flash, R.W / 2, 80, 'bold 15px monospace', '#ffe680', 'center');
    }
    R.text('[P]alette  [C]aptions (display only)  seed:' + seed, R.W - 14, R.H - 14, '10px monospace', '#888', 'right');
  }

  return { update: update, draw: draw };
};
})();