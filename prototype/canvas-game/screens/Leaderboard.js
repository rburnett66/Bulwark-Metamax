(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.Leaderboard = function (state, config, game) {
  return function () {
    R.clearBtns();
    R.drawBg(state.cfg && state.cfg.asset);

    var W = R.W, H = R.H;
    var cx = W / 2;

    // ---- dim overlay for readability ----
    R.ctx.save();
    R.ctx.fillStyle = 'rgba(6,10,18,0.60)';
    R.ctx.fillRect(0, 0, W, H);
    R.ctx.restore();

    // ---- Title ----
    R.text('LEADERBOARD', cx, H * 0.095, 'bold ' + Math.round(H * 0.062) + 'px sans-serif', '#ffd76b', 'center');
    R.text('TOP COMMANDERS OF BULWARK', cx, H * 0.15, Math.round(H * 0.024) + 'px sans-serif', '#9fc9ff', 'center');

    // ---- data ----
    var entries = (game && game.leaderboard) || [
      { name: 'MOTHER SPORE ILYA',   spr: 'mothersporeilyaleaderoft', score: 128400 },
      { name: 'CHAPLAIN RUTH BELLAMY', spr: 'chaplaingunnerruthbellam', score: 114950 },
      { name: 'TIDE PRIESTESS MAREN', spr: 'tidepriestessmarenaleade', score: 101200 },
      { name: 'ENVOY LYRA-9',         spr: 'envoylyra9theleaderofthe', score: 92750 },
      { name: 'CMDR HELIOS',          spr: '4typeoftopdownviewofcomi', score: 80100 },
      { name: 'CMDR VANTA',           spr: 'art17top', score: 69100 },
      { name: 'CMDR ORRIN',           spr: 'art23top', score: 61870 },
      { name: 'CMDR SELE',            spr: 'art29top', score: 55240 }
    ];

    // ---- list panel ----
    var listX = W * 0.13;
    var listW = W * 0.74;
    var startY = H * 0.205;
    var footerH = H * 0.13;
    var availH = H * 0.985 - startY - footerH;
    var rowCount = entries.length;
    var rowGap = H * 0.012;
    var rowH = (availH - rowGap * (rowCount - 1)) / rowCount;

    // Panel backdrop
    R.ctx.save();
    R.roundRect(listX - W * 0.02, startY - H * 0.02, listW + W * 0.04, availH + H * 0.04, 16);
    R.ctx.fillStyle = 'rgba(10,16,28,0.72)';
    R.ctx.fill();
    R.ctx.lineWidth = 2;
    R.ctx.strokeStyle = 'rgba(120,150,200,0.35)';
    R.ctx.stroke();
    R.ctx.restore();

    var medal = ['#ffd76b', '#c8d2e0', '#d19a5b'];

    for (var i = 0; i < rowCount; i++) {
      var e = entries[i];
      var y = startY + i * (rowH + rowGap);
      var isTop = i < 3;

      // Row panel
      R.ctx.save();
      R.roundRect(listX, y, listW, rowH, rowH * 0.16);
      R.ctx.fillStyle = i === 0 ? 'rgba(58,48,20,0.82)'
        : (isTop ? 'rgba(40,52,72,0.70)' : (i % 2 === 0 ? 'rgba(24,32,46,0.62)' : 'rgba(18,26,40,0.62)'));
      R.ctx.fill();
      R.ctx.lineWidth = 2;
      R.ctx.strokeStyle = isTop ? (medal[i] || '#7f93b8') : 'rgba(120,160,210,0.35)';
      R.ctx.stroke();
      R.ctx.restore();

      var rankCol = isTop ? medal[i] : '#9aa8bc';

      // Rank
      R.text('#' + (i + 1), listX + rowH * 0.55, y + rowH * 0.62,
        'bold ' + Math.round(rowH * 0.40) + 'px sans-serif', rankCol, 'center');

      // Portrait sprite
      var pSize = rowH * 0.80;
      var px = listX + rowH * 1.05;
      var py = y + (rowH - pSize) / 2;
      R.ctx.save();
      R.roundRect(px, py, pSize, pSize, pSize * 0.14);
      R.ctx.clip();
      R.drawSpr(e.spr, px, py, pSize, pSize);
      R.ctx.restore();

      // Name + label
      var textX = px + pSize + rowH * 0.28;
      R.text(e.name, textX, y + rowH * 0.44,
        'bold ' + Math.round(rowH * 0.27) + 'px sans-serif', '#eef2f7', 'left');
      R.text('SCORE', textX, y + rowH * 0.74,
        Math.round(rowH * 0.18) + 'px sans-serif', '#8fb2d8', 'left');

      // Score value
      R.text(e.score.toLocaleString(), listX + listW - rowH * 0.4, y + rowH * 0.60,
        'bold ' + Math.round(rowH * 0.34) + 'px sans-serif', rankCol, 'right');
    }

    // ---- Controls ----
    var btnW = Math.min(W * 0.36, 300);
    var btnH = Math.min(H * 0.09, 60);
    var gap = W * 0.03;
    var totalW = btnW * 2 + gap;
    var bx = (W - totalW) / 2;
    var by = H * 0.90;

    var next = state.next || {};
    var tCharacter = next.character || next.choose || next.chooseCharacter || next[0] || 'scr_ab5f1vj';
    var tMenu = next.menu || next.back || next[1] || 'scr_ab5f1vj';

    R.addBtn(bx, by, btnW, btnH, 'CHOOSE CHARACTER', function () {
      R.go(tCharacter);
    }, { fill: '#2b6cb0', text: '#ffffff', color: '#ffffff', border: '#5b9bd8' });

    R.addBtn(bx + btnW + gap, by, btnW, btnH, 'GO TO MENU', function () {
      R.go(tMenu);
    }, { fill: '#c8622b', text: '#fff3e0', color: '#fff3e0', border: '#ffab6b' });

    R.drawBtns();
  };
};
})();