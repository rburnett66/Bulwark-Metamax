(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.LoadingScreen = function (state, config, game) {

  // ---- static, deterministic data -------------------------------------
  var CHAR_KEYS = [
    'chars_6_mother', 'chars_5_mother', 'chars_4_mother',
    'chars_3_chaplain', 'chars_2_chaplain', 'chars_1_chaplain',
    'chars_3_mother', 'chars_2_mother', 'chars_1_mother',
    'chars_3_tide', 'chars_2_tide', 'chars_1_tide'
  ];

  var PHASES = [
    { upTo: 18,  label: 'READING BALANCE WORKBOOK' },
    { upTo: 33,  label: 'SUMMING POWER BUDGETS (100 PTS)' },
    { upTo: 48,  label: 'CALIBRATING EFFECTIVENESS MATRIX' },
    { upTo: 66,  label: 'MUSTERING 72-UNIT ROSTER' },
    { upTo: 80,  label: 'SCOUTING FOG OF WAR' },
    { upTo: 94,  label: 'RAISING FORTIFICATIONS' },
    { upTo: 101, label: 'BULWARK HOLDS — DEPLOYING' }
  ];

  var TIPS = [
    'TIP: Basic units path to your base — only Artillery targets structures.',
    'TIP: Anti-air units can target Both ground and air. Watch the skies.',
    'TIP: Every archetype spends exactly 100 power points. No exceptions.',
    'TIP: Fog of war is scouted, not free — vision is a stat you buy.',
    'TIP: Nine factions, eight shapes, three tiers. Know your counters.',
    'TIP: Replay reproduces identical outcomes — the sim never lies.'
  ];

  var HOLD_FRAMES = 48; // brief "READY" beat before auto-advance

  // ---- navigation target (from state.next) ------------------------------
  function resolveTarget() {
    var n = state && state.next;
    if (!n) return null;
    if (typeof n === 'string') return n;
    if (Object.prototype.toString.call(n) === '[object Array]') {
      if (!n.length) return null;
      var e = n[0];
      if (typeof e === 'string') return e;
      return (e && (e.target || e.to || e.name)) || null;
    }
    if (typeof n === 'object') {
      for (var k in n) {
        if (Object.prototype.hasOwnProperty.call(n, k)) {
          var v = n[k];
          if (typeof v === 'string') return v;
          if (v && typeof v === 'object') return v.target || v.to || v.name || k;
          return k;
        }
      }
    }
    return null;
  }

  // ---- per-visit UI state (UI-scoped key on game) ------------------------
  function freshUI() {
    return {
      t: 0,
      progress: 0,
      stall: 0,
      cps: [
        { at: 33, used: false },
        { at: 66, used: false },
        { at: 88, used: false }
      ],
      tipIdx: Math.floor(R.rand() * TIPS.length) % TIPS.length,
      hold: 0,
      went: false
    };
  }

  function leave() {
    var tgt = resolveTarget();
    game._loadingUI = null; // reset so revisits restart cleanly
    if (tgt) R.go(tgt);
  }

  function phaseLabel(p) {
    for (var i = 0; i < PHASES.length; i++) {
      if (p < PHASES[i].upTo) return PHASES[i].label;
    }
    return PHASES[PHASES.length - 1].label;
  }

  // ---- frame --------------------------------------------------------------
  return function () {
    R.clearBtns();
    R.drawBg(state.cfg && state.cfg.asset, '#0b1016');

    var ctx = R.ctx;
    var W = R.W, H = R.H;

    if (!game._loadingUI) game._loadingUI = freshUI();
    var ui = game._loadingUI;
    ui.t++;

    // --- advance simulated load (deterministic via R.rand only) ---------
    if (ui.progress < 100) {
      if (ui.stall > 0) {
        ui.stall--;
      } else {
        ui.progress += 0.35 + R.rand() * 0.6;
        for (var c = 0; c < ui.cps.length; c++) {
          if (!ui.cps[c].used && ui.progress >= ui.cps[c].at) {
            ui.cps[c].used = true;
            ui.stall = 20 + Math.floor(R.rand() * 30);
          }
        }
        if (ui.progress >= 100) ui.progress = 100;
      }
      if (ui.t % 240 === 0) ui.tipIdx = (ui.tipIdx + 1) % TIPS.length;
    } else {
      ui.hold++;
      if (ui.hold > HOLD_FRAMES && !ui.went) {
        ui.went = true;
        leave();
        R.drawBtns();
        return;
      }
    }

    // --- readability scrim + vignette over backdrop ----------------------
    ctx.save();
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(6,10,15,0.58)');
    grad.addColorStop(0.5, 'rgba(6,10,15,0.40)');
    grad.addColorStop(1, 'rgba(4,7,11,0.80)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // --- TITLE — anchor of the hierarchy ----------------------------------
    var titleY = H * 0.13;
    var titleSize = Math.round(Math.min(W * 0.11, H * 0.085));
    R.text('B U L W A R K', W / 2 + 3, titleY + 3, '900 ' + titleSize + 'px Arial', 'rgba(0,0,0,0.75)', 'center');
    R.text('B U L W A R K', W / 2, titleY, '900 ' + titleSize + 'px Arial', '#e8d9a0', 'center');
    // amber rule under title
    ctx.save();
    ctx.strokeStyle = 'rgba(242,182,50,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W / 2 - titleSize * 2.2, titleY + titleSize * 0.55);
    ctx.lineTo(W / 2 + titleSize * 2.2, titleY + titleSize * 0.55);
    ctx.stroke();
    ctx.restore();
    R.text('— HOLD THE LINE —', W / 2, titleY + titleSize * 0.55 + Math.max(16, H * 0.03),
      '600 ' + Math.max(11, Math.round(H * 0.024)) + 'px Arial', 'rgba(210,220,235,0.85)', 'center');

    // --- character carousel (cross-fades through ALL 12 portraits) --------
    var SEG = 140, FADE = 22;
    var idx = Math.floor(ui.t / SEG) % CHAR_KEYS.length;
    var local = ui.t % SEG;
    var alpha = 1;
    if (local < FADE) alpha = local / FADE;
    else if (local > SEG - FADE) alpha = (SEG - local) / FADE;

    var pw = Math.min(W * 0.32, H * 0.36);
    var ph = pw;
    var px = W / 2 - pw / 2;
    var py = H * 0.25 + Math.sin(ui.t * 0.03) * H * 0.006;

    ctx.save();
    // portrait plinth
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#0c1420';
    R.roundRect(px - pw * 0.08, py - ph * 0.04, pw * 1.16, ph * 1.1, 12);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#3d4f66';
    ctx.lineWidth = 2;
    R.roundRect(px - pw * 0.08, py - ph * 0.04, pw * 1.16, ph * 1.1, 12);
    ctx.stroke();
    // hero sprite, cross-faded
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    R.drawSpr(CHAR_KEYS[idx], px, py, pw, ph);
    ctx.restore();

    // corner brackets on plinth (HUD flavor)
    ctx.save();
    ctx.strokeStyle = '#e8d9a0';
    ctx.lineWidth = 2;
    var bx = px - pw * 0.08, by = py - ph * 0.04, bw = pw * 1.16, bh = ph * 1.1, L = 14;
    ctx.beginPath();
    ctx.moveTo(bx, by + L); ctx.lineTo(bx, by); ctx.lineTo(bx + L, by);
    ctx.moveTo(bx + bw - L, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + L);
    ctx.moveTo(bx, by + bh - L); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + L, by + bh);
    ctx.moveTo(bx + bw - L, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - L);
    ctx.stroke();
    ctx.restore();

    R.text('ROSTER SCAN ' + (idx + 1) + '/' + CHAR_KEYS.length,
      W / 2, by + bh + Math.max(14, H * 0.026),
      '600 ' + Math.max(10, Math.round(H * 0.017)) + 'px Arial',
      'rgba(200,214,226,0.65)', 'center');

    // --- PROGRESS BAR -------------------------------------------------------
    var frac = ui.progress / 100;
    var barW = Math.min(W * 0.66, 560);
    var barH = Math.max(18, Math.round(H * 0.034));
    var barX = (W - barW) / 2;
    var barY = H * 0.76;
    var rad = barH / 2;

    // phase label above bar (left) + big percent (right)
    var dots = '';
    var nd = Math.floor(ui.t / 18) % 4;
    for (var d = 0; d < nd; d++) dots += '.';
    var statusSize = Math.max(12, Math.round(H * 0.023));
    if (ui.progress >= 100) {
      var pulse = 0.7 + 0.3 * Math.sin(ui.t * 0.25);
      ctx.save();
      ctx.globalAlpha = pulse;
      R.text('DEPLOYMENT READY', barX, barY - barH * 0.7,
        '800 ' + Math.round(statusSize * 1.1) + 'px Arial', '#9df2a8', 'left');
      ctx.restore();
    } else {
      R.text(phaseLabel(ui.progress) + dots, barX, barY - barH * 0.7,
        '600 ' + statusSize + 'px Arial', 'rgba(214,226,236,0.92)', 'left');
    }
    var pct = Math.floor(ui.progress);
    R.text(pct + '%', barX + barW, barY - barH * 0.7,
      '800 ' + Math.round(statusSize * 1.3) + 'px Arial',
      ui.progress >= 100 ? '#8ef29a' : '#ffd47a', 'right');

    ctx.save();
    // trough
    ctx.fillStyle = 'rgba(8,14,22,0.85)';
    R.roundRect(barX - 4, barY - 4, barW + 8, barH + 8, rad + 4);
    ctx.fill();
    ctx.strokeStyle = '#5a6d85';
    ctx.lineWidth = 2;
    R.roundRect(barX - 4, barY - 4, barW + 8, barH + 8, rad + 4);
    ctx.stroke();

    // fill with animated chevron stripes, clipped
    var fillW = barW * frac;
    if (fillW > 2) {
      ctx.save();
      R.roundRect(barX, barY, fillW, barH, rad);
      ctx.clip();
      var fillGrad = ctx.createLinearGradient(0, barY, 0, barY + barH);
      if (ui.progress >= 100) {
        fillGrad.addColorStop(0, '#7fe08c');
        fillGrad.addColorStop(1, '#3f9c53');
      } else {
        fillGrad.addColorStop(0, '#ffcf6e');
        fillGrad.addColorStop(1, '#b98e2f');
      }
      ctx.fillStyle = fillGrad;
      ctx.fillRect(barX, barY, fillW, barH);
      // moving chevrons
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      var off = (ui.t * 1.4) % (barH * 2);
      for (var s = -barH * 2; s < fillW + barH * 2; s += barH * 2) {
        ctx.beginPath();
        ctx.moveTo(barX + s + off, barY);
        ctx.lineTo(barX + s + off + barH, barY);
        ctx.lineTo(barX + s + off, barY + barH);
        ctx.lineTo(barX + s + off - barH, barY + barH);
        ctx.closePath();
        ctx.fill();
      }
      // top sheen
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(barX, barY, fillW, barH * 0.4);
      ctx.restore();
    }

    // checkpoint ticks + 10% gauge marks
    ctx.strokeStyle = 'rgba(220,230,245,0.30)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 1; i < 10; i++) {
      var tx = barX + (barW * i) / 10;
      ctx.moveTo(tx, barY + 2);
      ctx.lineTo(tx, barY + barH - 2);
    }
    ctx.stroke();
    ctx.restore();

    // tiny escort sprite marching at the fill edge
    var mSz = barH * 2.2;
    var mx = Math.max(barX, Math.min(barX + barW - mSz / 2, barX + fillW - mSz / 2));
    var my = barY - mSz - 4 - Math.abs(Math.sin(ui.t * 0.25)) * 3;
    ctx.save();
    ctx.globalAlpha = 0.9;
    R.drawSpr(CHAR_KEYS[(idx + 1) % CHAR_KEYS.length], mx, my, mSz, mSz);
    ctx.restore();

    // --- TIP line ------------------------------------------------------------
    R.text(TIPS[ui.tipIdx], W / 2, barY + barH + Math.max(20, H * 0.04),
      '500 ' + Math.max(11, Math.round(H * 0.019)) + 'px Arial',
      'rgba(200,214,226,0.75)', 'center');

    // --- footer strip: quiet system note, lowest in hierarchy ----------------
    R.text('LOADING — BALANCE DATA · VISION · PATHING · STRUCTURES · ALIGNMENT',
      W / 2, H - Math.max(14, H * 0.028),
      '500 ' + Math.max(9, Math.round(H * 0.015)) + 'px Arial',
      'rgba(150,168,182,0.55)', 'center');

    // --- vignette for focus ----------------------------------------------------
    ctx.save();
    var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // --- interactive control: SKIP / DEPLOY (proper button API) -----------------
    var btnW = Math.max(96, Math.round(W * 0.14));
    var btnH = Math.max(34, Math.round(H * 0.06));
    var label = ui.progress >= 100 ? 'DEPLOY \u25B8' : 'SKIP \u25B8';
    R.addBtn(W - btnW - 16, H - btnH - 16, btnW, btnH, label, function () {
      if (!ui.went) { ui.went = true; leave(); }
    });

    R.drawBtns();
  };
};
})();