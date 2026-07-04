(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.Help = function (state, config, game) {
  return function () {
    R.clearBtns();
    R.drawBg(state.cfg && state.cfg.asset, '#0e1420');

    var W = R.W, H = R.H, cx = W / 2;

    // Dim overlay for readability
    R.ctx.save();
    R.ctx.fillStyle = 'rgba(6,12,20,0.62)';
    R.ctx.fillRect(0, 0, W, H);
    R.ctx.restore();

    // Title block
    R.text('HELP', cx, H * 0.10, 'bold ' + Math.round(H * 0.072) + 'px sans-serif', '#ffd24a', 'center');
    R.text('BULWARK — Field Manual', cx, H * 0.155, Math.round(H * 0.028) + 'px sans-serif', '#8fb8d8', 'center');

    // Decorative divider
    R.ctx.save();
    R.ctx.strokeStyle = 'rgba(255,210,74,0.5)';
    R.ctx.lineWidth = 2;
    R.ctx.beginPath();
    R.ctx.moveTo(W * 0.28, H * 0.185);
    R.ctx.lineTo(W * 0.72, H * 0.185);
    R.ctx.stroke();
    R.ctx.restore();

    // ---- Guides panel (four faction leaders) ----
    var panelW = W * 0.82, panelH = H * 0.30;
    var panelX = cx - panelW / 2, panelY = H * 0.21;
    R.ctx.save();
    R.ctx.fillStyle = 'rgba(14,26,40,0.72)';
    R.roundRect(panelX, panelY, panelW, panelH, 14);
    R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(120,170,210,0.5)';
    R.ctx.lineWidth = 2;
    R.roundRect(panelX, panelY, panelW, panelH, 14);
    R.ctx.stroke();
    R.ctx.restore();

    var guides = [
      { key: 'chaplaingunnerruthbellam', name: 'RUTH BELLAMY' },
      { key: 'mothersporeilyaleaderoft', name: 'MOTHER SPORE ILYA' },
      { key: 'tidepriestessmarenaleade', name: 'PRIESTESS MAREN' },
      { key: 'envoylyra9theleaderofthe', name: 'ENVOY LYRA-9' }
    ];
    var n = guides.length;
    var gGap = panelW * 0.04;
    var portW = (panelW - gGap * (n + 1)) / n;
    var portH = panelH * 0.74;
    var py = panelY + (panelH - portH) / 2 - H * 0.008;
    for (var i = 0; i < n; i++) {
      var gx = panelX + gGap + i * (portW + gGap);
      R.drawSpr(guides[i].key, gx, py, portW, portH);
      R.text(guides[i].name, gx + portW / 2, py + portH + H * 0.028,
        Math.round(H * 0.019) + 'px sans-serif', '#cfe4f5', 'center');
    }

    // ---- Tactical map strip (top-down build/terrain art) ----
    var stripKeys = ['art8top', 'art17top', 'art23top', 'art29top', 'art34top'];
    var stripY = H * 0.535;
    var stripH = H * 0.08;
    var sGap = W * 0.015;
    var sTotal = W * 0.72;
    var sw = (sTotal - sGap * (stripKeys.length - 1)) / stripKeys.length;
    var strX = cx - sTotal / 2;
    R.text('THE BATTLEFIELD', cx, stripY - H * 0.018,
      Math.round(H * 0.02) + 'px sans-serif', '#8fb8d8', 'center');
    for (var j = 0; j < stripKeys.length; j++) {
      R.drawSpr(stripKeys[j], strX + j * (sw + sGap), stripY, sw, stripH);
    }

    // ---- Controls ----
    var next = state.next || {};
    var target = next.scr_ab5f1vj || 'scr_ab5f1vj';

    var bw = Math.min(W * 0.6, 460), bh = Math.max(48, H * 0.075);
    var bx = cx - bw / 2;
    var startY = H * 0.66;
    var spacing = bh + H * 0.02;

    var primaryOpts = {
      bg: '#ffd24a', fg: '#1a1206', fill: '#ffd24a', text: '#1a1206',
      border: 'rgba(255,210,74,0.9)', radius: 12,
      font: 'bold ' + Math.round(bh * 0.36) + 'px sans-serif'
    };
    var secOpts = {
      bg: 'rgba(38,80,110,0.94)', fg: '#eaf4ff', fill: '#26506e', text: '#eaf4ff',
      border: 'rgba(140,190,230,0.8)', radius: 12,
      font: 'bold ' + Math.round(bh * 0.32) + 'px sans-serif'
    };

    // ASK A GUIDE — always enabled
    R.addBtn(bx, startY, bw, bh, 'ASK A GUIDE', function () {
      R.go(target);
    }, primaryOpts);

    // HOW TO PLAY (Basics) — always enabled
    R.addBtn(bx, startY + spacing, bw, bh, 'HOW TO PLAY: BASICS', function () {
      R.go(target);
    }, secOpts);

    // HOW TO PLAY (Advanced) — always enabled
    R.addBtn(bx, startY + spacing * 2, bw, bh, 'HOW TO PLAY: ADVANCED', function () {
      R.go(target);
    }, secOpts);

    R.drawBtns();
  };
};
})();