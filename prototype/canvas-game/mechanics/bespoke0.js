(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.mechanics=window.MMKit.mechanics||{};
MMKit.mechanics.DeterministicPlay = function (config, game) {
  // ---- Balance table (T5: core reads, never re-derives) ----
  var BAL = (config && config.balance) || {
    sheet: "GroundPowder_vs_Chem_v1",
    startGold: 140,
    base: { hp: 100 },
    mult: { powderVsChem: 1.25 },
    structures: {
      Cannon: { tiers: [
        { cost: 60,  hp: 70,  dmg: 9,  range: 150, rate: 0.9,  build: 1.5 },
        { cost: 90,  hp: 95,  dmg: 14, range: 175, rate: 0.75, build: 2.0 },
        { cost: 130, hp: 120, dmg: 22, range: 200, rate: 0.6,  build: 2.5 }
      ]},
      Wall: { tiers: [
        { cost: 35, hp: 160, dmg: 0, range: 0, rate: 0, build: 1.0 },
        { cost: 55, hp: 280, dmg: 0, range: 0, rate: 0, build: 1.5 },
        { cost: 80, hp: 420, dmg: 0, range: 0, rate: 0, build: 2.0 }
      ]}
    },
    enemies: { Greenie: { tiers: [
      { cost: 12, hp: 34,  speed: 34, dmg: 6,  rate: 1.0 },
      { cost: 22, hp: 70,  speed: 30, dmg: 10, rate: 0.9 },
      { cost: 36, hp: 130, speed: 26, dmg: 16, rate: 0.8 }
    ]}},
    waves: [
      [{ n: 5, tier: 0, gap: 1.4, start: 0.8 }],
      [{ n: 7, tier: 0, gap: 1.1, start: 0.8 }, { n: 2, tier: 1, gap: 2.2, start: 4.0 }],
      [{ n: 8, tier: 0, gap: 0.9, start: 0.6 }, { n: 4, tier: 1, gap: 1.8, start: 3.0 }, { n: 1, tier: 2, gap: 0, start: 8.0 }]
    ],
    waveReward: [50, 70, 100],
    story: [
      "The Powder scouts hold the pass. The Greenies retreat, fuming.",
      "Chem vats crack in the valley. The Castle banner still flies.",
      "The Greenie swarm is broken. The continent's lane is ours."
    ],
    repairFactor: 0.4,
    sellRefund: 0.5
  };

  // ---- Core state (deterministic: seed + ordered inputs, fixed dt) ----
  var FIXED = 1 / 60;
  var seed = (config && config.seed) || 1;
  game.score = 0;
  game.gold = BAL.startGold;
  game.baseHP = BAL.base.hp;
  game.baseMax = BAL.base.hp;
  game.wave = 1;
  game.battleLog = { seed: seed, inputs: [] };
  var log = game.battleLog;

  var phase = "build";           // build -> battle -> collect
  var simTime = 0, acc = 0;      // sim timer paused in build (F4)
  var enemies = [], queue = [], shots = [];
  var selSlot = -1, staged = null;
  var lastCaption = "Wave 1: fortify the lane, then press READY.";
  var collectGold = 0, collectStory = "";

  // Presentation-only options (T4)
  var pal = 0, captions = true, icons = true, camAlt = false;
  var PALS = [
    { lane: "#3b3b4d", pad: "#55516a", enemy: "#5fd35f", tower: "#d8b04a", wall: "#9a8f7a", ui: "#ffffff", dim: "#b9b4c9", hp: "#e5534b", hpOk: "#57c26b", panel: "rgba(20,18,30,0.88)" },
    { lane: "#222222", pad: "#666666", enemy: "#00ff66", tower: "#ffee00", wall: "#cccccc", ui: "#ffffff", dim: "#dddddd", hp: "#ff3322", hpOk: "#00ee55", panel: "rgba(0,0,0,0.9)" }
  ];

  // ---- Lane geometry: Castle left (defensive end), spawn far right (F1) ----
  var laneY = Math.floor(R.H * 0.52);
  var castleX = 60, spawnX = R.W - 36;
  var NSLOTS = 6, slots = [];
  var s0 = 150, s1 = R.W - 110;
  for (var i = 0; i < NSLOTS; i++) {
    slots.push({ x: s0 + (s1 - s0) * i / (NSLOTS - 1), structure: null });
  }

  function tiersOf(type) { return BAL.structures[type].tiers; }
  function eTier(t) { return BAL.enemies.Greenie.tiers[t]; }

  function buildQueue(waveIdx) {
    queue = [];
    var groups = BAL.waves[waveIdx];
    for (var g = 0; g < groups.length; g++) {
      var gr = groups[g];
      for (var k = 0; k < gr.n; k++) queue.push({ at: gr.start + k * gr.gap, tier: gr.tier });
    }
    queue.sort(function (a, b) { return a.at - b.at; });
  }

  // ---- Build-phase option list (P1/P2/P7) ----
  function optionButtons() {
    var opts = [];
    if (phase !== "build" || selSlot < 0) return opts;
    var st = slots[selSlot].structure;
    if (!st) {
      var types = ["Cannon", "Wall"];
      for (var i = 0; i < types.length; i++) {
        var c = tiersOf(types[i])[0].cost;
        opts.push({ act: "build", type: types[i], cost: c, label: types[i] + " T1  " + c + "g" });
      }
    } else {
      var t = tiersOf(st.type);
      if (st.hp < st.max) {
        var rc = Math.max(1, Math.ceil((1 - st.hp / st.max) * t[st.tier].cost * BAL.repairFactor));
        opts.push({ act: "repair", cost: rc, label: "Repair  " + rc + "g" });
      }
      if (st.tier < t.length - 1) {
        opts.push({ act: "upgrade", cost: t[st.tier + 1].cost, label: "Upgrade T" + (st.tier + 2) + "  " + t[st.tier + 1].cost + "g" });
      }
      var refund = Math.floor(t[st.tier].cost * BAL.sellRefund);
      opts.push({ act: "sell", cost: -refund, label: "Sell  +" + refund + "g" });
    }
    var bw = Math.min(170, Math.floor((R.W - 40) / 4) - 8), y = R.H - 84;
    for (var j = 0; j < opts.length; j++) {
      opts[j].x = 20 + j * (bw + 10); opts[j].y = y; opts[j].w = bw; opts[j].h = 34;
    }
    return opts;
  }
  function confirmRects() {
    return {
      ok: { x: 20, y: R.H - 42, w: 140, h: 32 },
      no: { x: 172, y: R.H - 42, w: 100, h: 32 }
    };
  }
  function readyRect() { return { x: R.W - 132, y: 12, w: 116, h: 36 }; }
  function continueRect() { return { x: R.W / 2 - 80, y: R.H / 2 + 70, w: 160, h: 40 }; }
  function inRect(mx, my, r) { return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h; }

  function commit(opt) {
    var slot = slots[selSlot];
    if (opt.act === "build") {
      var t0 = tiersOf(opt.type)[0];
      if (game.gold < t0.cost) { lastCaption = "Not enough gold."; return; }
      game.gold -= t0.cost;
      slot.structure = { type: opt.type, tier: 0, hp: t0.hp, max: t0.hp, cd: 0, buildLeft: t0.build };
    } else {
      var st = slot.structure, tiers = tiersOf(st.type);
      if (opt.act === "repair") {
        if (game.gold < opt.cost) { lastCaption = "Not enough gold."; return; }
        game.gold -= opt.cost; st.hp = st.max;
      } else if (opt.act === "upgrade") {
        if (game.gold < opt.cost) { lastCaption = "Not enough gold."; return; }
        game.gold -= opt.cost;
        var oldMax = st.max, nt = tiers[st.tier + 1];
        st.tier++; st.max = nt.hp; st.hp = Math.min(st.hp + (nt.hp - oldMax), nt.hp);
        st.buildLeft = nt.build;
      } else if (opt.act === "sell") {
        game.gold += -opt.cost; slot.structure = null;
      }
    }
    log.inputs.push({ t: simTime, wave: game.wave, act: opt.act, slot: selSlot, type: opt.type || (slot.structure ? slot.structure.type : "") });
    lastCaption = opt.act.toUpperCase() + " committed on slot " + (selSlot + 1) + ".";
    staged = null;
  }

  // ---- Fixed-timestep battle simulation (T2) ----
  function step(fd) {
    simTime += fd;
    // spawn per wave list (F5)
    while (queue.length && queue[0].at <= simTime) {
      var q = queue.shift(), es = eTier(q.tier);
      enemies.push({ x: spawnX, tier: q.tier, hp: es.hp, max: es.hp, cd: 0 });
    }
    // structures: build timers + tower fire
    for (var i = 0; i < slots.length; i++) {
      var st = slots[i].structure;
      if (!st) continue;
      if (st.buildLeft > 0) { st.buildLeft -= fd; continue; }
      var stats = tiersOf(st.type)[st.tier];
      if (stats.dmg > 0) {
        st.cd -= fd;
        if (st.cd <= 0) {
          var best = null, bd = 1e9;
          for (var e = 0; e < enemies.length; e++) {
            var d = Math.abs(enemies[e].x - slots[i].x);
            if (d <= stats.range && d < bd) { bd = d; best = enemies[e]; }
          }
          if (best) {
            best.hp -= stats.dmg * BAL.mult.powderVsChem;
            st.cd = stats.rate;
            shots.push({ x1: slots[i].x, x2: best.x, t: 0.12 });
          }
        }
      }
    }
    // enemies: path left, attack blockers or base (F5)
    for (var e2 = enemies.length - 1; e2 >= 0; e2--) {
      var en = enemies[e2], es2 = eTier(en.tier);
      if (en.hp <= 0) {
        var bounty = eTier(en.tier).cost; // bounty = slain unit's current-tier Cost
        game.gold += bounty; game.score += bounty;
        lastCaption = "Greenie slain! +" + bounty + "g";
        enemies.splice(e2, 1);
        continue;
      }
      var target = null;
      for (var s = 0; s < slots.length; s++) {
        var b = slots[s].structure;
        if (b && slots[s].x < en.x && en.x - slots[s].x <= 20) { target = b; break; }
      }
      en.cd -= fd;
      if (target) {
        if (en.cd <= 0) { target.hp -= es2.dmg; en.cd = es2.rate; if (target.hp <= 0) lastCaption = "A structure fell!"; }
      } else if (en.x <= castleX + 44) {
        if (en.cd <= 0) { game.baseHP -= es2.dmg; en.cd = es2.rate; lastCaption = "The Castle is under attack!"; }
      } else {
        en.x -= es2.speed * fd;
      }
    }
    for (var s2 = 0; s2 < slots.length; s2++) {
      if (slots[s2].structure && slots[s2].structure.hp <= 0) slots[s2].structure = null;
    }
    for (var sh = shots.length - 1; sh >= 0; sh--) { shots[sh].t -= fd; if (shots[sh].t <= 0) shots.splice(sh, 1); }

    if (game.baseHP <= 0) { // defeat (F6) — not recoverable
      game.baseHP = 0; game.result = "lose";
      R.go(game.resultsState || "RESULTS");
      return;
    }
    if (!queue.length && !enemies.length) { // wave-clear -> Collect (F2/F6)
      collectGold = BAL.waveReward[game.wave - 1];
      game.gold += collectGold; game.score += collectGold;
      collectStory = BAL.story[game.wave - 1];
      phase = "collect";
      log.inputs.push({ t: simTime, wave: game.wave, act: "waveclear" });
    }
  }

  return {
    update: function (dt) {
      if (!R.inGameplay()) return;

      // Presentation toggles — display only, never core state (T4)
      if (R.pressed("p")) pal = (pal + 1) % PALS.length;
      if (R.pressed("c")) captions = !captions;
      if (R.pressed("i")) icons = !icons;
      if (R.pressed("v")) camAlt = !camAlt;

      var mx = R.mouse.x, my = R.mouse.y, click = R.mouse.clicked;

      if (phase === "build") {
        // Build phase: sim timer paused (F4). Pointer single-verb model (P1).
        if (click) {
          var opts = optionButtons(), handled = false;
          if (staged) {
            var cr = confirmRects();
            if (inRect(mx, my, cr.ok)) { commit(staged); handled = true; }
            else if (inRect(mx, my, cr.no)) { staged = null; handled = true; }
          }
          if (!handled) {
            for (var o = 0; o < opts.length; o++) {
              if (inRect(mx, my, opts[o])) { staged = opts[o]; handled = true; break; }
            }
          }
          if (!handled && inRect(mx, my, readyRect())) {
            log.inputs.push({ t: simTime, wave: game.wave, act: "ready" });
            phase = "battle"; buildQueue(game.wave - 1);
            simTime = 0; acc = 0; selSlot = -1; staged = null;
            lastCaption = "Wave " + game.wave + " incoming!";
            handled = true;
          }
          if (!handled) {
            for (var si = 0; si < slots.length; si++) {
              if (Math.abs(mx - slots[si].x) < 24 && Math.abs(my - laneY) < 34) {
                selSlot = si; staged = null; handled = true; break;
              }
            }
            if (!handled) { selSlot = -1; staged = null; }
          }
        }
        if (R.pressed("Enter")) { // Ready (F4)
          log.inputs.push({ t: simTime, wave: game.wave, act: "ready" });
          phase = "battle"; buildQueue(game.wave - 1);
          simTime = 0; acc = 0; selSlot = -1; staged = null;
          lastCaption = "Wave " + game.wave + " incoming!";
        }
      } else if (phase === "battle") {
        acc += dt;
        if (acc > 0.25) acc = 0.25;
        while (acc >= FIXED && phase === "battle") { step(FIXED); acc -= FIXED; }
      } else if (phase === "collect") {
        if ((click && inRect(mx, my, continueRect())) || R.pressed("Enter")) {
          log.inputs.push({ t: simTime, wave: game.wave, act: "continue" });
          if (game.wave >= 3) { // all 3 waves cleared = win; base HP measures success (F6)
            game.result = "win";
            game.score += Math.round(game.baseHP);
            R.go(game.resultsState || "RESULTS");
          } else {
            game.wave++; phase = "build"; simTime = 0; acc = 0;
            enemies = []; shots = [];
            lastCaption = "Build phase: wave " + game.wave + " of 3.";
          }
        }
      }
    },

    draw: function () {
      var C = PALS[pal], ctx = R.ctx;
      ctx.save();
      if (camAlt) ctx.translate(0, -8); // camera option: presentation only

      // Lane
      ctx.fillStyle = C.lane;
      ctx.fillRect(30, laneY - 22, R.W - 60, 44);
      // Spawn portal (far end)
      ctx.fillStyle = C.enemy;
      ctx.globalAlpha = 0.5; ctx.fillRect(spawnX - 6, laneY - 30, 14, 60); ctx.globalAlpha = 1;

      // Castle base
      ctx.fillStyle = C.wall;
      ctx.fillRect(castleX - 30, laneY - 58, 56, 80);
      ctx.fillRect(castleX - 36, laneY - 70, 12, 20);
      ctx.fillRect(castleX + 18, laneY - 70, 12, 20);
      if (icons) R.text("🏰", castleX - 2, laneY - 24, "20px sans-serif", C.ui, "center");
      var hw = 90, hf = Math.max(0, game.baseHP / game.baseMax);
      ctx.fillStyle = "#000"; ctx.fillRect(castleX - 34, laneY - 84, hw, 8);
      ctx.fillStyle = hf > 0.4 ? C.hpOk : C.hp; ctx.fillRect(castleX - 34, laneY - 84, hw * hf, 8);
      R.text("Base " + Math.ceil(game.baseHP) + "/" + game.baseMax, castleX - 34, laneY - 90, "11px sans-serif", C.dim, "left");

      // Slots + structures
      for (var i = 0; i < slots.length; i++) {
        var sl = slots[i];
        ctx.fillStyle = (i === selSlot && phase === "build") ? C.ui : C.pad;
        ctx.globalAlpha = (i === selSlot && phase === "build") ? 0.9 : 0.55;
        ctx.fillRect(sl.x - 18, laneY + 14, 36, 8);
        ctx.globalAlpha = 1;
        var st = sl.structure;
        if (st) {
          var building = st.buildLeft > 0;
          ctx.globalAlpha = building ? 0.5 : 1;
          if (st.type === "Wall") {
            ctx.fillStyle = C.wall;
            ctx.fillRect(sl.x - 14, laneY - 26 - st.tier * 6, 28, 40 + st.tier * 6);
          } else {
            ctx.fillStyle = C.tower;
            ctx.fillRect(sl.x - 11, laneY - 22 - st.tier * 6, 22, 36 + st.tier * 6);
            ctx.fillRect(sl.x - 3, laneY - 34 - st.tier * 6, 20, 6);
          }
          ctx.globalAlpha = 1;
          if (icons) R.text(st.type === "Wall" ? "W" : "C", sl.x, laneY + 2, "bold 11px sans-serif", "#221", "center");
          R.text("T" + (st.tier + 1), sl.x, laneY - 44 - st.tier * 6, "10px sans-serif", C.dim, "center");
          var f = Math.max(0, st.hp / st.max);
          ctx.fillStyle = "#000"; ctx.fillRect(sl.x - 15, laneY - 40 - st.tier * 6, 30, 4);
          ctx.fillStyle = f > 0.4 ? C.hpOk : C.hp; ctx.fillRect(sl.x - 15, laneY - 40 - st.tier * 6, 30 * f, 4);
        } else {
          R.text(String(i + 1), sl.x, laneY + 34, "10px sans-serif", C.dim, "center");
        }
      }

      // Shots
      ctx.strokeStyle = C.tower; ctx.lineWidth = 2;
      for (var sh = 0; sh < shots.length; sh++) {
        ctx.globalAlpha = Math.max(0, shots[sh].t / 0.12);
        ctx.beginPath(); ctx.moveTo(shots[sh].x1, laneY - 20); ctx.lineTo(shots[sh].x2, laneY - 4); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Enemies
      for (var e = 0; e < enemies.length; e++) {
        var en = enemies[e], rr = 8 + en.tier * 3;
        ctx.fillStyle = C.enemy;
        ctx.beginPath(); ctx.arc(en.x, laneY - 4, rr, 0, Math.PI * 2); ctx.fill();
        var ef = Math.max(0, en.hp / en.max);
        ctx.fillStyle = "#000"; ctx.fillRect(en.x - 10, laneY - 20 - en.tier * 3, 20, 3);
        ctx.fillStyle = C.hp; ctx.fillRect(en.x - 10, laneY - 20 - en.tier * 3, 20 * ef, 3);
      }
      ctx.restore();

      // HUD
      R.text(phase === "build" ? "BUILD PHASE" : phase === "battle" ? "BATTLE PHASE" : "COLLECT",
        R.W / 2, 22, "bold 18px sans-serif", C.ui, "center");
      R.text("Wave " + game.wave + " / 3", R.W / 2, 42, "13px sans-serif", C.dim, "center");
      R.text("Gold: " + game.gold, 20, 22, "bold 15px sans-serif", C.tower, "left");
      R.text("Score: " + game.score, 20, 42, "12px sans-serif", C.dim, "left");
      R.text("[P]alette [C]aptions [I]cons [V]iew", 20, R.H - 8, "10px sans-serif", C.dim, "left");

      if (phase === "build") {
        var rb = readyRect();
        R.ctx.fillStyle = C.hpOk; R.roundRect(rb.x, rb.y, rb.w, rb.h, 6); R.ctx.fill();
        R.text("READY ▶", rb.x + rb.w / 2, rb.y + 24, "bold 14px sans-serif", "#10240f", "center");
        R.text("Tap a slot to build, or a structure to repair/upgrade/sell.", R.W / 2, laneY + 66, "12px sans-serif", C.dim, "center");
        var opts = optionButtons();
        if (selSlot >= 0) {
          R.ctx.fillStyle = C.panel; R.ctx.fillRect(0, R.H - 100, R.W, 100);
          R.text("Slot " + (selSlot + 1), 20, R.H - 92 + 4, "bold 12px sans-serif", C.ui, "left");
          for (var o = 0; o < opts.length; o++) {
            var ob = opts[o], isStaged = staged && staged.act === ob.act && staged.type === ob.type;
            R.ctx.fillStyle = isStaged ? C.tower : "#44415a";
            R.roundRect(ob.x, ob.y, ob.w, ob.h, 5); R.ctx.fill();
            R.text(ob.label, ob.x + ob.w / 2, ob.y + 22, "12px sans-serif", isStaged ? "#221" : C.ui, "center");
          }
          if (staged) {
            var cr = confirmRects();
            R.ctx.fillStyle = C.hpOk; R.roundRect(cr.ok.x, cr.ok.y, cr.ok.w, cr.ok.h, 5); R.ctx.fill();
            R.text("CONFIRM", cr.ok.x + cr.ok.w / 2, cr.ok.y + 21, "bold 13px sans-serif", "#10240f", "center");
            R.ctx.fillStyle = "#66334a"; R.roundRect(cr.no.x, cr.no.y, cr.no.w, cr.no.h, 5); R.ctx.fill();
            R.text("Cancel", cr.no.x + cr.no.w / 2, cr.no.y + 21, "12px sans-serif", C.ui, "center");
          }
        }
      }

      if (phase === "battle") {
        R.text("Remaining: " + (queue.length + enemies.length), R.W - 20, 22, "12px sans-serif", C.dim, "right");
      }

      if (phase === "collect") {
        R.ctx.fillStyle = C.panel;
        R.roundRect(R.W / 2 - 210, R.H / 2 - 90, 420, 220, 10); R.ctx.fill();
        R.text("WAVE " + game.wave + " CLEARED", R.W / 2, R.H / 2 - 58, "bold 18px sans-serif", C.hpOk, "center");
        R.text(collectStory, R.W / 2, R.H / 2 - 26, "12px sans-serif", C.ui, "center");
        R.text("Collected gold: +" + collectGold, R.W / 2, R.H / 2 + 6, "bold 14px sans-serif", C.tower, "center");
        R.text("Base HP: " + Math.ceil(game.baseHP) + " / " + game.baseMax, R.W / 2, R.H / 2 + 30, "12px sans-serif", C.dim, "center");
        var cb = continueRect();
        R.ctx.fillStyle = C.hpOk; R.roundRect(cb.x, cb.y, cb.w, cb.h, 6); R.ctx.fill();
        R.text(game.wave >= 3 ? "FINISH" : "CONTINUE ▶", cb.x + cb.w / 2, cb.y + 26, "bold 14px sans-serif", "#10240f", "center");
      }

      if (captions) {
        R.text(lastCaption, R.W / 2, R.H - 8, "12px sans-serif", C.ui, "center");
      }
    }
  };
};
})();