(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.mechanics=window.MMKit.mechanics||{};
MMKit.mechanics.DeterministicPlay = function (config, game) {
  // ---- Balance table (T5): core reads, never re-derives ----
  var BAL = {
    structures: {
      tower: { name: 'Powder Tower', spr: 'spr_art17top', tiers: [
        { cost: 60, hp: 90, dmg: 8, range: 150, rate: 0.8 },
        { cost: 90, hp: 130, dmg: 14, range: 175, rate: 0.7 },
        { cost: 140, hp: 180, dmg: 22, range: 200, rate: 0.6 } ] },
      wall: { name: 'Ground Wall', spr: 'spr_art23top', tiers: [
        { cost: 40, hp: 220 },
        { cost: 60, hp: 380 },
        { cost: 90, hp: 560 } ] }
    },
    units: {
      greenie: { name: 'Greenie', spr: 'spr_mothersporeilyaleaderoft', size: 30, cost: 10, hp: 30, spd: 42, dmg: 5, rate: 1.0 },
      brute:   { name: 'Greenie Brute', spr: 'spr_art29top', size: 42, cost: 25, hp: 95, spd: 26, dmg: 12, rate: 1.2 }
    },
    waves: [
      { list: [['greenie', 6]], reward: 50,
        story: 'Wave 1 cleared. The first Greenie scouts crumble against our powder. Chaplain-Gunner Bellamy salvages their spores for gold.' },
      { list: [['greenie', 8], ['brute', 2]], reward: 80,
        story: 'Wave 2 cleared. Mother Spore Ilya sends brutes now — the Chem swarm grows bold. The Castle holds. Collect the bounty.' },
      { list: [['greenie', 10], ['brute', 5]], reward: 120,
        story: 'Wave 3 cleared. The Greenie tide breaks. One continent, one lane — held by Ground and Powder.' }
    ],
    economy: { startGold: 120, repairCostPerHp: 0.2, sellRefund: 0.5, baseHp: 200, buildTime: 1.0, spawnBase: 1.2, spawnJitter: 0.4 }
  };

  var FIXED = 1 / 60; // fixed timestep (T2)
  var seed = (config && config.seed) ? (config.seed | 0) : 20240;
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var eco = BAL.economy;
  var laneY = Math.floor(R.H * 0.42);
  var castleX = 90;
  var spawnX = R.W - 50;
  var NSLOTS = 5;

  game.score = 0;
  game.win = false;
  game.baseHp = eco.baseHp;
  game.battleLog = { seed: seed, inputs: [] }; // (T3)

  var S = {
    phase: 'BUILD',      // BUILD -> BATTLE -> COLLECT (F2)
    wave: 0,             // 0..2 (F3)
    gold: eco.startGold,
    baseHp: eco.baseHp,
    tick: 0, acc: 0,
    slots: [],
    enemies: [],
    shots: [],
    queue: [], spawnT: 0,
    selSlot: -1, staged: null,
    collectText: '',
    over: false,
    // presentation only (T4)
    palette: 0, captions: true
  };

  var i;
  for (i = 0; i < NSLOTS; i++) {
    var sx = castleX + 90 + Math.floor((spawnX - 90 - castleX - 90) * i / (NSLOTS - 1));
    S.slots.push({ x: sx, type: null, tier: 0, hp: 0, maxHp: 0, cd: 0, buildT: 0 });
  }

  var PALS = [
    { bg: '#20301e', lane: '#4a4034', ui: '#f2e7c9', accent: '#e0b74a', bad: '#7bd35a' },
    { bg: '#101018', lane: '#3a3a4c', ui: '#ffffff', accent: '#7ec8ff', bad: '#9dff6a' }
  ];

  function logInput(action, data) {
    game.battleLog.inputs.push({ t: S.tick, wave: S.wave, action: action, data: data || null });
  }

  function optionsFor(slot) {
    var o = [];
    if (!slot.type) {
      var t = BAL.structures.tower.tiers[0], w = BAL.structures.wall.tiers[0];
      o.push({ id: 'build_tower', label: 'Build Tower (' + t.cost + 'g)', cost: t.cost });
      o.push({ id: 'build_wall', label: 'Build Wall (' + w.cost + 'g)', cost: w.cost });
    } else {
      var def = BAL.structures[slot.type];
      if (slot.hp < slot.maxHp) {
        var rc = Math.ceil((slot.maxHp - slot.hp) * eco.repairCostPerHp);
        o.push({ id: 'repair', label: 'Repair (' + rc + 'g)', cost: rc });
      }
      if (slot.tier < def.tiers.length) {
        var uc = def.tiers[slot.tier].cost;
        o.push({ id: 'upgrade', label: 'Upgrade T' + (slot.tier + 1) + ' (' + uc + 'g)', cost: uc });
      }
      var rf = Math.floor(def.tiers[slot.tier - 1].cost * eco.sellRefund);
      o.push({ id: 'sell', label: 'Sell (+' + rf + 'g)', cost: 0, refund: rf });
    }
    return o;
  }

  function commit(opt, idx) {
    var slot = S.slots[idx];
    if (opt.cost > S.gold) return false;
    if (opt.id === 'build_tower' || opt.id === 'build_wall') {
      var key = opt.id === 'build_tower' ? 'tower' : 'wall';
      var tier = BAL.structures[key].tiers[0];
      S.gold -= opt.cost;
      slot.type = key; slot.tier = 1;
      slot.hp = tier.hp; slot.maxHp = tier.hp;
      slot.cd = 0; slot.buildT = eco.buildTime;
    } else if (opt.id === 'upgrade') {
      var def = BAL.structures[slot.type];
      S.gold -= opt.cost;
      slot.tier++;
      var nt = def.tiers[slot.tier - 1];
      slot.hp = nt.hp; slot.maxHp = nt.hp;
      slot.buildT = eco.buildTime;
    } else if (opt.id === 'repair') {
      S.gold -= opt.cost;
      slot.hp = slot.maxHp;
    } else if (opt.id === 'sell') {
      S.gold += opt.refund;
      slot.type = null; slot.tier = 0; slot.hp = 0; slot.maxHp = 0;
    }
    logInput(opt.id, { slot: idx });
    return true;
  }

  function startBattle() {
    logInput('ready', { wave: S.wave });
    S.phase = 'BATTLE';
    S.selSlot = -1; S.staged = null;
    S.acc = 0;
    // build ordered spawn queue from wave list, seeded rng per wave (T1)
    var rng = mulberry32(seed + S.wave * 7919);
    var wv = BAL.waves[S.wave];
    S.queue = [];
    for (var g = 0; g < wv.list.length; g++) {
      var type = wv.list[g][0], n = wv.list[g][1];
      for (var k = 0; k < n; k++) {
        S.queue.push({ type: type, gap: eco.spawnBase + rng() * eco.spawnJitter });
      }
    }
    S.spawnT = 0.5;
  }

  function endSlice(won) {
    S.over = true;
    game.win = won;
    game.baseHp = S.baseHp;
    if (won) game.score += S.baseHp; // surviving base HP is measure of success
    R.go(game.resultsState || 'RESULTS');
  }

  function step() { // one fixed sim step, battle only (F5)
    S.tick++;
    // spawn per wave list
    if (S.queue.length > 0) {
      S.spawnT -= FIXED;
      if (S.spawnT <= 0) {
        var nx = S.queue.shift();
        var u = BAL.units[nx.type];
        S.enemies.push({ type: nx.type, x: spawnX, hp: u.hp, maxHp: u.hp, cd: 0, age: 0 });
        S.spawnT = nx.gap;
      }
    }
    // build timers finish during battle time
    var j, sl;
    for (j = 0; j < S.slots.length; j++) {
      sl = S.slots[j];
      if (sl.type && sl.buildT > 0) sl.buildT -= FIXED;
    }
    // enemies move / attack
    for (j = S.enemies.length - 1; j >= 0; j--) {
      var e = S.enemies[j];
      var u = BAL.units[e.type];
      e.age += FIXED;
      e.cd -= FIXED;
      // rightmost intact structure left of enemy blocks it
      var block = null, bx = -1;
      for (var s2 = 0; s2 < S.slots.length; s2++) {
        sl = S.slots[s2];
        if (sl.type && sl.hp > 0 && sl.x < e.x - 1 && sl.x > bx) { bx = sl.x; block = sl; }
      }
      var stopX = block ? (block.x + 28) : (castleX + 36);
      var nxp = e.x - u.spd * FIXED;
      if (nxp <= stopX) {
        e.x = stopX;
        if (e.cd <= 0) {
          e.cd = u.rate;
          if (block) {
            block.hp -= u.dmg;
            if (block.hp <= 0) { block.type = null; block.tier = 0; block.hp = 0; block.maxHp = 0; }
          } else {
            S.baseHp -= u.dmg;
            if (S.baseHp <= 0) { S.baseHp = 0; game.baseHp = 0; endSlice(false); return; } // (F6)
          }
        }
      } else {
        e.x = nxp;
      }
    }
    // towers fire
    for (j = 0; j < S.slots.length; j++) {
      sl = S.slots[j];
      if (sl.type !== 'tower' || sl.hp <= 0 || sl.buildT > 0) continue;
      var st = BAL.structures.tower.tiers[sl.tier - 1];
      sl.cd -= FIXED;
      if (sl.cd > 0) continue;
      var best = null, bd = 1e9;
      for (var m = 0; m < S.enemies.length; m++) {
        var d = Math.abs(S.enemies[m].x - sl.x);
        if (d <= st.range && d < bd) { bd = d; best = S.enemies[m]; }
      }
      if (best) {
        sl.cd = st.rate;
        best.hp -= st.dmg;
        S.shots.push({ x1: sl.x, y1: laneY - 26, x2: best.x, y2: laneY, t: 0.12 });
      }
    }
    // deaths -> bounty equals unit cost
    for (j = S.enemies.length - 1; j >= 0; j--) {
      if (S.enemies[j].hp <= 0) {
        var bounty = BAL.units[S.enemies[j].type].cost;
        S.gold += bounty;
        game.score += bounty;
        S.enemies.splice(j, 1);
      }
    }
    // shots decay (in fixed step for determinism)
    for (j = S.shots.length - 1; j >= 0; j--) {
      S.shots[j].t -= FIXED;
      if (S.shots[j].t <= 0) S.shots.splice(j, 1);
    }
    // wave clear
    if (S.queue.length === 0 && S.enemies.length === 0) {
      var wv = BAL.waves[S.wave];
      S.gold += wv.reward;
      game.score += wv.reward;
      S.collectText = wv.story;
      S.wave++;
      game.baseHp = S.baseHp;
      if (S.wave >= 3) { endSlice(true); return; } // win the slice (F6)
      S.phase = 'COLLECT';
      logInput('wave_clear', { wave: S.wave });
    }
  }

  // ---- layout helpers ----
  function readyRect() { return { x: R.W - 130, y: 10, w: 118, h: 36 }; }
  function slotRect(idx) { var s = S.slots[idx]; return { x: s.x - 26, y: laneY - 26, w: 52, h: 52 }; }
  function inR(r) { return R.mouse.x >= r.x && R.mouse.x <= r.x + r.w && R.mouse.y >= r.y && R.mouse.y <= r.y + r.h; }
  function optRect(k) { return { x: 14 + k * 200, y: R.H - 78, w: 190, h: 30 }; }
  function confirmRect() { return { x: R.W - 170, y: R.H - 78, w: 150, h: 30 }; }
  function continueRect() { return { x: R.W / 2 - 90, y: R.H * 0.66, w: 180, h: 42 }; }

  function update(dt) {
    if (!R.inGameplay()) return;
    if (S.over) return;

    // presentation toggles: display only, never core state (T4)
    if (R.pressed('p')) S.palette = (S.palette + 1) % PALS.length;
    if (R.pressed('c')) S.captions = !S.captions;

    if (S.phase === 'BUILD') {
      // sim timer paused (F4); pointer single-verb select/pick/confirm (P1)
      if (R.mouse.clicked) {
        var handled = false, k;
        // confirm staged
        if (S.staged && inR(confirmRect())) {
          commit(S.staged, S.selSlot);
          S.staged = null;
          handled = true;
        }
        // pick option
        if (!handled && S.selSlot >= 0) {
          var opts = optionsFor(S.slots[S.selSlot]);
          for (k = 0; k < opts.length; k++) {
            if (inR(optRect(k))) { S.staged = opts[k]; handled = true; break; }
          }
        }
        // ready button
        if (!handled && inR(readyRect())) { startBattle(); handled = true; }
        // select slot
        if (!handled) {
          for (k = 0; k < S.slots.length; k++) {
            if (inR(slotRect(k))) { S.selSlot = k; S.staged = null; handled = true; break; }
          }
        }
        if (!handled) { S.selSlot = -1; S.staged = null; }
      }
      if (R.pressed('Enter')) startBattle();
    } else if (S.phase === 'BATTLE') {
      // fixed timesteps only (T2)
      S.acc += dt;
      if (S.acc > 0.25) S.acc = 0.25;
      while (S.acc >= FIXED && !S.over && S.phase === 'BATTLE') {
        S.acc -= FIXED;
        step();
      }
    } else if (S.phase === 'COLLECT') {
      if ((R.mouse.clicked && inR(continueRect())) || R.pressed('Enter')) {
        logInput('collect_continue', { wave: S.wave });
        S.phase = 'BUILD';
      }
    }
  }

  function draw() {
    var ctx = R.ctx;
    var pal = PALS[S.palette];
    // lane
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, R.W, R.H);
    ctx.fillStyle = pal.lane;
    ctx.fillRect(0, laneY - 34, R.W, 68);

    // castle base at defensive end (F1)
    R.drawSpr('spr_art34top', castleX - 42, laneY - 54, 84, 108);
    // base HP bar
    ctx.fillStyle = '#000';
    ctx.fillRect(castleX - 42, laneY - 66, 84, 8);
    ctx.fillStyle = S.baseHp / eco.baseHp > 0.35 ? '#4ad04a' : '#e04a4a';
    ctx.fillRect(castleX - 42, laneY - 66, 84 * (S.baseHp / eco.baseHp), 8);
    if (S.captions) R.text('CASTLE ' + S.baseHp + '/' + eco.baseHp, castleX, laneY + 66, '12px monospace', pal.ui, 'center');

    // spawn end
    R.drawSpr('spr_mothersporeilyaleaderoft', spawnX - 22, laneY - 60, 44, 44);
    if (S.captions) R.text('GREENIE SPAWN', spawnX, laneY + 66, '11px monospace', pal.bad, 'center');

    // slots & structures
    var k, s;
    for (k = 0; k < S.slots.length; k++) {
      s = S.slots[k];
      var r = slotRect(k);
      ctx.strokeStyle = (k === S.selSlot) ? pal.accent : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = (k === S.selSlot) ? 3 : 1;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      if (s.type) {
        R.drawSpr(BAL.structures[s.type].spr, r.x + 4, r.y + 4, r.w - 8, r.h - 8);
        // hp bar
        ctx.fillStyle = '#000';
        ctx.fillRect(r.x, r.y - 8, r.w, 5);
        ctx.fillStyle = '#4ad04a';
        ctx.fillRect(r.x, r.y - 8, r.w * (s.hp / s.maxHp), 5);
        // tier pips
        for (var p = 0; p < s.tier; p++) {
          ctx.fillStyle = pal.accent;
          ctx.fillRect(r.x + 4 + p * 10, r.y + r.h + 4, 7, 7);
        }
        if (s.buildT > 0) R.text('...', s.x, laneY, '16px monospace', pal.ui, 'center');
        if (S.captions) R.text(BAL.structures[s.type].name + ' T' + s.tier, s.x, r.y + r.h + 24, '10px monospace', pal.ui, 'center');
      }
    }

    // shots
    for (k = 0; k < S.shots.length; k++) {
      var sh = S.shots[k];
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sh.x1, sh.y1); ctx.lineTo(sh.x2, sh.y2); ctx.stroke();
    }

    // enemies
    for (k = 0; k < S.enemies.length; k++) {
      var e = S.enemies[k];
      var u = BAL.units[e.type];
      var bob = Math.sin(e.age * 8) * 3;
      R.drawSpr(u.spr, e.x - u.size / 2, laneY - u.size / 2 + bob, u.size, u.size);
      ctx.fillStyle = '#000';
      ctx.fillRect(e.x - 15, laneY - u.size / 2 - 8 + bob, 30, 4);
      ctx.fillStyle = pal.bad;
      ctx.fillRect(e.x - 15, laneY - u.size / 2 - 8 + bob, 30 * (e.hp / e.maxHp), 4);
    }

    // HUD
    R.text('Gold: ' + S.gold + 'g', 14, 26, '16px monospace', pal.accent, 'left');
    R.text('Wave ' + Math.min(S.wave + 1, 3) + ' / 3', 14, 48, '14px monospace', pal.ui, 'left');
    R.text('Score: ' + game.score, 14, 68, '13px monospace', pal.ui, 'left');
    R.text('[P] palette  [C] captions (display only)', 14, R.H - 8, '10px monospace', 'rgba(255,255,255,0.5)', 'left');

    if (S.phase === 'BUILD') {
      R.text('BUILD PHASE — sim paused', R.W / 2, 26, '15px monospace', pal.ui, 'center');
      var rb = readyRect();
      ctx.fillStyle = pal.accent;
      R.roundRect(rb.x, rb.y, rb.w, rb.h, 8);
      ctx.fill();
      R.text('READY', rb.x + rb.w / 2, rb.y + 24, '16px monospace', '#222', 'center');

      // panel
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, R.H - 96, R.W, 96);
      if (S.selSlot >= 0) {
        var opts = optionsFor(S.slots[S.selSlot]);
        for (k = 0; k < opts.length; k++) {
          var orc = optRect(k);
          var afford = opts[k].cost <= S.gold;
          ctx.fillStyle = (S.staged && S.staged.id === opts[k].id) ? pal.accent : (afford ? '#3a4a5a' : '#333');
          R.roundRect(orc.x, orc.y, orc.w, orc.h, 6);
          ctx.fill();
          R.text(opts[k].label, orc.x + orc.w / 2, orc.y + 20,
            '12px monospace', (S.staged && S.staged.id === opts[k].id) ? '#222' : (afford ? '#fff' : '#888'), 'center');
        }
        if (S.staged) {
          var cr = confirmRect();
          ctx.fillStyle = '#4ad04a';
          R.roundRect(cr.x, cr.y, cr.w, cr.h, 6);
          ctx.fill();
          R.text('CONFIRM', cr.x + cr.w / 2, cr.y + 20, '13px monospace', '#222', 'center');
          R.text('Staged: ' + S.staged.label, 14, R.H - 88, '11px monospace', pal.ui, 'left');
        } else {
          R.text('Slot ' + (S.selSlot + 1) + ': pick an option, then confirm', 14, R.H - 88, '11px monospace', pal.ui, 'left');
        }
      } else {
        R.text('Select a build slot on the lane. Press READY to start the wave.', 14, R.H - 60, '13px monospace', pal.ui, 'left');
      }
    } else if (S.phase === 'BATTLE') {
      R.text('BATTLE — Wave ' + (S.wave + 1), R.W / 2, 26, '15px monospace', pal.bad, 'center');
      R.text('Incoming: ' + (S.queue.length + S.enemies.length), R.W - 14, 26, '13px monospace', pal.ui, 'right');
    } else if (S.phase === 'COLLECT') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(R.W * 0.1, R.H * 0.2, R.W * 0.8, R.H * 0.55);
      R.drawSpr('spr_chaplaingunnerruthbellam', R.W / 2 - 40, R.H * 0.23, 80, 80);
      R.text('WAVE CLEAR — COLLECT', R.W / 2, R.H * 0.23 + 100, '17px monospace', pal.accent, 'center');
      // wrap story text
      var words = S.collectText.split(' ');
      var line = '', ly = R.H * 0.23 + 126, maxc = 52;
      for (k = 0; k < words.length; k++) {
        if ((line + ' ' + words[k]).length > maxc) {
          R.text(line, R.W / 2, ly, '12px monospace', pal.ui, 'center');
          ly += 16; line = words[k];
        } else line = line ? line + ' ' + words[k] : words[k];
      }
      if (line) R.text(line, R.W / 2, ly, '12px monospace', pal.ui, 'center');
      R.text('+ ' + BAL.waves[S.wave - 1].reward + 'g wave reward collected', R.W / 2, ly + 24, '13px monospace', pal.accent, 'center');
      var cb = continueRect();
      ctx.fillStyle = pal.accent;
      R.roundRect(cb.x, cb.y, cb.w, cb.h, 8);
      ctx.fill();
      R.text('BUILD PHASE', cb.x + cb.w / 2, cb.y + 27, '15px monospace', '#222', 'center');
    }
  }

  return { update: update, draw: draw };
};
})();