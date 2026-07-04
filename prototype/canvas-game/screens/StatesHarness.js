(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.StatesHarness = function (state, config, game) {
  // UI-scoped selection index (persist across frames)
  if (typeof game.__sh_sel !== 'number') game.__sh_sel = 0;
  if (typeof game.__sh_frame !== 'number') game.__sh_frame = 0;

  return function () {
    R.clearBtns();
    R.drawBg(state.cfg && state.cfg.asset);

    var W = R.W, H = R.H;
    game.__sh_frame++;

    // Dim overlay for legibility
    R.ctx.save();
    R.ctx.fillStyle = 'rgba(6,10,18,0.58)';
    R.ctx.fillRect(0, 0, W, H);
    R.ctx.restore();

    // ---- Header band ----
    var headH = Math.round(H * 0.14);
    R.ctx.save();
    R.ctx.fillStyle = 'rgba(14,20,32,0.88)';
    R.ctx.fillRect(0, 0, W, headH);
    R.ctx.fillStyle = 'rgba(90,150,220,0.9)';
    R.ctx.fillRect(0, headH - 3, W, 3);
    R.ctx.restore();

    R.text('STATES HARNESS', W / 2, headH * 0.42,
      'bold ' + Math.round(H * 0.05) + 'px sans-serif', '#eaf2ff', 'center');
    R.text('BULWARK — faction leader state preview', W / 2, headH * 0.78,
      Math.round(H * 0.024) + 'px sans-serif', '#9fb4d6', 'center');

    // ---- Faction / leader roster ----
    // Each leader: hero portrait key + cycling animation frames (chars_*)
    var leaders = [
      { key: 'chaplaingunnerruthbellam', name: 'Ruth Bellamy', role: 'Chaplain-Gunner',
        frames: ['chars_1_chaplain', 'chars_2_chaplain', 'chars_3_chaplain'] },
      { key: 'envoylyra9theleaderofthe', name: 'Lyra-9', role: 'Envoy',
        frames: ['chars_1_tide', 'chars_2_tide', 'chars_3_tide'] },
      { key: 'mothersporeilyaleaderoft', name: 'Ilya', role: 'Mother Spore',
        frames: ['chars_1_mother', 'chars_2_mother', 'chars_3_mother', 'chars_4_mother', 'chars_5_mother', 'chars_6_mother'] },
      { key: 'tidepriestessmarenaleade', name: 'Marena', role: 'Tide Priestess',
        frames: ['chars_1_tide', 'chars_2_tide', 'chars_3_tide'] }
    ];

    var sel = game.__sh_sel % leaders.length;
    var cur = leaders[sel];

    // ---- Roster selector row (top-down leader thumbnails) ----
    var margin = W * 0.06;
    var gap = W * 0.02;
    var cols = leaders.length;
    var thumbW = (W - margin * 2 - gap * (cols - 1)) / cols;
    var thumbH = thumbW * 0.9;
    var rowY = headH + H * 0.03;

    for (var i = 0; i < cols; i++) {
      (function (idx) {
        var x = margin + idx * (thumbW + gap);
        var active = (idx === sel);

        R.ctx.save();
        R.ctx.fillStyle = active ? 'rgba(40,70,120,0.92)' : 'rgba(18,26,42,0.82)';
        R.roundRect(x, rowY, thumbW, thumbH, 10);
        R.ctx.fill();
        R.ctx.lineWidth = active ? 3 : 1.5;
        R.ctx.strokeStyle = active ? 'rgba(150,200,255,0.95)' : 'rgba(100,140,200,0.45)';
        R.roundRect(x, rowY, thumbW, thumbH, 10);
        R.ctx.stroke();
        R.ctx.restore();

        var pad = thumbW * 0.10;
        var portrait = thumbH * 0.60;
        R.drawSpr(leaders[idx].key, x + (thumbW - portrait) / 2, rowY + pad * 0.6, portrait, portrait);

        R.text(leaders[idx].name, x + thumbW / 2, rowY + thumbH - thumbH * 0.14,
          'bold ' + Math.round(H * 0.02) + 'px sans-serif',
          active ? '#eaf2ff' : '#b8c8e0', 'center');

        R.addBtn(x, rowY, thumbW, thumbH, '', function () {
          game.__sh_sel = idx;
        }, { fill: 'rgba(0,0,0,0)' });
      })(i);
    }

    // ---- Central detail card: animated char frames of selected leader ----
    var cardW = Math.min(W * 0.82, 640);
    var cardH = H * 0.30;
    var cardX = (W - cardW) / 2;
    var cardY = rowY + thumbH + H * 0.035;

    R.ctx.save();
    R.ctx.fillStyle = 'rgba(20,28,44,0.92)';
    R.roundRect(cardX, cardY, cardW, cardH, 14);
    R.ctx.fill();
    R.ctx.lineWidth = 2;
    R.ctx.strokeStyle = 'rgba(120,160,220,0.55)';
    R.roundRect(cardX, cardY, cardW, cardH, 14);
    R.ctx.stroke();
    R.ctx.restore();

    // Big portrait on left
    var bp = cardH * 0.80;
    var bpX = cardX + cardW * 0.05;
    var bpY = cardY + (cardH - bp) / 2;
    R.drawSpr(cur.key, bpX, bpY, bp, bp);

    // Animated char state frame (cycles ~every 30 frames)
    var frameIdx = Math.floor(game.__sh_frame / 30) % cur.frames.length;
    var animKey = cur.frames[frameIdx];
    var animW = cardH * 0.55;
    var animX = cardX + cardW * 0.50;
    var animY = cardY + (cardH - animW) / 2;
    R.ctx.save();
    R.ctx.strokeStyle = 'rgba(90,150,220,0.5)';
    R.ctx.lineWidth = 1.5;
    R.roundRect(animX - 4, animY - 4, animW + 8, animW + 8, 8);
    R.ctx.stroke();
    R.ctx.restore();
    R.drawSpr(animKey, animX, animY, animW, animW);

    // Info text
    var infoX = bpX + bp + cardW * 0.04;
    R.text(cur.name, infoX, cardY + cardH * 0.28,
      'bold ' + Math.round(H * 0.032) + 'px sans-serif', '#eaf2ff', 'left');
    R.text(cur.role, infoX, cardY + cardH * 0.44,
      Math.round(H * 0.024) + 'px sans-serif', '#9fb4d6', 'left');
    R.text('STATE ' + (frameIdx + 1) + '/' + cur.frames.length, infoX, cardY + cardH * 0.62,
      Math.round(H * 0.02) + 'px sans-serif', '#7fa8d8', 'left');
    R.text('anim: ' + animKey, infoX, cardY + cardH * 0.76,
      Math.round(H * 0.018) + 'px sans-serif', '#c9d8ee', 'left');

    // ---- Terrain / top-down reference strip ----
    var stripY = cardY + cardH + H * 0.03;
    R.text('TERRAIN & TOP-DOWN TILES', W / 2, stripY,
      'bold ' + Math.round(H * 0.02) + 'px sans-serif', '#9fb4d6', 'center');

    var tiles = [
      '4typeoftopdownviewofcomi',
      'topdownviewof4typesofsep',
      'art8top',
      'art17top',
      'art23top',
      'art29top',
      'art34top',
      'sheet'
    ];
    var tGap = W * 0.012;
    var tCols = tiles.length;
    var tileW = (W - margin * 2 - tGap * (tCols - 1)) / tCols;
    var tileH = tileW;
    var tY = stripY + H * 0.015;

    R.ctx.save();
    for (var j = 0; j < tCols; j++) {
      var tx = margin + j * (tileW + tGap);
      R.ctx.strokeStyle = 'rgba(100,140,200,0.4)';
      R.ctx.lineWidth = 1.5;
      R.roundRect(tx, tY, tileW, tileH, 6);
      R.ctx.stroke();
      R.drawSpr(tiles[j], tx + 2, tY + 2, tileW - 4, tileH - 4);
    }
    R.ctx.restore();

    // ---- Bottom controls ----
    var nextTarget = (state.next && (state.next.scr_er2mf9n ||
      state.next[Object.keys(state.next)[0]])) || 'scr_er2mf9n';

    var bH = Math.round(H * 0.09);
    var bY = H - bH - H * 0.025;
    var navW = Math.min(W * 0.14, 120);

    // Prev leader
    R.addBtn(margin, bY, navW, bH, '\u25C0 PREV', function () {
      game.__sh_sel = (sel - 1 + leaders.length) % leaders.length;
    }, { fill: '#2a4a7a', color: '#eaf2ff' });

    // Next leader
    R.addBtn(W - margin - navW, bY, navW, bH, 'NEXT \u25B6', function () {
      game.__sh_sel = (sel + 1) % leaders.length;
    }, { fill: '#2a4a7a', color: '#eaf2ff' });

    // Continue -> transition target
    var contW = Math.min(W * 0.34, 340);
    R.addBtn((W - contW) / 2, bY, contW, bH, 'CONTINUE', function () {
      R.go(nextTarget);
    }, { primary: true, fill: '#3a78c8', color: '#ffffff',
         font: 'bold ' + Math.round(H * 0.034) + 'px sans-serif' });

    R.drawBtns();
  };
};
})();