(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.ViewReplays = function (state, config, game) {
  return function () {
    R.clearBtns();
    R.drawBg(state.cfg && state.cfg.asset);

    var W = R.W, H = R.H;
    var next = state.next || {};

    // Resolve navigation targets per control (fall back to declared out-transition)
    var fallback = next.scr_ab5f1vj || 'scr_ab5f1vj';
    function resolve(key) {
      return next[key] || fallback;
    }

    // Dim overlay for legibility
    R.ctx.save();
    R.ctx.fillStyle = 'rgba(8,14,22,0.58)';
    R.ctx.fillRect(0, 0, W, H);
    R.ctx.restore();

    // ---- Title banner ----
    R.ctx.save();
    R.ctx.fillStyle = 'rgba(18,30,44,0.85)';
    R.roundRect(W * 0.5 - 250, 22, 500, 70, 12);
    R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(120,180,220,0.7)';
    R.ctx.lineWidth = 2;
    R.roundRect(W * 0.5 - 250, 22, 500, 70, 12);
    R.ctx.stroke();
    R.ctx.restore();

    R.text('VIEW REPLAYS', W * 0.5, 58, 'bold 34px sans-serif', '#e8f2ff', 'center');
    R.text('BULWARK — recorded engagements', W * 0.5, 82, '15px sans-serif', '#9fb4c8', 'center');

    // ---- Replay stills (top-down battle art) ----
    var stills = ['art17top', 'art23top', 'art29top', 'art34top'];
    var thumbW = 150, thumbH = 94, gap = 22;
    var totalW = stills.length * thumbW + (stills.length - 1) * gap;
    var startX = W * 0.5 - totalW / 2;
    var stillY = 108;
    for (var i = 0; i < stills.length; i++) {
      var sx = startX + i * (thumbW + gap);
      R.ctx.save();
      R.ctx.fillStyle = 'rgba(10,16,26,0.7)';
      R.roundRect(sx - 4, stillY - 4, thumbW + 8, thumbH + 8, 8);
      R.ctx.fill();
      R.ctx.strokeStyle = 'rgba(90,140,180,0.6)';
      R.ctx.lineWidth = 1.5;
      R.roundRect(sx - 4, stillY - 4, thumbW + 8, thumbH + 8, 8);
      R.ctx.stroke();
      R.ctx.restore();
      R.drawSpr(stills[i], sx, stillY, thumbW, thumbH);
      // frame index label
      R.text('REPLAY ' + (i + 1), sx + thumbW / 2, stillY + thumbH - 8, 'bold 12px sans-serif', '#cfe2f2', 'center');
    }

    // ---- Faction leader portrait strip ----
    var portraits = [
      'chaplaingunnerruthbellam',
      'mothersporeilyaleaderoft',
      'tidepriestessmarenaleade',
      'envoylyra9theleaderofthe'
    ];
    var pW = 96, pH = 96, pgap = 16;
    var ptotal = portraits.length * pW + (portraits.length - 1) * pgap;
    var pStartX = W * 0.5 - ptotal / 2;
    var pY = stillY + thumbH + 18;
    for (var p = 0; p < portraits.length; p++) {
      var px = pStartX + p * (pW + pgap);
      R.ctx.save();
      R.ctx.strokeStyle = 'rgba(120,180,220,0.5)';
      R.ctx.lineWidth = 1.5;
      R.roundRect(px - 3, pY - 3, pW + 6, pH + 6, 8);
      R.ctx.stroke();
      R.ctx.restore();
      R.drawSpr(portraits[p], px, pY, pW, pH);
    }

    // ---- Navigation menu (2 columns) ----
    var controls = [
      { label: 'CHOOSE CHARACTER', target: resolve('CHOOSE CHARACTER') },
      { label: 'PLAY', target: resolve('PLAY') },
      { label: 'STORE', target: resolve('STORE') },
      { label: 'INVENTORY', target: resolve('INVENTORY') },
      { label: 'SETTINGS', target: resolve('SETTINGS') },
      { label: 'LEADERBOARD', target: resolve('LEADERBOARD') }
    ];

    var colCount = 2;
    var btnW = 300, btnH = 46, vgap = 14, colGap = 30;
    var blockW = colCount * btnW + (colCount - 1) * colGap;
    var bx0 = W * 0.5 - blockW / 2;
    var by0 = pY + pH + 26;

    // clamp to bottom
    var rows = Math.ceil(controls.length / colCount);
    var blockH = rows * btnH + (rows - 1) * vgap;
    if (by0 + blockH > H - 20) by0 = H - 20 - blockH;

    for (var c = 0; c < controls.length; c++) {
      var col = c % colCount;
      var row = Math.floor(c / colCount);
      var bx = bx0 + col * (btnW + colGap);
      var by = by0 + row * (btnH + vgap);
      (function (target) {
        R.addBtn(bx, by, btnW, btnH, controls[c].label, function () {
          R.go(target);
        }, { fill: '#26405f', text: '#e8f0ff', font: 'bold 17px sans-serif' });
      })(controls[c].target);
    }

    R.drawBtns();
  };
};
})();