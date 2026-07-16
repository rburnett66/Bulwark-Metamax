(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.Settings = function (state, config, game) {
  // ---- navigation resolver: targets come from state.next ----
  function resolve(id) {
    var n = state && state.next;
    if (!n) return id;
    if (typeof n === 'string') return n;
    if (Object.prototype.toString.call(n) === '[object Array]') {
      for (var i = 0; i < n.length; i++) if (n[i] === id) return id;
      return id;
    }
    if (typeof n === 'object') {
      if (n[id]) return n[id];
      for (var k in n) if (n[k] === id) return id;
    }
    return id;
  }
  var TGT_PLAY = 'scr_u4678ee';
  var TGT_GEAR = 'scr_zc7dhlv';
  var TGT_MENU = 'scr_ab5f1vj';

  function goPlay() { R.go(resolve(TGT_PLAY)); }
  function goGear() { R.go(resolve(TGT_GEAR)); }
  function goMenu() { R.go(resolve(TGT_MENU)); }

  // ---- UI-scoped state defaults ----
  if (typeof game.ui_volume !== 'number') game.ui_volume = 0.8;
  if (typeof game.ui_muted !== 'boolean') game.ui_muted = false;

  // ---- deterministic scene cache (built once with R.rand) ----
  if (!game.ui_settings_scene) {
    var tufts = [], clouds = [], units = [];
    for (var g = 0; g < 14; g++) tufts.push({ x: R.rand(), h: 3 + R.rand() * 5 });
    for (var c = 0; c < 3; c++) clouds.push({ x: R.rand(), y: 0.10 + R.rand() * 0.24, w: 0.12 + R.rand() * 0.1 });
    for (var u = 0; u < 4; u++) units.push({ off: R.rand() * 400, spd: 0.55 + R.rand() * 0.5, size: 7 + R.rand() * 4 });
    game.ui_settings_scene = { tufts: tufts, clouds: clouds, units: units };
  }

  // ---- controls ----
  var STEPS = 12;
  function volDown() {
    game.ui_volume = Math.max(0, Math.round(game.ui_volume * STEPS - 1) / STEPS);
  }
  function volUp() {
    game.ui_volume = Math.min(1, Math.round(game.ui_volume * STEPS + 1) / STEPS);
    if (game.ui_muted && game.ui_volume > 0) game.ui_muted = false;
  }
  // Mute: spec target is '-' (no-op navigation) — toggle mute state, remain on screen
  function doMute() {
    game.ui_muted = !game.ui_muted;
  }

  function panel(x, y, w, h, r, fill, stroke) {
    var ctx = R.ctx;
    ctx.save();
    ctx.fillStyle = fill;
    R.roundRect(x, y, w, h, r);
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      R.roundRect(x, y, w, h, r);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSpeaker(sx, sy, muted, t) {
    var ctx = R.ctx;
    ctx.save();
    ctx.fillStyle = muted ? '#6b4a44' : '#cfe3c8';
    ctx.fillRect(sx - 10, sy - 6, 8, 12);
    ctx.beginPath();
    ctx.moveTo(sx - 2, sy - 6); ctx.lineTo(sx + 8, sy - 14);
    ctx.lineTo(sx + 8, sy + 14); ctx.lineTo(sx - 2, sy + 6);
    ctx.closePath(); ctx.fill();
    if (muted) {
      ctx.strokeStyle = '#e0574a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx + 13, sy - 9); ctx.lineTo(sx + 27, sy + 9);
      ctx.moveTo(sx + 27, sy - 9); ctx.lineTo(sx + 13, sy + 9);
      ctx.stroke();
    } else {
      var pulse = 0.6 + 0.4 * Math.sin(t * 0.09);
      ctx.strokeStyle = 'rgba(207,227,200,' + (0.5 + 0.5 * pulse).toFixed(3) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx + 10, sy, 8, -0.9, 0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(sx + 10, sy, 13, -0.9, 0.9); ctx.stroke();
    }
    ctx.restore();
  }

  return function () {
    R.clearBtns();
    R.drawBg(state.cfg && state.cfg.asset, '#0a100c');

    var ctx = R.ctx, W = R.W, H = R.H, cx = W / 2;
    game.ui_settings_t = (game.ui_settings_t || 0) + 1;
    var t = game.ui_settings_t;
    var scene = game.ui_settings_scene;
    var muted = !!game.ui_muted;
    var vol = game.ui_volume;

    // ---- readability scrim (BULWARK dark steel/olive) ----
    ctx.save();
    var scrim = ctx.createLinearGradient(0, 0, 0, H);
    scrim.addColorStop(0, 'rgba(9,13,10,0.72)');
    scrim.addColorStop(0.5, 'rgba(9,13,10,0.55)');
    scrim.addColorStop(1, 'rgba(9,13,10,0.78)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // ================= HEADER =================
    var titleSize = Math.round(Math.min(36, H * 0.055));
    R.text('SETTINGS', cx, H * 0.06, 'bold ' + titleSize + 'px monospace', '#e8f0e4', 'center');
    R.text('— VOLUME CONTROL —', cx, H * 0.06 + titleSize * 0.8,
      Math.round(Math.min(14, H * 0.024)) + 'px monospace', '#8fae8c', 'center');

    var pw = Math.min(560, W * 0.88);
    var px = cx - pw / 2;

    // header rule
    ctx.save();
    ctx.strokeStyle = 'rgba(143,174,140,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, H * 0.06 + titleSize * 1.15);
    ctx.lineTo(px + pw, H * 0.06 + titleSize * 1.15);
    ctx.stroke();
    ctx.restore();

    // ================= VOLUME PANEL =================
    var vpy = H * 0.135, vph = Math.max(96, H * 0.175);
    panel(px, vpy, pw, vph, 10, 'rgba(18,26,20,0.92)',
      muted ? 'rgba(224,87,74,0.6)' : '#3d5a3f');
    R.text('MASTER VOLUME', px + 16, vpy + 20, 'bold 12px monospace', '#9fbf9a', 'left');

    // speaker icon
    var sx = px + 30, sy = vpy + 24 + (vph - 42) * 0.42;
    drawSpeaker(sx, sy, muted, t);

    // interactive slider: VOL− / VOL+ flank a segment meter
    var btnS = Math.max(34, Math.min(44, vph * 0.36));
    var meterX = px + 64 + btnS + 8;
    var meterW = pw - (meterX - px) - btnS - 96;
    var segN = STEPS, segW = meterW / segN - 4;
    var my = sy - 13;
    var lit = muted ? 0 : Math.round(vol * segN);

    R.addBtn(px + 58, sy - btnS / 2, btnS, btnS, '-', volDown);
    for (var s = 0; s < segN; s++) {
      var frac = s / (segN - 1);
      var col = frac < 0.6 ? '#5fae57' : (frac < 0.85 ? '#c9c355' : '#d8654f');
      var on = s < lit;
      ctx.save();
      ctx.globalAlpha = on ? (s === lit - 1 ? 0.7 + 0.3 * Math.sin(t * 0.15) : 1) : 0.18;
      ctx.fillStyle = on ? col : '#3a4a3a';
      ctx.fillRect(meterX + s * (segW + 4), my, segW, 26);
      ctx.restore();
    }
    if (muted) {
      ctx.save();
      ctx.strokeStyle = 'rgba(224,87,74,0.9)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(meterX, my + 28);
      ctx.lineTo(meterX + meterW - 4, my - 2);
      ctx.stroke();
      ctx.restore();
    }
    R.addBtn(meterX + meterW + 4, sy - btnS / 2, btnS, btnS, '+', volUp);

    // readout
    R.text(muted ? 'MUTED' : (Math.round(vol * 100) + '%'),
      meterX + meterW + btnS + 14, sy + 5, 'bold 15px monospace',
      muted ? '#e0574a' : '#e8f0e4', 'left');

    // status + Mute control ('-' target: no navigation, stays on screen)
    var statusTxt = muted ? 'AUDIO MUTED' : 'AUDIO ON — LEVEL ' + lit + '/' + segN;
    R.text(statusTxt, px + 16, vpy + vph - 16, 'bold 12px monospace',
      muted ? '#ff8d8d' : '#9fe8bd', 'left');
    var mbW = 84, mbH = 32;
    R.addBtn(px + pw - mbW - 12, vpy + vph - mbH - 8, mbW, mbH, 'Mute', doMute);

    // ================= ANIMATED INVITING SCENE (PLAY GAME) =================
    var spy = vpy + vph + H * 0.022, sph = Math.max(104, H * 0.21);
    panel(px, spy, pw, sph, 10, 'rgba(14,20,16,0.95)', '#3d5a3f');
    ctx.save();
    R.roundRect(px + 4, spy + 4, pw - 8, sph - 8, 8);
    ctx.clip();
    var ix = px + 4, iy = spy + 4, iw = pw - 8, ih = sph - 8;

    // dusk sky
    var sky = ctx.createLinearGradient(0, iy, 0, iy + ih);
    sky.addColorStop(0, '#20313f');
    sky.addColorStop(0.6, '#2c4250');
    sky.addColorStop(1, '#33453a');
    ctx.fillStyle = sky;
    ctx.fillRect(ix, iy, iw, ih);

    // pulsing sun with glow
    var sunX = ix + iw * 0.18, sunY = iy + ih * 0.26, sunR = ih * 0.11;
    ctx.save();
    var sunG = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 2.4);
    sunG.addColorStop(0, 'rgba(232,217,160,0.85)');
    sunG.addColorStop(1, 'rgba(232,217,160,0)');
    ctx.fillStyle = sunG;
    ctx.fillRect(ix, iy, iw, ih);
    ctx.globalAlpha = 0.85 + 0.15 * Math.sin(t * 0.03);
    ctx.fillStyle = '#e8d9a0';
    ctx.beginPath(); ctx.arc(sunX, sunY, sunR * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // drifting clouds
    ctx.save();
    ctx.fillStyle = 'rgba(220,230,225,0.22)';
    for (var ci = 0; ci < scene.clouds.length; ci++) {
      var cl = scene.clouds[ci];
      var cxp = ix + ((cl.x * iw + t * 0.25) % (iw + 80)) - 40;
      ctx.beginPath();
      ctx.ellipse(cxp, iy + cl.y * ih, cl.w * iw, ih * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // far hills
    ctx.fillStyle = '#25352c';
    ctx.beginPath();
    ctx.moveTo(ix, iy + ih * 0.6);
    ctx.quadraticCurveTo(ix + iw * 0.3, iy + ih * 0.44, ix + iw * 0.55, iy + ih * 0.58);
    ctx.quadraticCurveTo(ix + iw * 0.8, iy + ih * 0.7, ix + iw, iy + ih * 0.55);
    ctx.lineTo(ix + iw, iy + ih); ctx.lineTo(ix, iy + ih);
    ctx.closePath(); ctx.fill();

    // ground + grass tufts
    var gy = iy + ih * 0.66;
    ctx.fillStyle = '#3a4f33';
    ctx.fillRect(ix, gy, iw, ih);
    ctx.fillStyle = '#44603a';
    for (var ti = 0; ti < scene.tufts.length; ti++) {
      var tf = scene.tufts[ti];
      ctx.fillRect(ix + tf.x * iw, gy - tf.h, 3, tf.h);
    }

    // bulwark fortress tower (right)
    var twx = ix + iw * 0.85, twy = gy;
    ctx.fillStyle = '#5a6672';
    ctx.fillRect(twx - 14, twy - ih * 0.34, 28, ih * 0.34);
    ctx.fillStyle = '#77848f';
    ctx.fillRect(twx - 20, twy - ih * 0.42, 40, ih * 0.1);
    ctx.fillStyle = '#4a5560';
    for (var bt = 0; bt < 3; bt++) {
      ctx.fillRect(twx - 18 + bt * 14, twy - ih * 0.47, 8, ih * 0.05);
    }
    // waving banner
    ctx.fillStyle = '#b8563f';
    ctx.beginPath();
    ctx.moveTo(twx, twy - ih * 0.47);
    ctx.lineTo(twx, twy - ih * 0.61);
    ctx.lineTo(twx + 16 + 3 * Math.sin(t * 0.12), twy - ih * 0.57);
    ctx.lineTo(twx, twy - ih * 0.53);
    ctx.closePath(); ctx.fill();

    // marching units advancing toward the bulwark
    for (var ui2 = 0; ui2 < scene.units.length; ui2++) {
      var un = scene.units[ui2];
      var ux = ix + ((un.off + t * un.spd) % (iw * 0.72));
      var bob = Math.sin((t + un.off) * 0.25) * 1.5;
      var uy = gy + 6 + (ui2 % 2) * 8 + bob;
      ctx.fillStyle = '#25301f';
      ctx.fillRect(ux, uy - un.size, un.size * 1.4, un.size * 0.7);
      ctx.fillRect(ux + un.size * 0.4, uy - un.size * 1.4, un.size * 0.6, un.size * 0.5);
      ctx.fillRect(ux + un.size, uy - un.size * 1.2, un.size * 0.9, 2);
    }

    // tower muzzle flash + tracer
    if ((t % 52) < 6) {
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath(); ctx.arc(twx - 22, twy - ih * 0.38, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,224,138,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(twx - 24, twy - ih * 0.38);
      ctx.lineTo(twx - 24 - ((t % 52) * 24), twy - ih * 0.2);
      ctx.stroke();
    }
    ctx.restore();
    R.text('THE FRONT AWAITS — DEPLOY NOW', cx, spy + sph - 10, 'bold 12px monospace', '#c9d8c2', 'center');

    // ================= ACTION BUTTONS =================
    var bw = Math.min(250, (pw - 20) / 2);
    var bh = Math.max(44, Math.min(56, H * 0.075));
    var by = spy + sph + H * 0.028;

    // inviting glow behind PLAY GAME
    ctx.save();
    var glow = 0.10 + 0.12 * (0.5 + 0.5 * Math.sin(t * 0.08));
    ctx.fillStyle = 'rgba(198,232,120,' + glow.toFixed(3) + ')';
    R.roundRect(cx - bw - 16, by - 6, bw + 12, bh + 12, 10);
    ctx.fill();
    ctx.restore();

    R.addBtn(cx - bw - 10, by, bw, bh, 'PLAY GAME', goPlay);
    R.addBtn(cx + 10, by, bw, bh, 'CHOOSE GEAR', goGear);

    var rw = Math.min(300, pw * 0.6);
    R.addBtn(cx - rw / 2, by + bh + 12, rw, Math.max(40, bh * 0.9), 'RETURN to MENU', goMenu);

    R.text('BULWARK', px + pw - 4, Math.min(H - 10, by + bh + 12 + bh + 18),
      'bold 10px monospace', 'rgba(159,192,122,0.6)', 'right');

    R.drawBtns();
  };
};
})();