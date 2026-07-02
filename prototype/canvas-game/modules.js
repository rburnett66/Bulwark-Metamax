/*
 * prototype-kits/canvas-game/modules.js  (PS-3.2 / PS-3.3)
 *
 * Config-driven SCREEN + MECHANIC modules for the canvas-game kit. Each is a factory that closes over
 * the runtime API + the shared `game` state; none of them implements engine plumbing (the runtime owns
 * that). Screens:  Title, Menu, CharacterSelect, LocationSelect, GearSelect, Gameplay, Results.
 * Mechanics:  TopDownNavigate, SkillMiniGame (dot-in-box), SessionTimer.
 */
(function () {
  'use strict';
  var K = (typeof window !== 'undefined' ? window : globalThis);
  K.MMKit = K.MMKit || {};
  var R = K.MMKit.runtime;
  var S = K.MMKit.screens = K.MMKit.screens || {};
  var M = K.MMKit.mechanics = K.MMKit.mechanics || {};
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var rand = function (a, b) { return a + Math.random() * (b - a); };

  function nexts(state) { return (state.next || []); }
  function bg(state, fallback) { return R.drawBg(state.cfg && state.cfg.asset ? state.cfg.asset : null, fallback); }

  /* ===== SCREENS ===== */

  S.Title = function (state, config, game) {
    return function () {
      bg(state, '#0a2238'); R.clearBtns();
      // title/logo usually baked into the art — only draw a subtitle + a start button
      R.text(state.cfg && state.cfg.subtitle || '', R.W / 2, R.H / 2 - 40, 'italic 20px Trebuchet MS', '#cfe9ff');
      var n = nexts(state)[0];
      R.addBtn(R.W / 2 - 110, R.H - 120, 220, 54, state.cfg && state.cfg.cta || 'Play', function () { R.go(n); }, { bg: '#2a8f6f' });
      R.drawBtns();
    };
  };

  S.Menu = function (state, config, game) {
    return function () {
      bg(state, '#10283f'); R.clearBtns();
      var ns = nexts(state), y = R.H / 2 - (ns.length * 33);
      ns.forEach(function (target, i) {
        R.addBtn(R.W / 2 - 150, y + i * 66, 300, 50, state.cfg && state.cfg.labels && state.cfg.labels[i] || target,
          (function (t) { return function () { R.go(t); }; })(target));
      });
      R.drawBtns();
    };
  };

  // A generic BUILT screen for a flow screen with no specialised kit factory: draws the screen's
  // backdrop art (cfg.asset) + its title, and a button per outgoing transition (cfg.navLabels label
  // them) so it navigates the real flow. This is what makes the prototype show the designed screens.
  S.Screen = function (state, config, game) {
    return function () {
      // Missing backdrop art → a clean WHITE screen (not a broken/dark one); switch text to dark so it
      // stays readable. Present art → the image + light text as before.
      var hasArt = bg(state, '#ffffff'); R.clearBtns();
      var fg = hasArt ? '#eaf2ff' : '#1a2530';
      R.text((state.cfg && state.cfg.title) || state.name, R.W / 2, 54, '800 26px Trebuchet MS', fg);
      var ns = nexts(state), labels = (state.cfg && state.cfg.navLabels) || [];
      var y = R.H / 2 - (ns.length * 33);
      ns.forEach(function (target, i) {
        R.addBtn(R.W / 2 - 150, y + i * 66, 300, 50, labels[i] || target,
          (function (t) { return function () { R.go(t); }; })(target));
      });
      if (!ns.length) R.text('— end of flow —', R.W / 2, R.H / 2, '16px Trebuchet MS', hasArt ? '#7f93a4' : '#8aa');
      R.drawBtns();
    };
  };

  // A visible placeholder for peripheral screens the scaffold declares but does not build (stub
  // fidelity). Draws the screen name + a Back button to cfg.back so the slice never dead-ends.
  S.Stub = function (state, config, game) {
    return function () {
      bg(state, '#101820'); R.clearBtns();
      R.text((state.cfg && state.cfg.title) || state.name, R.W / 2, R.H / 2 - 26, '800 30px Trebuchet MS', '#cfe0ee');
      R.text('stub — not built in this prototype', R.W / 2, R.H / 2 + 12, '16px Trebuchet MS', '#7f93a4');
      var back = (state.cfg && state.cfg.back) || config.first || 'TITLE';
      R.addBtn(R.W / 2 - 90, R.H - 92, 180, 46, 'Back', function () { R.go(back); }, { bg: '#39506a' });
      R.drawBtns();
    };
  };

  S.CharacterSelect = function (state, config, game) {
    var list = (config.data && config.data.characters) || [], L = config.labels || {};
    return function () {
      bg(state, '#15233a'); R.clearBtns();
      R.text(L.characterPrompt || 'Choose your character', R.W / 2, 70, '800 30px Trebuchet MS', '#fff');
      var cw = 180, gap = 26, total = list.length * cw + (list.length - 1) * gap, sx = (R.W - total) / 2;
      list.forEach(function (c, i) {
        var x = sx + i * (cw + gap), y = 120, on = (game.charIndex || 0) === i;
        R.ctx.fillStyle = on ? 'rgba(77,155,255,.28)' : 'rgba(8,40,52,.6)';
        R.roundRect(x, y, cw, 220, 12); R.ctx.fill();
        R.ctx.strokeStyle = on ? '#4d9bff' : '#2a5a6b'; R.ctx.lineWidth = on ? 3 : 1.5; R.ctx.stroke();
        if (!R.drawSpr('spr_' + c.spr, x + cw / 2, y + 95, cw - 30, 150)) { R.ctx.fillStyle = '#3a6b78'; R.ctx.fillRect(x + 20, y + 30, cw - 40, 130); }
        R.text(c.name, x + cw / 2, y + 196, '700 18px Trebuchet MS', '#fff');
        if (R.mouse.clicked && R.mouse.x >= x && R.mouse.x <= x + cw && R.mouse.y >= y && R.mouse.y <= y + 220) { game.charIndex = i; R.mouse.clicked = false; }
      });
      var n = nexts(state)[0];
      R.addBtn(R.W / 2 - 120, R.H - 70, 240, 50, 'Confirm', function () { R.go(n); }, { bg: '#1f8b55' });
      R.drawBtns();
    };
  };

  S.LocationSelect = function (state, config, game) {
    var locs = (config.data && config.data.locations) || [], L = config.labels || {};
    return function () {
      bg(state, '#0e2030'); R.clearBtns();
      R.text(L.locationPrompt || 'Choose a location', R.W / 2, 60, '800 28px Trebuchet MS', '#fff');
      var cw = 260, gap = 24, perRow = Math.max(1, Math.floor((R.W - 40) / (cw + gap)));
      locs.forEach(function (l, i) {
        var col = i % perRow, row = (i / perRow) | 0;
        var x = 40 + col * (cw + gap), y = 110 + row * 150, on = (game.locationIndex || 0) === i;
        R.ctx.fillStyle = on ? 'rgba(77,155,255,.28)' : 'rgba(6,28,37,.6)'; R.roundRect(x, y, cw, 130, 12); R.ctx.fill();
        R.ctx.strokeStyle = on ? '#4d9bff' : '#2a5a6b'; R.ctx.lineWidth = on ? 3 : 1.5; R.ctx.stroke();
        R.text(l.name, x + cw / 2, y + 38, '700 20px Trebuchet MS', '#fff');
        R.text('Difficulty: ' + (l.diff || '—'), x + cw / 2, y + 70, '14px Trebuchet MS', '#9fc4dc');
        if (R.mouse.clicked && R.mouse.x >= x && R.mouse.x <= x + cw && R.mouse.y >= y && R.mouse.y <= y + 130) { game.locationIndex = i; R.mouse.clicked = false; }
      });
      var n = nexts(state)[0];
      R.addBtn(R.W / 2 - 120, R.H - 64, 240, 48, L.locationCta || 'Continue', function () { R.go(n); }, { bg: '#1f8b55' });
      R.drawBtns();
    };
  };

  S.GearSelect = function (state, config, game) {
    return function () {
      bg(state, '#241a14'); R.clearBtns();
      R.text('Your starter kit', R.W / 2, 70, '800 28px Trebuchet MS', '#fff');
      var gear = (config.data && config.data.gear) || [];
      gear.forEach(function (g, i) { R.text(g.label + ': ' + g.name, R.W / 2, 130 + i * 40, '18px Trebuchet MS', '#eedfa0'); });
      var n = nexts(state)[0];
      R.addBtn(R.W / 2 - 120, R.H - 70, 240, 50, 'Launch', function () { R.go(n); }, { bg: '#1f8b55' });
      R.drawBtns();
    };
  };

  // Generic gameplay screen — runs whatever mechanics the config lists (their draw() + their own
  // update/input via R.onUpdate), with a generic HUD (timer if game.timeLeft, score/count) + Finish.
  // This is the host EVERY rules-generated bespoke mechanic plays under — it is genre-neutral. (S.Gameplay
  // below is a hand-authored Bass-tastic SAMPLE screen, not a default — the pipeline never routes to it.)
  S.PlayField = function (state, config, game) {
    var L = config.labels || {}, mechs = config.mechanics || [];
    return function () {
      bg(state, '#0d2a3c'); R.clearBtns();
      R.drawParticles();
      for (var i = 0; i < mechs.length; i++) { var m = game['mech_' + mechs[i]]; if (m && m.draw) m.draw(); }
      var tl = game.timeLeft;
      if (typeof tl === 'number') {
        R.ctx.fillStyle = 'rgba(6,28,37,.8)'; R.roundRect(R.W / 2 - 80, 10, 160, 44, 10); R.ctx.fill();
        R.text((tl / 60 | 0) + ':' + ('0' + (tl % 60 | 0)).slice(-2), R.W / 2, 32, '900 24px Trebuchet MS', tl <= 15 ? '#f15b54' : '#fff');
      }
      var score = (typeof game.score === 'number') ? game.score : (game.collected || []).length;
      R.text((L.count || 'SCORE') + ' ' + score, 70, 28, '800 20px Trebuchet MS', '#9effb0', 'left');
      var n = nexts(state)[0];
      if (n) R.addBtn(R.W - 180, R.H - 50, 160, 38, L.finish || 'Finish', function () { R.go(n); }, { bg: '#b5701d' });
      R.drawBtns();
    };
  };

  // SAMPLE ONLY (Bass-tastic demo): a top-down navigate + skill-minigame gameplay screen. The generation
  // pipeline never routes here (it uses S.PlayField + a rules-generated mechanic) — kept for the kit sample.
  S.Gameplay = function (state, config, game) {
    var nav = game.mech_TopDownNavigate, mini = game.mech_SkillMiniGame, L = config.labels || {};
    return function () {
      bg(state, '#0d3a5c'); R.clearBtns();
      if (nav) nav.draw();
      R.drawParticles();
      if (game.phase === 'skill' && mini) { mini.draw(); }
      else if (nav && nav.atSite()) { R.text(L.action || 'Press SPACE to act', game.avatar.x, game.avatar.y - 44, '700 16px Trebuchet MS', '#fff'); }
      // HUD
      var tl = Math.max(0, game.timeLeft || 0);
      R.ctx.fillStyle = 'rgba(6,28,37,.8)'; R.roundRect(R.W / 2 - 80, 10, 160, 44, 10); R.ctx.fill();
      R.text((tl / 60 | 0) + ':' + ('0' + (tl % 60 | 0)).slice(-2), R.W / 2, 32, '900 24px Trebuchet MS', tl <= 15 ? '#f15b54' : '#fff');
      R.text((L.count || 'GOT') + ' ' + ((game.collected || []).length), 70, 28, '800 20px Trebuchet MS', '#9effb0', 'left');
      // trigger the skill mini-game on SPACE near an active site
      if (game.phase !== 'skill' && nav && nav.atSite() && R.keys[' '] && !R.keyLatch[' ']) { R.keyLatch[' '] = true; if (mini) mini.start(nav.atSite()); }
      var n = nexts(state)[0];
      R.addBtn(R.W - 180, R.H - 50, 160, 38, L.finish || 'Finish', function () { R.go(n); }, { bg: '#b5701d' });
      R.drawBtns();
    };
  };

  S.Results = function (state, config, game) {
    var L = config.labels || {};
    return function () {
      bg(state, '#102018'); R.clearBtns();
      R.text(state.cfg && state.cfg.title || L.results || 'RESULTS', R.W / 2, 70, '900 38px Trebuchet MS', '#fff');
      var collected = game.collected || [], total = collected.reduce(function (s, it) { return s + (it.val || 0); }, 0);
      var unit = L.unit || 'pts', item = L.item || 'item';
      R.text(collected.length + ' ' + item + (collected.length === 1 ? '' : 's') + ' · ' + total.toFixed(1) + ' ' + unit, R.W / 2, 130, '700 22px Trebuchet MS', '#9fc4dc');
      collected.slice(0, 8).forEach(function (it, i) { R.text((it.type || item) + ' ' + (it.val || 0).toFixed(1) + ' ' + unit, R.W / 2, 180 + i * 28, '16px Trebuchet MS', '#eaf6ff'); });
      var n = nexts(state)[0];
      R.addBtn(R.W / 2 - 110, R.H - 80, 220, 50, L.playAgain || 'Play again', function () { game.collected = []; R.go(n); }, { bg: '#1f8b55' });
      R.drawBtns();
    };
  };

  /* ===== MECHANICS ===== */

  M.SessionTimer = function (config, game) {
    game.timeLeft = (config.data && config.data.sessionSeconds) || 120;
    return {
      update: function (dt) {
        if (R.current() !== 'GAMEPLAY') return;
        game.timeLeft -= dt;
        if (game.timeLeft <= 0) { game.timeLeft = 0; var res = (game.resultsState || 'RESULTS'); R.go(res); }
      },
    };
  };

  M.TopDownNavigate = function (config, game) {
    var L = config.labels || {}, avatarKey = 'spr_' + ((config.data && config.data.avatarSprite) || 'avatar');
    var tiers = L.tiers || ['', 'LOW', 'MID', 'TOP'];
    game.avatar = { x: R.W / 2, y: R.H - 80, a: -Math.PI / 2, vx: 0, vy: 0 };
    var loc = (config.data && config.data.locations && config.data.locations[game.locationIndex || 0]) || { mix: [1, 1, 2, 2, 3] };
    game.sites = (loc.mix || [1, 2, 2, 3, 3]).map(function (tier, i) {
      return { x: rand(110, R.W - 110), y: rand(90, R.H - 180), tier: tier, used: false, ph: rand(0, 6.28) };
    });
    var near = null;
    return {
      atSite: function () { return near; },
      update: function (dt) {
        if (R.current() !== 'GAMEPLAY' || game.phase === 'skill') return;
        // frame-rate normalizer: motion is tuned per-frame @60fps, scaled by f so a 120/144Hz
        // display runs at the SAME real-world speed instead of 2-2.4x too fast.
        var f = (dt > 0 ? dt : 1 / 60) * 60;
        var b = game.avatar, sp = 0.05, mx = 2.4, turn = 0.04;
        if (R.keys['ArrowUp']) { b.vx += Math.cos(b.a) * sp * f; b.vy += Math.sin(b.a) * sp * f; }
        if (R.keys['ArrowDown']) { b.vx -= Math.cos(b.a) * sp * 0.6 * f; b.vy -= Math.sin(b.a) * sp * 0.6 * f; }
        var spd = Math.hypot(b.vx, b.vy);
        if (R.keys['ArrowLeft']) b.a -= turn * f * clamp(spd / mx, 0.2, 1);
        if (R.keys['ArrowRight']) b.a += turn * f * clamp(spd / mx, 0.2, 1);
        var fwd = { x: Math.cos(b.a), y: Math.sin(b.a) }, lat = { x: -fwd.y, y: fwd.x };
        var vf = b.vx * fwd.x + b.vy * fwd.y, vl = b.vx * lat.x + b.vy * lat.y;
        vf *= Math.pow(0.985, f); vl *= Math.pow(0.86, f); if (vf > mx) vf = mx; if (vf < -mx * 0.5) vf = -mx * 0.5;
        b.vx = fwd.x * vf + lat.x * vl; b.vy = fwd.y * vf + lat.y * vl;
        b.x = clamp(b.x + b.vx * f, 34, R.W - 34); b.y = clamp(b.y + b.vy * f, 34, R.H - 34);
        if (Math.hypot(b.vx, b.vy) > 0.7) R.spawn(b.x - fwd.x * 20, b.y - fwd.y * 20, { spread: 1, r: 3 });
        near = null; for (var i = 0; i < game.sites.length; i++) { var s = game.sites[i]; if (!s.used && Math.hypot(s.x - b.x, s.y - b.y) < 48) { near = s; break; } }
      },
      draw: function () {
        var ctx = R.ctx;
        ctx.fillStyle = '#7a5230'; ctx.fillRect(R.W / 2 - 44, R.H - 30, 88, 26); R.text(L.home || 'HOME', R.W / 2, R.H - 16, '12px Trebuchet MS', '#ffe27a');
        for (var i = 0; i < game.sites.length; i++) {
          var s = game.sites[i]; var rare = s.tier >= 3;
          if (s.used) { ctx.strokeStyle = 'rgba(120,120,120,.4)'; } else { ctx.strokeStyle = rare ? 'rgba(242,165,60,.8)' : 'rgba(199,216,220,.7)'; }
          ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x, s.y, 16 + (s.tier * 4), 0, Math.PI * 2); ctx.stroke();
          R.text(tiers[Math.min(s.tier, 3)] || '', s.x, s.y + 30, '11px Trebuchet MS', rare ? '#f2a53c' : '#c7d8dc');
        }
        var b = game.avatar;
        if (!R.drawSpr(avatarKey, b.x, b.y, 50, 80)) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a + Math.PI / 2); ctx.fillStyle = '#2b6f9c'; ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(12, 16); ctx.lineTo(-12, 16); ctx.closePath(); ctx.fill(); ctx.restore(); }
      },
    };
  };

  M.SkillMiniGame = function (config, game) {
    var L = config.labels || {};
    game.skill = { active: false, pos: 0.5, vel: 0, tMin: 0.4, tMax: 0.6, progress: 0, item: null };
    var itemTypes = (config.data && config.data.itemTypes) || [{ type: 'A' }, { type: 'B' }, { type: 'C' }];
    return {
      start: function (site) {
        var k = itemTypes[(Math.random() * itemTypes.length) | 0];
        var v = rand(0.5, 2) + (site.tier || 1) * rand(1.5, 4);
        var c = rand(0.3, 0.7), half = 0.12;
        game.skill = { active: true, pos: 0.5, vel: 0, tMin: c - half, tMax: c + half, progress: 0, item: { type: k.type, val: +v.toFixed(1) }, site: site };
        game.phase = 'skill';
      },
      update: function (dt) {
        var r = game.skill; if (!r.active || R.current() !== 'GAMEPLAY') return;
        var f = (dt > 0 ? dt : 1 / 60) * 60;   // same frame-rate normalizer as navigation
        var held = R.keys[' '] || R.keys['ArrowLeft'] || R.keys['ArrowRight'];
        // Ball tuned ~20x slower so it can be parked on the green zone on a small canvas.
        r.vel += (held ? -0.0008 : 0.00055) * f; r.vel = clamp(r.vel, -0.0012, 0.0012);
        r.pos = clamp(r.pos + r.vel * f, 0, 1);
        var inZone = r.pos >= r.tMin && r.pos <= r.tMax;
        r.progress = clamp(r.progress + (inZone ? 0.8 : -0.6) * f, 0, 100);
        if (r.progress >= 100) {
          (game.collected = game.collected || []).push(r.item); if (r.site) r.site.used = true;
          r.active = false; game.phase = 'roam';
          var ax = (game.avatar && game.avatar.x) || R.W / 2, ay = (game.avatar && game.avatar.y) || R.H / 2;
          for (var i = 0; i < 14; i++) R.spawn(ax, ay, { spread: 3, up: 2 });
        }
      },
      draw: function () {
        var r = game.skill, ctx = R.ctx; var bx = R.W / 2 - 160, by = R.H - 150, bw = 320, bh = 28;
        R.text(L.miniGame || 'Hold SPACE to keep the dot in the green zone', R.W / 2, by - 24, 'bold 16px Trebuchet MS', '#fff');
        ctx.fillStyle = 'rgba(0,0,0,.55)'; R.roundRect(bx, by, bw, bh, 8); ctx.fill();
        ctx.fillStyle = 'rgba(60,200,90,.55)'; ctx.fillRect(bx + r.tMin * bw, by, (r.tMax - r.tMin) * bw, bh);
        ctx.fillStyle = '#ffd95e'; ctx.beginPath(); ctx.arc(bx + r.pos * bw, by + bh / 2, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#36c6a0'; ctx.fillRect(bx, by + bh + 6, bw * (r.progress / 100), 6);
      },
    };
  };
})();
