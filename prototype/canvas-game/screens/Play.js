(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
/* MMKit screen module — PLAY (BULWARK)
   Merged best-of: layered sprite diorama (terrain art pack), fortress + marching
   units + defensive fire animation, clear control hierarchy:
   primary PLAY GAME, secondary CHOOSE GEAR. */
MMKit.screens.Play = function (state, config, game) {

  // ---------- navigation target resolution (state.next is authoritative) ----------
  function resolveTarget(frag, fallback) {
    var n = state && state.next, list = [], k;
    if (typeof n === 'string') list.push(n);
    else if (n && typeof n.length === 'number') { for (k = 0; k < n.length; k++) list.push(n[k]); }
    else if (n && typeof n === 'object') {
      for (k in n) {
        if (Object.prototype.hasOwnProperty.call(n, k)) { list.push(k); list.push(n[k]); }
      }
    }
    for (k = 0; k < list.length; k++) {
      var s = list[k];
      if (s && typeof s === 'object') s = s.target || s.id || s.name || s.screen || '';
      s = String(s);
      if (s.indexOf(frag) >= 0) return s;
    }
    return fallback;
  }
  function goPlayGame()   { R.go(resolveTarget('u4678ee', 'scr_u4678ee')); } // Animate an inviting game scene
  function goChooseGear() { R.go(resolveTarget('zc7dhlv', 'scr_zc7dhlv')); } // Display gear & loadout

  // ---------- one-time deterministic scene setup (closure-scoped) ----------
  var t = 0, i;

  var clouds = [];
  for (i = 0; i < 5; i++) {
    clouds.push({
      x: R.rand(), y: 0.06 + R.rand() * 0.20,
      s: 0.55 + R.rand() * 0.8,
      v: 0.00018 + R.rand() * 0.00030
    });
  }

  var birds = [];
  for (i = 0; i < 3; i++) {
    birds.push({ x: R.rand(), y: 0.10 + R.rand() * 0.14, v: 0.0009 + R.rand() * 0.0006, ph: R.rand() * 6.28 });
  }

  // marching wave (units path toward the base)
  var units = [];
  for (i = 0; i < 8; i++) {
    units.push({
      off: R.rand(),
      lane: i % 3,                       // 0 far, 2 near
      type: (R.rand() < 0.45) ? 'tank' : 'troop',
      sp: 0.0009 + R.rand() * 0.0007,
      ph: R.rand() * 6.283,
      scale: 0.85 + R.rand() * 0.35
    });
  }

  var shells = [];
  var flash = 0;

  // ---------- helpers ----------
  function rrPath(ctx, x, y, w, h, r) {
    if (r > w / 2) r = w / 2;
    if (r > h / 2) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawTank(ctx, x, y, s, ph) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = '#1d2b35';
    ctx.beginPath();
    ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.lineTo(13, 6); ctx.lineTo(-13, 6);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(-13, -6, 26, 6);
    var rec = Math.sin(t * 0.08 + ph) * 0.8;
    ctx.fillRect(-6, -12, 12, 6);
    ctx.fillRect(6, -11, 14 + rec, 2.5);
    ctx.fillStyle = '#101b22';
    for (var w = -10; w <= 10; w += 5) {
      ctx.beginPath(); ctx.arc(w, 3, 2, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  }

  function drawTroop(ctx, x, y, s, ph) {
    var bob = Math.sin(t * 0.22 + ph) * 1.4;
    var leg = Math.sin(t * 0.22 + ph);
    ctx.save();
    ctx.translate(x, y + bob * 0.4);
    ctx.scale(s, s);
    ctx.strokeStyle = '#1d2b35';
    ctx.fillStyle = '#1d2b35';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(0, -13, 2.6, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, -3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-2, -8); ctx.lineTo(7, -10); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -3); ctx.lineTo(3 * leg, 3);
    ctx.moveTo(0, -3); ctx.lineTo(-3 * leg, 3);
    ctx.stroke();
    ctx.restore();
  }

  // draws the BULWARK fortress; returns turret muzzle point
  function drawFortress(ctx, bx, groundY, scale) {
    ctx.save();
    ctx.translate(bx, groundY);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#16242e';
    ctx.fillRect(0, -46, 120, 46);                                  // wall
    for (var c = 0; c < 6; c++) ctx.fillRect(4 + c * 20, -54, 10, 8); // crenellations
    ctx.fillRect(42, -92, 36, 46);                                  // main tower
    ctx.fillRect(38, -98, 44, 8);
    ctx.fillRect(6, -66, 20, 20);                                   // side turret
    ctx.save();
    ctx.translate(12, -62);
    ctx.rotate(-0.55 + Math.sin(t * 0.02) * 0.06);
    ctx.fillRect(0, -2, 26, 4);                                     // barrel
    ctx.restore();
    // flag mast + waving amber flag
    ctx.strokeStyle = '#16242e';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(60, -98); ctx.lineTo(60, -122); ctx.stroke();
    var wv = Math.sin(t * 0.12) * 3;
    ctx.fillStyle = '#ffb22c';
    ctx.beginPath();
    ctx.moveTo(60, -122);
    ctx.quadraticCurveTo(72, -122 + wv, 84, -118 + wv);
    ctx.lineTo(84, -111 + wv);
    ctx.quadraticCurveTo(72, -115 + wv, 60, -112);
    ctx.closePath(); ctx.fill();
    // window glows
    ctx.fillStyle = 'rgba(255,181,69,0.75)';
    ctx.fillRect(54, -82, 5, 7);
    ctx.fillRect(64, -82, 5, 7);
    ctx.restore();
    return { x: bx + 12 * scale, y: groundY - 62 * scale };
  }

  // ---------- per-frame render ----------
  return function () {
    t++;
    R.clearBtns();
    R.drawBg(state.cfg && state.cfg.asset);

    var W = R.W, H = R.H, ctx = R.ctx;

    // readability scrim over backdrop
    ctx.fillStyle = 'rgba(6,12,20,0.45)';
    ctx.fillRect(0, 0, W, H);

    // ---------- header ----------
    var titleFs = Math.max(22, Math.round(H * 0.052));
    R.text('BULWARK', W / 2, H * 0.072, '900 ' + titleFs + 'px sans-serif', '#eef6fc', 'center');
    R.text('SCOUT  \u00B7  FORTIFY  \u00B7  DEFEND',
      W / 2, H * 0.072 + titleFs * 0.72,
      '600 ' + Math.max(10, Math.round(H * 0.018)) + 'px sans-serif', '#93aec2', 'center');
    // amber rule
    ctx.fillStyle = '#ffb22c';
    ctx.fillRect(W / 2 - 70, H * 0.072 + titleFs * 1.05, 140, 3);

    // HUD chips (read-only shared state)
    var day = (game && game.day != null) ? game.day : 1;
    var gold = (game && game.gold != null) ? game.gold : (game && game.score != null ? game.score : 0);
    var chipH = Math.max(20, H * 0.036), chipW = Math.max(74, W * 0.13);
    var chipY = H * 0.024, chipFs = Math.max(10, Math.round(chipH * 0.5));
    ctx.fillStyle = 'rgba(14,24,36,0.82)';
    rrPath(ctx, 12, chipY, chipW, chipH, chipH / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(139,197,255,0.45)'; ctx.lineWidth = 1; ctx.stroke();
    R.text('DAY ' + day, 12 + chipW / 2, chipY + chipH * 0.68, 'bold ' + chipFs + 'px sans-serif', '#a9d4ff', 'center');
    ctx.fillStyle = 'rgba(14,24,36,0.82)';
    rrPath(ctx, W - chipW - 12, chipY, chipW, chipH, chipH / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,102,0.5)'; ctx.stroke();
    R.text('\u25C6 ' + gold, W - chipW / 2 - 12, chipY + chipH * 0.68, 'bold ' + chipFs + 'px sans-serif', '#ffd666', 'center');

    // ---------- animated diorama panel (the inviting game scene) ----------
    var px = Math.round(W * 0.06), py = Math.round(H * 0.155);
    var pw = Math.round(W * 0.88), ph = Math.round(H * 0.46);

    ctx.fillStyle = 'rgba(10,18,28,0.9)';
    rrPath(ctx, px - 5, py - 5, pw + 10, ph + 10, 16); ctx.fill();
    ctx.strokeStyle = 'rgba(255,178,44,0.45)'; ctx.lineWidth = 2; ctx.stroke();

    ctx.save();
    rrPath(ctx, px, py, pw, ph, 12);
    ctx.clip();

    // sky gradient (dawn deployment light)
    var sky = ctx.createLinearGradient(0, py, 0, py + ph);
    sky.addColorStop(0, '#12263c');
    sky.addColorStop(0.45, '#2c5474');
    sky.addColorStop(0.72, '#c98a4e');
    sky.addColorStop(1, '#5c4630');
    ctx.fillStyle = sky;
    ctx.fillRect(px, py, pw, ph);

    var horizon = py + ph * 0.58;

    // sun with pulsing halo
    var sunX = px + pw * 0.24, sunY = py + ph * 0.30 + Math.sin(t * 0.008) * 4;
    var sr = ph * 0.075 + Math.sin(t * 0.05) * 1.5;
    var halo = ctx.createRadialGradient(sunX, sunY, sr * 0.3, sunX, sunY, sr * 3.2);
    halo.addColorStop(0, 'rgba(255,224,150,0.55)');
    halo.addColorStop(1, 'rgba(255,224,150,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(sunX, sunY, sr * 3.2, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#ffe9ae';
    ctx.beginPath(); ctx.arc(sunX, sunY, sr, 0, 6.2832); ctx.fill();

    // drifting clouds
    var c, cx, cy, cw, chh;
    for (i = 0; i < clouds.length; i++) {
      c = clouds[i];
      cx = px + (((c.x + t * c.v) % 1.15) - 0.075) * pw;
      cy = py + c.y * ph;
      cw = pw * 0.17 * c.s; chh = ph * 0.05 * c.s;
      ctx.fillStyle = 'rgba(235,242,248,0.30)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw * 0.5, chh * 0.5, 0, 0, 6.2832);
      ctx.ellipse(cx - cw * 0.28, cy + chh * 0.18, cw * 0.32, chh * 0.38, 0, 0, 6.2832);
      ctx.ellipse(cx + cw * 0.30, cy + chh * 0.15, cw * 0.34, chh * 0.40, 0, 0, 6.2832);
      ctx.fill();
    }

    // birds
    for (i = 0; i < birds.length; i++) {
      var b = birds[i];
      var bx = px + (((b.x + t * b.v) % 1.1) - 0.05) * pw;
      var by = py + b.y * ph + Math.sin(t * 0.06 + b.ph) * 3;
      var flap = Math.sin(t * 0.25 + b.ph) * 3;
      ctx.strokeStyle = 'rgba(20,28,36,0.75)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx - 5, by - flap); ctx.lineTo(bx, by); ctx.lineTo(bx + 5, by - flap);
      ctx.stroke();
    }

    // far ocean band (parallax-tiled sprite art)
    var oceanH = ph * 0.10, tileW = pw / 4, x0;
    var yOc = horizon - oceanH * 0.55 + Math.sin(t * 0.02) * 1.2;
    var scroll = ((t * 0.12) % tileW + tileW) % tileW;
    for (x0 = -scroll - tileW; x0 < pw + tileW; x0 += tileW) {
      R.drawSpr('art_1_ocean', px + x0, yOc, tileW + 1, oceanH);
    }
    // near ocean band, faster + counter-bob
    var oceanH2 = ph * 0.085;
    var yOc2 = horizon - oceanH2 * 0.15 + Math.sin(t * 0.02 + 2.1) * 1.6;
    var scroll2 = ((t * 0.28) % tileW + tileW) % tileW;
    for (x0 = scroll2 - tileW * 2; x0 < pw + tileW; x0 += tileW) {
      R.drawSpr('art_2_ocean', px + x0, yOc2, tileW + 1, oceanH2);
    }

    // ground plane
    var grd = ctx.createLinearGradient(0, horizon, 0, py + ph);
    grd.addColorStop(0, '#4d5f3a');
    grd.addColorStop(1, '#2c3a24');
    ctx.fillStyle = grd;
    ctx.fillRect(px, horizon, pw, py + ph - horizon);

    // distant treeline + grass strips (sprite art)
    var treeH = ph * 0.16, treeW = pw / 5;
    for (x0 = 0; x0 < pw; x0 += treeW) {
      R.drawSpr('art_3_trees', px + x0, horizon - treeH * 0.85, treeW + 1, treeH);
    }
    var gH = ph * 0.09;
    for (x0 = 0; x0 < pw; x0 += treeW) {
      R.drawSpr('art_3_grass', px + x0, horizon - gH * 0.25, treeW + 1, gH);
    }

    // landmark terrain features
    R.drawSpr('art_2_rocks', px + pw * 0.07, horizon + ph * 0.05, pw * 0.13, ph * 0.11);
    R.drawSpr('art_1_palm', px + pw * 0.30, horizon - ph * 0.24, pw * 0.07, ph * 0.28);
    R.drawSpr('art_1_tall', px + pw * 0.46 + Math.sin(t * 0.02) * 1.2, horizon - ph * 0.30, pw * 0.075, ph * 0.34);

    // foreground grass tufts along the bottom edge
    var fgH = ph * 0.10;
    for (x0 = 0; x0 < pw; x0 += treeW * 0.8) {
      R.drawSpr((((x0 / (treeW * 0.8)) | 0) % 2) ? 'art_4_grass' : 'art_2_grass',
        px + x0, py + ph - fgH * 0.85, treeW * 0.8 + 1, fgH);
    }
    R.drawSpr('art_1_grass', px + pw * 0.62, py + ph - fgH, treeW * 0.9, fgH);

    // ---------- THE BULWARK (right-side fortress) ----------
    var fortScale = ph / 220;
    var groundLine = py + ph * 0.86;
    var muzzle = drawFortress(ctx, px + pw * 0.78, groundLine, fortScale);

    // ---------- marching units advancing toward the base ----------
    var laneY = [horizon + ph * 0.10, horizon + ph * 0.18, horizon + ph * 0.27];
    var laneS = [0.7, 0.9, 1.1];
    var marchEnd = pw * 0.70;
    for (i = 0; i < units.length; i++) {
      var u = units[i];
      var prog = ((t * u.sp) + u.off) % 1;
      var ux = px + pw * 0.03 + prog * marchEnd;
      var uy = laneY[u.lane];
      var s = u.scale * laneS[u.lane] * fortScale * 1.6;
      var fade = prog > 0.92 ? (1 - prog) / 0.08 : (prog < 0.05 ? prog / 0.05 : 1);
      ctx.globalAlpha = Math.max(0, Math.min(1, fade));
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.beginPath();
      ctx.ellipse(ux, uy + 5 * s, 12 * s, 2.5 * s, 0, 0, 6.2832);
      ctx.fill();
      if (u.type === 'tank') drawTank(ctx, ux, uy, s, u.ph);
      else drawTroop(ctx, ux, uy, s, u.ph);
      ctx.globalAlpha = 1;
    }

    // ---------- defensive artillery: shells on a cadence ----------
    if (t % 105 === 30) {
      var tgtLane = laneY[(t / 105 | 0) % 3];
      shells.push({
        x0: muzzle.x, y0: muzzle.y,
        x1: px + pw * (0.15 + R.rand() * 0.45),
        y1: tgtLane,
        p: 0, dur: 55
      });
      flash = 5;
    }
    if (flash > 0) {
      flash--;
      ctx.fillStyle = 'rgba(255,220,140,' + (flash / 5 * 0.9).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(muzzle.x - 14, muzzle.y - 8, 5 + flash, 0, 6.2832); ctx.fill();
    }
    var keep = [];
    for (i = 0; i < shells.length; i++) {
      var sh = shells[i];
      sh.p++;
      var f = sh.p / sh.dur;
      if (f <= 1) {
        var sx = sh.x0 + (sh.x1 - sh.x0) * f;
        var sy = sh.y0 + (sh.y1 - sh.y0) * f - Math.sin(f * Math.PI) * ph * 0.28;
        ctx.fillStyle = '#ffd666';
        ctx.beginPath(); ctx.arc(sx, sy, 2.5, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = 'rgba(255,214,102,0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(sx - 6, sy + 2); ctx.lineTo(sx, sy); ctx.stroke();
        keep.push(sh);
      } else if (f <= 1.3) {
        // impact burst
        var bf = (f - 1) / 0.3;
        ctx.fillStyle = 'rgba(255,150,60,' + (0.8 * (1 - bf)).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(sh.x1, sh.y1, 4 + bf * 14, 0, 6.2832); ctx.fill();
        keep.push(sh);
      }
    }
    shells = keep;

    ctx.restore(); // end diorama clip

    // caption strip under the diorama
    R.text('THE FRONT IS HOLDING \u2014 FOR NOW. TAKE COMMAND.',
      W / 2, py + ph + Math.max(16, H * 0.028),
      '600 ' + Math.max(10, Math.round(H * 0.019)) + 'px sans-serif', '#9fb0c4', 'center');

    // ---------- controls (exact spec: PLAY GAME primary, CHOOSE GEAR secondary) ----------
    var btnW = Math.min(Math.round(W * 0.6), 420);
    var btnH = Math.max(52, Math.round(H * 0.085));
    var btnX = Math.round((W - btnW) / 2);
    var primaryY = py + ph + Math.round(H * 0.055);
    var gap = Math.round(btnH * 0.35);
    var secondH = Math.round(btnH * 0.78);
    var secondW = Math.round(btnW * 0.86);
    var secondX = Math.round((W - secondW) / 2);
    var secondY = primaryY + btnH + gap;

    // primary glow pulse behind PLAY GAME
    var pulse = 0.5 + 0.5 * Math.sin(t * 0.09);
    ctx.fillStyle = 'rgba(255,178,44,' + (0.10 + 0.14 * pulse).toFixed(3) + ')';
    rrPath(ctx, btnX - 6, primaryY - 6, btnW + 12, btnH + 12, 16);
    ctx.fill();

    R.addBtn(btnX, primaryY, btnW, btnH, 'PLAY GAME', goPlayGame, {
      primary: true,
      bg: '#ffb22c', color: '#141c26', fill: '#ffb22c',
      font: 'bold ' + Math.max(16, Math.round(btnH * 0.4)) + 'px sans-serif'
    });

    R.addBtn(secondX, secondY, secondW, secondH, 'CHOOSE GEAR', goChooseGear, {
      primary: false,
      bg: 'rgba(20,30,42,0.9)', color: '#e8eef6', border: '#7e93aa',
      font: 'bold ' + Math.max(13, Math.round(secondH * 0.38)) + 'px sans-serif'
    });

    R.drawBtns();
  };
};
})();