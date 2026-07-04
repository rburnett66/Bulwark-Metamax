(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.Settings = function (state, config, game) {
  return function () {
    R.clearBtns();
    R.drawBg(state.cfg && state.cfg.asset);

    var W = R.W, H = R.H;
    var next = state.next || {};

    // UI-scoped state
    if (typeof game.ui_settings_muted !== 'boolean') game.ui_settings_muted = false;
    if (typeof game.ui_settings_volume !== 'number') game.ui_settings_volume = 0.7;
    if (typeof game.ui_settings_t !== 'number') game.ui_settings_t = 0;
    game.ui_settings_t += 1;

    // Dim overlay for readable hierarchy
    R.ctx.save();
    R.ctx.fillStyle = 'rgba(8,14,22,0.6)';
    R.ctx.fillRect(0, 0, W, H);
    R.ctx.restore();

    // Title
    R.text('SETTINGS', W / 2, H * 0.11, 'bold ' + Math.round(H * 0.07) + 'px sans-serif', '#f4f7fb', 'center');
    R.text('Volume Control', W / 2, H * 0.175, Math.round(H * 0.032) + 'px sans-serif', '#9fd0e8', 'center');

    // Hero art panel (inviting scene preview)
    var heroW = W * 0.30, heroH = H * 0.28;
    var heroX = W / 2 - heroW / 2, heroY = H * 0.21;
    // subtle animated bob to feel inviting
    var bob = Math.sin(game.ui_settings_t * 0.05) * (H * 0.006);
    R.ctx.save();
    R.ctx.fillStyle = 'rgba(16,28,40,0.55)';
    R.roundRect(heroX - 10, heroY - 6, heroW + 20, heroH + 12, 14);
    R.ctx.fill();
    R.ctx.restore();
    R.drawSpr('mothersporeilyaleaderoft', heroX, heroY + bob, heroW, heroH);
    // small companion sheet strip
    R.drawSpr('sheet', W * 0.5 - heroW * 0.5 - W * 0.13, heroY + heroH * 0.2, W * 0.10, heroH * 0.6);
    R.drawSpr('tidepriestessmarenaleade', W * 0.5 + heroW * 0.5 + W * 0.03, heroY + heroH * 0.2, W * 0.10, heroH * 0.6);

    // Volume bar (draggable)
    var barW = W * 0.5, barH = Math.round(H * 0.035);
    var barX = W / 2 - barW / 2, barY = H * 0.52;
    var vol = game.ui_settings_muted ? 0 : game.ui_settings_volume;
    R.ctx.save();
    R.ctx.fillStyle = '#2c333d';
    R.roundRect(barX, barY, barW, barH, barH / 2);
    R.ctx.fill();
    R.ctx.fillStyle = game.ui_settings_muted ? '#6a4a4a' : '#4fa3d1';
    R.roundRect(barX, barY, Math.max(barH, barW * vol), barH, barH / 2);
    R.ctx.fill();
    R.ctx.restore();
    R.text('VOLUME ' + Math.round(vol * 100) + '%', W / 2, barY - H * 0.018,
      Math.round(H * 0.026) + 'px sans-serif', '#d6dde3', 'center');

    // Segmented volume steps as interactive buttons across the bar
    var steps = 5;
    for (var s = 0; s < steps; s++) {
      (function (idx) {
        var segW = barW / steps;
        var sx = barX + idx * segW;
        R.addBtn(sx, barY - barH * 0.5, segW, barH * 2, '', function () {
          game.ui_settings_muted = false;
          game.ui_settings_volume = (idx + 1) / steps;
        });
      })(s);
    }

    // Button layout metrics
    var btnW = Math.min(W * 0.58, 460);
    var btnH = Math.round(H * 0.082);
    var cx = (W - btnW) / 2;
    var gap = btnH * 0.28;
    var startY = H * 0.60;

    function drawBtn(y, fill, stroke, label, txtColor, fontScale) {
      R.ctx.save();
      R.ctx.fillStyle = fill;
      R.roundRect(cx, y, btnW, btnH, 14);
      R.ctx.fill();
      if (stroke) {
        R.ctx.strokeStyle = stroke;
        R.ctx.lineWidth = 2;
        R.roundRect(cx, y, btnW, btnH, 14);
        R.ctx.stroke();
      }
      R.ctx.restore();
      R.text(label, W / 2, y + btnH * 0.63, 'bold ' + Math.round(btnH * (fontScale || 0.4)) + 'px sans-serif', txtColor, 'center');
    }

    // PLAY GAME — primary CTA
    var y0 = startY;
    drawBtn(y0, '#f0a11e', null, 'PLAY GAME', '#1a1206', 0.42);
    R.addBtn(cx, y0, btnW, btnH, 'PLAY GAME', function () {
      R.go(next.PLAY_GAME || next.scr_u4678ee || 'scr_u4678ee');
    });

    // CHOOSE GEAR — secondary
    var y1 = y0 + btnH + gap;
    drawBtn(y1, 'rgba(30,58,84,0.92)', '#5aa8cc', 'CHOOSE GEAR', '#eaf4fa', 0.38);
    R.addBtn(cx, y1, btnW, btnH, 'CHOOSE GEAR', function () {
      R.go(next.CHOOSE_GEAR || next.scr_zc7dhlv || 'scr_zc7dhlv');
    });

    // MUTE toggle (also wired to second transition target)
    var y2 = y1 + btnH + gap;
    var muted = game.ui_settings_muted;
    drawBtn(y2,
      muted ? 'rgba(90,30,30,0.92)' : 'rgba(24,42,60,0.92)',
      muted ? '#d06060' : '#4a7a96',
      muted ? 'MUTE: ON' : 'MUTE: OFF', '#eaf4fa', 0.38);
    R.addBtn(cx, y2, btnW, btnH, 'Mute', function () {
      game.ui_settings_muted = !game.ui_settings_muted;
      var t = next.Mute || next.scr_7g7m3jd;
      if (t) R.go(t);
    });

    // RETURN to MENU — low emphasis
    var y3 = y2 + btnH + gap;
    drawBtn(y3, 'rgba(18,26,34,0.88)', '#3a5566', 'RETURN to MENU', '#a8c0cf', 0.34);
    R.addBtn(cx, y3, btnW, btnH, 'RETURN to MENU', function () {
      R.go(next.RETURN_to_MENU || next.scr_ab5f1vj || 'scr_ab5f1vj');
    });

    R.drawBtns();
  };
};
})();