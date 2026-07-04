(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.Play = function (state, config, game) {
  return function () {
    R.clearBtns();
    var W = R.W, H = R.H;

    // Backdrop (real staged image when present)
    R.drawBg(state.cfg && state.cfg.asset, '#12202a');

    // Animated scene tick (deterministic, frame-driven)
    if (game && typeof game._playTick !== 'number') game._playTick = 0;
    if (game) game._playTick++;
    var t = game ? game._playTick : 0;

    // Top-down battlefield scene art behind everything
    R.drawSpr('4typeoftopdownviewofcomi', 0, H * 0.14, W, H * 0.46);

    // Ambient inviting overlay pulse
    R.ctx.save();
    var pulse = 0.10 + 0.06 * Math.sin(t * 0.05);
    R.ctx.fillStyle = 'rgba(10,20,32,' + pulse.toFixed(3) + ')';
    R.ctx.fillRect(0, 0, W, H);
    R.ctx.restore();

    // ---- Faction leaders parading (rotating variant frames per faction) ----
    // Each leader cycles through its chars_1..N variants for a lively animation.
    var factions = [
      { hero: 'chaplaingunnerruthbellam',
        frames: ['chars_1_chaplain', 'chars_2_chaplain', 'chars_3_chaplain'] },
      { hero: 'mothersporeilyaleaderoft',
        frames: ['chars_1_mother', 'chars_2_mother', 'chars_3_mother',
                 'chars_4_mother', 'chars_5_mother', 'chars_6_mother'] },
      { hero: 'tidepriestessmarenaleade',
        frames: ['chars_1_tide', 'chars_2_tide', 'chars_3_tide'] },
      { hero: 'envoylyra9theleaderofthe',
        frames: [] }
    ];

    var slot = W / factions.length;
    var spriteW = slot * 0.60;
    var spriteH = H * 0.30;
    var baseY = H * 0.20;

    for (var i = 0; i < factions.length; i++) {
      var f = factions[i];
      var cx = slot * i + slot / 2 - spriteW / 2;
      var bob = Math.sin(t * 0.06 + i * 1.3) * (H * 0.02);
      // choose animated variant frame if available, else hero portrait
      var key = f.hero;
      if (f.frames.length) {
        var idx = Math.floor(t / 20 + i) % f.frames.length;
        key = f.frames[idx];
      }
      R.drawSpr(key, cx, baseY + bob, spriteW, spriteH);
    }

    // ---- Foreground terrain / building tiles swaying in ----
    var tiles = [
      'topdownviewof4typesofsep',
      'art17top', 'art23top', 'art29top', 'art34top', 'art8top'
    ];
    var tileW = W / tiles.length;
    var tileH = H * 0.14;
    var tileY = H * 0.62;
    for (var j = 0; j < tiles.length; j++) {
      var sway = Math.sin(t * 0.04 + j) * (H * 0.008);
      R.drawSpr(tiles[j], tileW * j, tileY + sway, tileW * 0.94, tileH);
    }

    // ---- Title banner ----
    R.ctx.save();
    R.ctx.globalAlpha = 0.55;
    R.roundRect(W / 2 - 190, H * 0.03, 380, 72, 14);
    R.ctx.fillStyle = '#0a1620';
    R.ctx.fill();
    R.ctx.restore();
    R.text('BULWARK', W / 2, H * 0.07, 'bold 42px sans-serif', '#e8d9a0', 'center');
    R.text('Day Battle · Day Build — scout, fortify, defend',
      W / 2, H * 0.11, '15px sans-serif', '#a9c4d4', 'center');

    // ---- Controls: clear primary/secondary hierarchy ----
    var btnW = Math.min(340, W - 80);
    var btnX = (W - btnW) / 2;
    var btnH = 64;
    var gap = 20;
    var playY = H - 210;
    var gearY = playY + btnH + gap;

    // Primary — PLAY GAME (emphasized)
    R.addBtn(btnX, playY, btnW, btnH, 'PLAY GAME', function () {
      R.go((state.next && state.next.scr_u4678ee) || 'scr_u4678ee');
    }, { primary: true, fill: '#3a7d44', color: '#ffffff' });

    // Secondary — CHOOSE GEAR
    R.addBtn(btnX, gearY, btnW, btnH, 'CHOOSE GEAR', function () {
      R.go((state.next && state.next.scr_zc7dhlv) || 'scr_zc7dhlv');
    }, { fill: '#2a5f7d', color: '#ffffff' });

    R.drawBtns();

    // Corner back/return hint to declared transition-out screen
    R.addBtn(16, 16, 96, 40, '‹ BACK', function () {
      R.go((state.next && state.next.scr_29xml07) || 'scr_29xml07');
    }, { fill: '#1a2c38', color: '#a9c4d4' });
    R.drawBtns();
  };
};
})();