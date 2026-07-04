(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.mechanics=window.MMKit.mechanics||{};
MMKit.mechanics.GameplayHost = function (config, game) {

  // ---------------------------------------------------------------------------
  // Fallback deterministic sim (used only if MMKit.sim is not provided).
  // The host is the ONLY writer of sim state.
  // ---------------------------------------------------------------------------
  function makeFallbackSim() {
    var S = { seed: 0, prng: 0, tables: null, state: null };

    function rnd() {
      S.prng = (S.prng * 1664525 + 1013904223) >>> 0;
      return S.prng / 4294967296;
    }

    function tbl(name, fallback) {
      var t = S.tables && S.tables[name];
      return t != null ? t : fallback;
    }

    function towerDefs() {
      // data-driven if provided, else defaults for 3 tower types
      return tbl('towers', [
        { key: 'cannon', spr: 'art23top', cost: 50, dmg: 8, range: 0.17, rate: 1.1, hp: 60 },
        { key: 'gatling', spr: 'art34top', cost: 70, dmg: 4, range: 0.14, rate: 3.0, hp: 50 },
        { key: 'mortar',  spr: 'art29top', cost: 90, dmg: 16, range: 0.22, rate: 0.6, hp: 70 }
      ]);
    }

    function wallDef() {
      return tbl('wall', { key: 'wall', spr: 'art8top', cost: 30, hp: 120 });
    }

    function buildSlots() {
      var arr = [];
      var n = 6;
      for (var i = 0; i < n; i++) {
        arr.push({ index: i, x: 0.14 + i * 0.125, occupied: false });
      }
      return arr;
    }

    function waveList(w) {
      var scale = tbl('waveScale', { count: 4, hpBase: 20, hpPer: 8, spd: 0.030, gold: 8 });
      var count = scale.count + w * 3;
      var q = [];
      for (var i = 0; i < count; i++) {
        var type = (i % 3);
        q.push({
          type: type,
          hp: scale.hpBase + w * scale.hpPer + type * 6,
          maxhp: scale.hpBase + w * scale.hpPer + type * 6,
          speed: scale.spd + type * 0.006 + w * 0.004,
          gold: scale.gold + type * 3 + w * 2,
          delay: 0.7
        });
      }
      return q;
    }

    S.init = function (seed, tables) {
      S.seed = (seed | 0) || 12345;
      S.prng = S.seed >>> 0;
      S.tables = tables || {};
      S.state = {
        phase: 'build',              // build | battle | collect | win | lose
        wave: 1,
        maxWave: tbl('maxWave', 3),
        gold: tbl('startGold', 200),
        baseHP: 100, baseMaxHP: 100,
        lane: { y: 0.5, x0: 0.06, x1: 0.90 },
        slots: buildSlots(),
        towerDefs: towerDefs(),
        wallDef: wallDef(),
        towers: [],                  // {slot,defIdx,level,cooldown,range,dmg,rate,hp,maxHP,spr,key,muzzle}
        walls: [],                   // {slot,hp,maxHP,spr}
        enemies: [],
        projectiles: [],             // {x,y,tx,ty,dmg,life,max,target}
        spawnQueue: [],
        spawnTimer: 0,
        collectedGold: 0,
        story: '',
        result: null,
        time: 0,
        selType: 0                   // selected tower def index for placement
      };
      return S.state;
    };

    function findTower(slot) {
      for (var i = 0; i < S.state.towers.length; i++)
        if (S.state.towers[i].slot === slot) return S.state.towers[i];
      return null;
    }
    function findWall(slot) {
      for (var i = 0; i < S.state.walls.length; i++)
        if (S.state.walls[i].slot === slot) return S.state.walls[i];
      return null;
    }

    S.command = function (c) {
      var st = S.state;
      if (!st) return;

      if (c.type === 'selectType') {
        st.selType = Math.max(0, Math.min(st.towerDefs.length - 1, c.idx | 0));
        return;
      }

      if (st.phase !== 'build') {
        if (c.type === 'continue' && st.phase === 'collect') {
          if (st.wave >= st.maxWave) { st.phase = 'win'; st.result = 'win'; }
          else { st.wave++; st.phase = 'build'; }
        }
        return;
      }

      if (c.type === 'place') {
        var slot = st.slots[c.slot];
        if (!slot || slot.occupied) return;
        var def = st.towerDefs[st.selType] || st.towerDefs[0];
        if (st.gold < def.cost) return;
        slot.occupied = true;
        st.gold -= def.cost;
        st.towers.push({
          slot: c.slot, defIdx: st.selType, level: 1,
          range: def.range, dmg: def.dmg, rate: def.rate,
          hp: def.hp, maxHP: def.hp, spr: def.spr, key: def.key,
          cooldown: 0, muzzle: 0
        });

      } else if (c.type === 'placeWall') {
        var wslot = st.slots[c.slot];
        if (!wslot || wslot.occupied) return;
        var wd = st.wallDef;
        if (st.gold < wd.cost) return;
        wslot.occupied = true;
        st.gold -= wd.cost;
        st.walls.push({ slot: c.slot, hp: wd.hp, maxHP: wd.hp, spr: wd.spr });

      } else if (c.type === 'upgrade') {
        var tw = findTower(c.slot);
        if (tw && st.gold >= 40) {
          st.gold -= 40;
          tw.level++;
          tw.dmg += Math.ceil(tw.dmg * 0.4);
          tw.range += 0.015;
          tw.rate += 0.2;
          tw.maxHP += 25; tw.hp = tw.maxHP;
        }

      } else if (c.type === 'repair') {
        var tr = findTower(c.slot);
        var wr = findWall(c.slot);
        if (tr && tr.hp < tr.maxHP && st.gold >= 20) {
          st.gold -= 20; tr.hp = tr.maxHP;
        } else if (wr && wr.hp < wr.maxHP && st.gold >= 20) {
          st.gold -= 20; wr.hp = wr.maxHP;
        } else if (!tr && !wr && st.gold >= 30 && st.baseHP < st.baseMaxHP) {
          st.gold -= 30;
          st.baseHP = Math.min(st.baseMaxHP, st.baseHP + 25);
        }

      } else if (c.type === 'sell') {
        var t2 = findTower(c.slot);
        var w2 = findWall(c.slot);
        if (t2) {
          st.gold += 25 + (t2.level - 1) * 15;
          st.slots[c.slot].occupied = false;
          st.towers.splice(st.towers.indexOf(t2), 1);
        } else if (w2) {
          st.gold += 15;
          st.slots[c.slot].occupied = false;
          st.walls.splice(st.walls.indexOf(w2), 1);
        }

      } else if (c.type === 'ready') {
        st.phase = 'battle';
        st.spawnQueue = waveList(st.wave);
        st.spawnTimer = 0;
        st.enemies = [];
        st.projectiles = [];
      }
    };
    // alias
    S.cmd = S.command;

    S.step = function (dt) {
      var st = S.state;
      if (!st) return;
      st.time += dt;

      // muzzle flash decay always
      for (var mi = 0; mi < st.towers.length; mi++) {
        if (st.towers[mi].muzzle > 0) st.towers[mi].muzzle -= dt;
      }

      if (st.phase !== 'battle') return;
      var lane = st.lane;

      // spawn
      if (st.spawnQueue.length > 0) {
        st.spawnTimer -= dt;
        if (st.spawnTimer <= 0) {
          var e = st.spawnQueue.shift();
          st.enemies.push({
            x: lane.x0, type: e.type,
            hp: e.hp, maxhp: e.maxhp, speed: e.speed, gold: e.gold,
            hitFlash: 0
          });
          st.spawnTimer = e.delay;
        }
      }

      // enemies move toward base along lane
      for (var i = st.enemies.length - 1; i >= 0; i--) {
        var en = st.enemies[i];
        if (en.hitFlash > 0) en.hitFlash -= dt;
        en.x += en.speed * dt;
        if (en.x >= lane.x1) {
          st.baseHP -= 10;
          st.enemies.splice(i, 1);
          if (st.baseHP <= 0) {
            st.baseHP = 0; st.phase = 'lose'; st.result = 'lose'; return;
          }
        }
      }

      // towers fire (with simple lead prediction)
      for (var t = 0; t < st.towers.length; t++) {
        var tw = st.towers[t];
        tw.cooldown -= dt;
        var sx = st.slots[tw.slot].x;
        if (tw.cooldown <= 0) {
          var best = null, bestD = tw.range;
          for (var j = 0; j < st.enemies.length; j++) {
            var d = Math.abs(st.enemies[j].x - sx);
            if (d <= bestD) { bestD = d; best = st.enemies[j]; }
          }
          if (best) {
            // predict a small lead
            var leadX = best.x + best.speed * 0.15;
            st.projectiles.push({
              x: sx, y: lane.y - 0.06,
              tx: leadX, ty: lane.y,
              dmg: tw.dmg, life: 0, max: 0.35,
              target: best
            });
            best.hp -= tw.dmg;
            best.hitFlash = 0.12;
            tw.cooldown = 1.0 / tw.rate;
            tw.muzzle = 0.08;
          }
        }
      }

      // projectiles (visual lifetime, damage already applied)
      for (var p = st.projectiles.length - 1; p >= 0; p--) {
        st.projectiles[p].life += dt;
        if (st.projectiles[p].life >= st.projectiles[p].max)
          st.projectiles.splice(p, 1);
      }

      // remove dead enemies, grant gold
      for (var k = st.enemies.length - 1; k >= 0; k--) {
        if (st.enemies[k].hp <= 0) {
          st.gold += st.enemies[k].gold;
          st.collectedGold += st.enemies[k].gold;
          st.enemies.splice(k, 1);
        }
      }

      // wave cleared?
      if (st.spawnQueue.length === 0 && st.enemies.length === 0) {
        st.phase = 'collect';
        st.story = 'Wave ' + st.wave + ' cleared. The Powder holds the line.';
        st.gold += 40;
        st.collectedGold += 40;
      }
    };

    return S;
  }

  // ---------------------------------------------------------------------------
  // Choose sim: real MMKit.sim if present, else fallback. Host owns game.sim.
  // ---------------------------------------------------------------------------
  var usingReal = !!(MMKit && MMKit.sim && typeof MMKit.sim.init === 'function' &&
                     typeof MMKit.sim.step === 'function');
  var sim = usingReal ? MMKit.sim : makeFallbackSim();
  game.sim = sim;

  var initialized = false;
  var FIXED = 1 / 60;
  var accum = 0;
  var ended = false;

  // Faction leader portraits (shown per-phase for flavor / juice)
  var LEADER_KEYS = [
    'chaplaingunnerruthbellam',
    'envoylyra9theleaderofthe',
    'mothersporeilyaleaderoft',
    'tidepriestessmarenaleade'
  ];

  // ---- helpers -------------------------------------------------------------
  function sendCmd(cmd) {
    if (typeof R.logEvent === 'function') { try { R.logEvent(cmd); } catch (e) {} }
    try {
      if (typeof sim.command === 'function') sim.command(cmd);
      else if (typeof sim.cmd === 'function') sim.cmd(cmd);
    } catch (e) {}
  }

  function getState() {
    try { return sim.state || null; } catch (e) { return null; }
  }

  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

  function SX(fx) { return fx * R.W; }
  function SY(fy) { return fy * R.H; }

  function slotScreen(st, slot) {
    return { x: SX(slot.x), y: SY(st.lane.y) - 34 };
  }

  function nearestSlotToMouse(st) {
    var best = -1, bd = 44 * 44;
    for (var i = 0; i < st.slots.length; i++) {
      var p = slotScreen(st, st.slots[i]);
      var dx = p.x - R.mouse.x, dy = p.y - R.mouse.y;
      var d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  // particles / floaters (pure rendering juice, uses R.rand())
  var particles = [];
  var floaters = [];
  function burst(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = R.rand() * Math.PI * 2;
      var sp = 40 + R.rand() * 140;
      particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.35 + R.rand() * 0.35, max: 0.7, color: color, r: 2 + R.rand() * 3 });
    }
  }
  function floater(x, y, text, color) {
    floaters.push({ x: x, y: y, text: text, color: color, life: 1.0 });
  }

  // track enemy count to trigger death FX from state deltas
  var prevEnemyCount = 0;

  // ---------------------------------------------------------------------------
  // INPUT (build phase)
  // ---------------------------------------------------------------------------
  function handleBuildInput(st) {
    // tower type selection 1/2/3
    if (R.pressed('1')) sendCmd({ type: 'selectType', idx: 0 });
    if (R.pressed('2')) sendCmd({ type: 'selectType', idx: 1 });
    if (R.pressed('3')) sendCmd({ type: 'selectType', idx: 2 });

    // click to place a tower at nearest empty slot
    if (R.mouse.clicked) {
      var s = nearestSlotToMouse(st);
      if (s >= 0) {
        var slot = st.slots[s];
        var p = slotScreen(st, slot);
        if (!slot.occupied) {
          sendCmd({ type: 'place', slot: s });
          burst(p.x, p.y, '#8fd', 14); floater(p.x, p.y - 22, 'BUILD', '#8fd');
        } else {
          sendCmd({ type: 'upgrade', slot: s });
          burst(p.x, p.y, '#fd8', 14); floater(p.x, p.y - 22, 'UP', '#fd8');
        }
      }
    }

    var sel = nearestSlotToMouse(st);
    if (sel >= 0) {
      var selP = slotScreen(st, st.slots[sel]);
      if (R.pressed('w')) { sendCmd({ type: 'placeWall', slot: sel });
        burst(selP.x, selP.y, '#ba7', 10); floater(selP.x, selP.y - 22, 'WALL', '#ba7'); }
      if (R.pressed('r')) { sendCmd({ type: 'repair', slot: sel });
        burst(selP.x, selP.y, '#8df', 10); floater(selP.x, selP.y - 22, 'REPAIR', '#8df'); }
      if (R.pressed('u')) { sendCmd({ type: 'upgrade', slot: sel });
        burst(selP.x, selP.y, '#fd8', 12); floater(selP.x, selP.y - 22, 'UP', '#fd8'); }
      if (R.pressed('x') || R.pressed('s')) { sendCmd({ type: 'sell', slot: sel });
        burst(selP.x, selP.y, '#f88', 12); floater(selP.x, selP.y - 22, 'SELL', '#f88'); }
    }

    if (R.pressed(' ') || R.pressed('Enter')) sendCmd({ type: 'ready' });
  }

  function handleCollectInput() {
    if (R.pressed(' ') || R.pressed('Enter') || R.mouse.clicked) {
      sendCmd({ type: 'continue' });
    }
  }

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------
  function update(dt) {
    if (typeof R.inGameplay === 'function' && !R.inGameplay()) return;
    if (isNaN(dt) || dt <= 0) dt = FIXED;
    if (dt > 0.1) dt = 0.1;

    if (!initialized) {
      var tables = (config && config.data && config.data.tables) || {};
      var seed = (config && config.seed != null) ? config.seed : 12345;
      try { sim.init(seed, tables); } catch (e) {}
      initialized = true;
      if (typeof game.score !== 'number') game.score = 0;
      if (!game.ui) game.ui = {};
      var s0 = getState();
      prevEnemyCount = (s0 && s0.enemies) ? s0.enemies.length : 0;
    }

    var st = getState();
    if (!st) return;

    // --- input by phase ---
    if (st.phase === 'build') handleBuildInput(st);
    else if (st.phase === 'collect') handleCollectInput();

    // --- advance sim (fixed timestep during battle) ---
    if (st.phase === 'battle') {
      accum += dt;
      var steps = 0;
      while (accum >= FIXED && steps < 8) {
        var before = st.enemies.length;
        sim.step(FIXED);
        accum -= FIXED;
        steps++;
        // death FX from count delta
        if (st.enemies.length < before) {
          var lane = st.lane;
          burst(SX((lane.x0 + lane.x1) * 0.5), SY(lane.y), '#7f7', 8);
        }
        if (st.phase !== 'battle') break;
      }
    } else {
      // still step for muzzle/particle decay in sim (harmless)
      try { sim.step(0); } catch (e) {}
    }

    // --- particles / floaters ---
    for (var p = particles.length - 1; p >= 0; p--) {
      var pt = particles[p];
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vx *= (1 - 3 * dt); pt.vy *= (1 - 3 * dt);
      pt.life -= dt;
      if (pt.life <= 0) particles.splice(p, 1);
    }
    for (var fi = floaters.length - 1; fi >= 0; fi--) {
      var fo = floaters[fi];
      fo.y -= 32 * dt; fo.life -= dt;
      if (fo.life <= 0) floaters.splice(fi, 1);
    }

    // --- score reflect ---
    game.score = num(st.collectedGold, num(st.score, 0));

    // --- win / lose ---
    var over = (st.phase === 'win' || st.phase === 'lose' ||
                st.result === 'win' || st.result === 'lose' ||
                (typeof st.baseHP === 'number' && st.baseHP <= 0));
    if (over && !ended) {
      ended = true;
      try { R.go(game.resultsState || 'RESULTS'); } catch (e) {}
    }
  }

  // ---------------------------------------------------------------------------
  // DRAW
  // ---------------------------------------------------------------------------
  function drawBar(x, y, w, h, frac, color) {
    var ctx = R.ctx; if (!ctx) return;
    frac = Math.max(0, Math.min(1, num(frac, 0)));
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color || '#3c3';
    ctx.fillRect(x, y, w * frac, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function draw() {
    var ctx = R.ctx; if (!ctx) return;
    var W = R.W, H = R.H;
    var st = getState();

    // background field (tiled ground sprite)
    var tile = 96;
    for (var gy = 0; gy < H; gy += tile) {
      for (var gx = 0; gx < W; gx += tile) {
        R.drawSpr('topdownviewof4typesofsep', gx, gy, tile, tile);
      }
    }

    if (!st) {
      R.text('Initializing...', W / 2, H / 2, '16px sans-serif', '#fff', 'center');
      return;
    }

    var lane = st.lane;
    var laneY = SY(lane.y);
    var laneH = 92;

    // lane strip
    ctx.save();
    ctx.fillStyle = 'rgba(50,42,26,0.55)';
    ctx.fillRect(SX(lane.x0) - 20, laneY - laneH / 2, SX(lane.x1) - SX(lane.x0) + 60, laneH);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 2;
    ctx.strokeRect(SX(lane.x0) - 20, laneY - laneH / 2, SX(lane.x1) - SX(lane.x0) + 60, laneH);
    ctx.restore();

    // enemy spawn banner sprite
    R.drawSpr('sheet', SX(lane.x0) - 46, laneY - 24, 40, 48);

    // castle base at lane end
    var baseX = SX(lane.x1) + 24, baseY = laneY;
    R.drawSpr('art17top', baseX - 44, baseY - 44, 88, 88);
    drawBar(baseX - 40, baseY - 56, 80, 7, num(st.baseHP, 0) / num(st.baseMaxHP, 1), '#4cf');

    // build slots
    var hoverSlot = (st.phase === 'build') ? nearestSlotToMouse(st) : -1;
    for (var i = 0; i < st.slots.length; i++) {
      var slot = st.slots[i];
      var sp = slotScreen(st, slot);
      if (st.phase === 'build' && !slot.occupied) {
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = (i === hoverSlot) ? 'rgba(150,255,180,0.95)' : 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        R.roundRect(sp.x - 22, sp.y - 22, 44, 44, 6);
        ctx.stroke();
        ctx.restore();
        if (i === hoverSlot) {
          var def = st.towerDefs[st.selType] || st.towerDefs[0];
          R.text(def.cost + 'g', sp.x, sp.y + 4, '11px sans-serif', '#ffd45a', 'center');
        }
      }
    }

    // walls
    for (var wi = 0; wi < st.walls.length; wi++) {
      var wl = st.walls[wi];
      var wp = slotScreen(st, st.slots[wl.slot]);
      R.drawSpr(wl.spr || 'art8top', wp.x - 22, wp.y - 22, 44, 44);
      drawBar(wp.x - 20, wp.y - 30, 40, 4, wl.hp / wl.maxHP, '#ba7');
    }

    // towers (with range viz + muzzle flash)
    for (var t = 0; t < st.towers.length; t++) {
      var tw = st.towers[t];
      var tp = slotScreen(st, st.slots[tw.slot]);

      // range visualization
      var rangePx = tw.range * W;
      ctx.save();
      ctx.strokeStyle = (st.phase === 'build' && tw.slot === hoverSlot)
        ? 'rgba(120,220,255,0.55)' : 'rgba(120,220,255,0.18)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, rangePx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      R.drawSpr(tw.spr || 'art23top', tp.x - 24, tp.y - 24, 48, 48);

      // muzzle flash
      if (tw.muzzle > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, tw.muzzle / 0.08);
        ctx.fillStyle = '#ffec8a';
        ctx.beginPath();
        ctx.arc(tp.x, tp.y - 18, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // level pips + hp
      drawBar(tp.x - 20, tp.y - 30, 40, 4, tw.hp / tw.maxHP, '#3c3');
      R.text('L' + tw.level, tp.x, tp.y + 30, '10px sans-serif', '#fff', 'center');
    }

    // enemies (Greenies) — 4-type comic top-down sprite, tinted by hitFlash
    for (var e = 0; e < st.enemies.length; e++) {
      var en = st.enemies[e];
      var ex = SX(en.x), ey = laneY;
      var sway = Math.sin((st.time * 6) + e) * 3;
      R.drawSpr('4typeoftopdownviewofcomi', ex - 18, ey - 18 + sway, 36, 36);
      if (en.hitFlash > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.6, en.hitFlash / 0.12);
        ctx.fillStyle = '#ff5555';
        ctx.beginPath();
        ctx.arc(ex, ey + sway, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      drawBar(ex - 16, ey - 26 + sway, 32, 4, en.hp / en.maxhp, '#c33');
    }

    // projectiles (short streaks toward target)
    ctx.save();
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 3;
    for (var pr = 0; pr < st.projectiles.length; pr++) {
      var pj = st.projectiles[pr];
      var f = Math.min(1, pj.life / pj.max);
      var sx = SX(pj.x), sy0 = SY(pj.y);
      var tx = SX(pj.tx), ty = SY(pj.ty);
      var cx = sx + (tx - sx) * f, cy = sy0 + (ty - sy0) * f;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - (tx - sx) * 0.06, cy - (ty - sy0) * 0.06);
      ctx.stroke();
    }
    ctx.restore();

    // particles
    for (var pi = 0; pi < particles.length; pi++) {
      var p = particles[pi];
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // floaters
    for (var fi = 0; fi < floaters.length; fi++) {
      var fo = floaters[fi];
      ctx.save();
      ctx.globalAlpha = Math.max(0, fo.life);
      R.text(fo.text, fo.x, fo.y, 'bold 13px sans-serif', fo.color, 'center');
      ctx.restore();
    }

    // ---- HUD ----
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W, 34);
    ctx.restore();

    R.text('GOLD ' + num(st.gold, 0), 12, 22, 'bold 15px sans-serif', '#ffd45a', 'left');
    R.text('WAVE ' + num(st.wave, 1) + '/' + num(st.maxWave, 3), 150, 22, 'bold 15px sans-serif', '#fff', 'left');
    R.text('BASE ' + Math.max(0, Math.round(num(st.baseHP, 0))), 300, 22, 'bold 15px sans-serif', '#4cf', 'left');
    R.text('PHASE ' + (st.phase || '-').toUpperCase(), W - 12, 22, 'bold 14px sans-serif', '#ddd', 'right');

    // faction leader portrait (per phase flavor)
    var leaderIdx = (num(st.wave, 1) - 1) % LEADER_KEYS.length;
    R.drawSpr(LEADER_KEYS[leaderIdx], W - 74, 40, 60, 60);

    // tower palette during build
    if (st.phase === 'build') {
      var px = 12, py = H - 96;
      for (var d = 0; d < st.towerDefs.length; d++) {
        var def = st.towerDefs[d];
        var bx = px + d * 72;
        ctx.save();
        ctx.fillStyle = (d === st.selType) ? 'rgba(120,220,180,0.35)' : 'rgba(0,0,0,0.45)';
        R.roundRect(bx, py, 64, 64, 8);
        ctx.fill();
        ctx.strokeStyle = (d === st.selType) ? '#8fd' : 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 2;
        R.roundRect(bx, py, 64, 64, 8);
        ctx.stroke();
        ctx.restore();
        R.drawSpr(def.spr, bx + 12, py + 6, 40, 40);
        R.text((d + 1) + ':' + def.cost + 'g', bx + 32, py + 58, '10px sans-serif', '#ffd45a', 'center');
      }
      R.text('CLICK slot: build/upgrade  |  1/2/3 tower  W wall  R repair  U upgrade  X sell  |  SPACE Ready',
        W / 2, H - 12, '12px sans-serif', '#dcdcdc', 'center');
    } else if (st.phase === 'collect') {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, H / 2 - 50, W, 100);
      ctx.restore();
      R.text(st.story || 'Wave cleared!', W / 2, H / 2 - 10, 'bold 18px sans-serif', '#8fd', 'center');
      R.text('Press SPACE to continue', W / 2, H / 2 + 22, '14px sans-serif', '#fff', 'center');
    }
  }

  return { update: update, draw: draw };
};
})();