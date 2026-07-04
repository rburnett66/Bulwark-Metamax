(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.Store = function (state, config, game) {
  return function () {
    R.clearBtns();
    R.drawBg(state.cfg && state.cfg.asset, '#0d1420');

    var W = R.W, H = R.H;

    // Dim overlay for readability
    R.ctx.save();
    R.ctx.globalAlpha = 0.58;
    R.ctx.fillStyle = '#08101c';
    R.ctx.fillRect(0, 0, W, H);
    R.ctx.restore();

    var nav = function () {
      R.go(state.next && state.next.scr_ab5f1vj ? state.next.scr_ab5f1vj : 'scr_ab5f1vj');
    };

    // ---- Header band ----
    var bandW = Math.min(W * 0.9, 620);
    var bandX = W / 2 - bandW / 2;
    var bandH = Math.max(66, H * 0.12);
    R.ctx.save();
    R.ctx.fillStyle = 'rgba(16,28,48,0.9)';
    R.roundRect(bandX, 18, bandW, bandH, 14);
    R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(196,164,90,0.7)';
    R.ctx.lineWidth = 2;
    R.roundRect(bandX, 18, bandW, bandH, 14);
    R.ctx.stroke();
    R.ctx.restore();

    R.text('STORE', W / 2, 18 + bandH * 0.42, 'bold 42px sans-serif', '#ffd873', 'center');
    R.text('Requisition faction leaders, units & structures',
      W / 2, 18 + bandH * 0.8, '16px sans-serif', '#9fb4d0', 'center');

    var pad = 24;
    var contentX = pad;
    var contentW = W - pad * 2;
    var top = 18 + bandH + 26;
    var bottomBtnZone = 100;

    // ---- Faction leader offer cards ----
    var offers = [
      { key: 'chaplaingunnerruthbellam', name: 'Chaplain Ruth Bellamy' },
      { key: 'envoylyra9theleaderofthe', name: 'Envoy Lyra-9' },
      { key: 'mothersporeilyaleaderoft', name: 'Mother Spore Ilya' },
      { key: 'tidepriestessmarenaleade', name: 'Tide Priestess Marena' }
    ];
    var cols = offers.length;
    var gap = 16;
    var cardW = (contentW - gap * (cols - 1)) / cols;
    var availH = H - top - bottomBtnZone;
    var cardH = Math.min(availH * 0.56, 230);
    var startY = top;

    for (var i = 0; i < offers.length; i++) {
      var cx = contentX + i * (cardW + gap);
      R.ctx.save();
      R.ctx.fillStyle = '#13233a';
      R.roundRect(cx, startY, cardW, cardH, 12);
      R.ctx.fill();
      R.ctx.strokeStyle = '#2f5a86';
      R.ctx.lineWidth = 2;
      R.roundRect(cx, startY, cardW, cardH, 12);
      R.ctx.stroke();
      R.ctx.restore();

      var ip = 10;
      R.drawSpr(offers[i].key, cx + ip, startY + ip, cardW - ip * 2, cardH - 56);
      R.text(offers[i].name, cx + cardW / 2, startY + cardH - 34, 'bold 13px sans-serif', '#dbe8f7', 'center');
      R.text('— OWNED —', cx + cardW / 2, startY + cardH - 14, '12px sans-serif', '#8fa8c4', 'center');
    }

    // ---- Environment / structure tiles strip ----
    var tiles = [
      'topdownviewof4typesofsep',
      'art8top',
      'art17top',
      'art23top',
      'art29top',
      'art34top',
      'sheet',
      '4typeoftopdownviewofcomi'
    ];
    var stripLabelY = startY + cardH + 20;
    R.text('TERRAIN & STRUCTURES', W / 2, stripLabelY, 'bold 14px sans-serif', '#cbd6e2', 'center');

    var stripY = stripLabelY + 14;
    var tileH = Math.max(60, H - stripY - bottomBtnZone + 44);
    if (tileH > 110) tileH = 110;
    var tGap = 12;
    var tileW = (contentW - tGap * (tiles.length - 1)) / tiles.length;
    for (var t = 0; t < tiles.length; t++) {
      var tx = contentX + t * (tileW + tGap);
      R.ctx.save();
      R.ctx.fillStyle = '#0f1b2c';
      R.roundRect(tx, stripY, tileW, tileH, 8);
      R.ctx.fill();
      R.ctx.strokeStyle = 'rgba(120,160,220,0.3)';
      R.ctx.lineWidth = 1;
      R.roundRect(tx, stripY, tileW, tileH, 8);
      R.ctx.stroke();
      R.ctx.restore();
      R.drawSpr(tiles[t], tx + 4, stripY + 4, tileW - 8, tileH - 8);
    }

    // ---- RETURN to MENU (always enabled) ----
    var btnW = Math.min(W * 0.6, 320);
    var btnH = 56;
    var btnX = W / 2 - btnW / 2;
    var btnY = H - btnH - 28;
    R.addBtn(btnX, btnY, btnW, btnH, 'RETURN to MENU', nav,
      { bg: '#2f6fd0', color: '#ffffff', font: 'bold 22px sans-serif', r: 12 });

    R.drawBtns();
  };
};
})();