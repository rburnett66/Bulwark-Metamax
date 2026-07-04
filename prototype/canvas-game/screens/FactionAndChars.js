(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.FactionAndChars = function (state, config, game) {
  return function () {
    R.clearBtns();
    R.drawBg(state.cfg && state.cfg.asset);

    var W = R.W, H = R.H;

    // Dim overlay for legibility
    R.ctx.save();
    R.ctx.fillStyle = 'rgba(8,12,20,0.58)';
    R.ctx.fillRect(0, 0, W, H);
    R.ctx.restore();

    // ---- Title band ----
    R.ctx.save();
    R.ctx.fillStyle = 'rgba(10,16,26,0.85)';
    R.roundRect(W * 0.5 - 300, 20, 600, 68, 12);
    R.ctx.fill();
    R.ctx.restore();
    R.text('FACTION AND CHARS', W * 0.5, 54, 'bold 34px sans-serif', '#ffd873', 'center');
    R.text('Leaders across the alignment spectrum', W * 0.5, 78, '15px sans-serif', '#cfe0f2', 'center');

    // ---- Faction leader cards ----
    var leaders = [
      { key: 'chaplaingunnerruthbellam', name: 'Ruth Bellamy', role: 'Chaplain Gunner', tint: '#c94f4f',
        tiers: ['chars_1_chaplain', 'chars_2_chaplain', 'chars_3_chaplain'] },
      { key: 'mothersporeilyaleaderoft', name: 'Mother Spore Ilya', role: 'Green Insurgents', tint: '#5fbf6a',
        tiers: ['chars_1_mother', 'chars_2_mother', 'chars_3_mother', 'chars_4_mother', 'chars_5_mother', 'chars_6_mother'] },
      { key: 'tidepriestessmarenaleade', name: 'Priestess Marena', role: 'Water Tide', tint: '#4f8fc9',
        tiers: ['chars_1_tide', 'chars_2_tide', 'chars_3_tide'] },
      { key: 'envoylyra9theleaderofthe', name: 'Envoy Lyra-9', role: 'Space Tech', tint: '#9a7fd6',
        tiers: [] }
    ];

    var margin = 34;
    var gap = 20;
    var cardsTop = 104;
    var cols = leaders.length;
    var cardW = (W - margin * 2 - gap * (cols - 1)) / cols;
    var cardH = Math.min(cardW * 1.28, H * 0.46);

    for (var i = 0; i < cols; i++) {
      var L = leaders[i];
      var cx = margin + i * (cardW + gap);

      // Card panel
      R.ctx.save();
      R.ctx.fillStyle = 'rgba(14,20,32,0.9)';
      R.roundRect(cx, cardsTop, cardW, cardH, 14);
      R.ctx.fill();
      R.ctx.lineWidth = 3;
      R.ctx.strokeStyle = L.tint;
      R.roundRect(cx, cardsTop, cardW, cardH, 14);
      R.ctx.stroke();
      R.ctx.restore();

      // Portrait
      var padX = 12;
      var portTop = cardsTop + 12;
      var portW = cardW - padX * 2;
      var portH = cardH * 0.60;
      R.drawSpr(L.key, cx + padX, portTop, portW, portH);

      // Accent bar
      R.ctx.save();
      R.ctx.fillStyle = L.tint;
      R.ctx.fillRect(cx + padX, portTop + portH + 6, portW, 4);
      R.ctx.restore();

      // Name + role
      R.text(L.name, cx + cardW / 2, portTop + portH + 30, 'bold 18px sans-serif', '#ffffff', 'center');
      R.text(L.role, cx + cardW / 2, portTop + portH + 52, '13px sans-serif', '#a8bcd0', 'center');

      // Unit tier chips (character variant sprites)
      var chipRowY = portTop + portH + 62;
      var tiers = L.tiers;
      if (tiers.length) {
        var maxChips = Math.min(tiers.length, 6);
        var chipGap = 4;
        var availW = cardW - padX * 2;
        var chipS = Math.min(28, (availW - chipGap * (maxChips - 1)) / maxChips);
        var rowW = maxChips * chipS + (maxChips - 1) * chipGap;
        var chipX0 = cx + (cardW - rowW) / 2;
        for (var t = 0; t < maxChips; t++) {
          var chX = chipX0 + t * (chipS + chipGap);
          R.ctx.save();
          R.ctx.fillStyle = 'rgba(0,0,0,0.4)';
          R.roundRect(chX, chipRowY, chipS, chipS, 5);
          R.ctx.fill();
          R.ctx.restore();
          R.drawSpr(tiers[t], chX + 2, chipRowY + 2, chipS - 4, chipS - 4);
        }
      }
    }

    // ---- Top-down unit / structure reference strip ----
    var stripY = cardsTop + cardH + 24;
    R.text('TOP-DOWN UNITS & STRUCTURES', W / 2, stripY - 6, 'bold 15px sans-serif', '#c7d6ec', 'center');

    var chars = [
      '4typeoftopdownviewofcomi', 'art8top', 'art17top', 'art23top', 'art29top', 'art34top',
      'topdownviewof4typesofsep', 'sheet'
    ];
    var sGap = 10;
    var sW = Math.min(96, (W - margin * 2 - sGap * (chars.length - 1)) / chars.length);
    var sTotal = chars.length * sW + (chars.length - 1) * sGap;
    var sStart = (W - sTotal) / 2;
    var sTop = stripY + 6;

    for (var j = 0; j < chars.length; j++) {
      var sx = sStart + j * (sW + sGap);
      R.ctx.save();
      R.ctx.fillStyle = 'rgba(16,24,38,0.72)';
      R.roundRect(sx, sTop, sW, sW, 8);
      R.ctx.fill();
      R.ctx.lineWidth = 1;
      R.ctx.strokeStyle = 'rgba(120,160,210,0.4)';
      R.ctx.stroke();
      R.ctx.restore();
      R.drawSpr(chars[j], sx + 5, sTop + 5, sW - 10, sW - 10);
    }

    // ---- RETURN to MENU ----
    var btnW = 300, btnH = 56;
    var btnX = W * 0.5 - btnW / 2;
    var btnY = H - btnH - 22;

    R.addBtn(btnX, btnY, btnW, btnH, 'RETURN to MENU', function () {
      R.go(state.next && state.next.scr_ab5f1vj ? state.next.scr_ab5f1vj : 'scr_ab5f1vj');
    }, { bg: '#ffd873', fg: '#1a1206', font: 'bold 22px sans-serif', r: 12 });

    R.drawBtns();
  };
};
})();