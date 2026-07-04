(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.Inventory = function (state, config, game) {
  return function () {
    R.clearBtns();
    R.drawBg(state.cfg && state.cfg.asset, '#0d1420');

    var W = R.W, H = R.H;

    // Dim overlay for readability
    R.ctx.save();
    R.ctx.fillStyle = 'rgba(8,14,24,0.55)';
    R.ctx.fillRect(0, 0, W, H);
    R.ctx.restore();

    // Header band
    var headerH = Math.round(H * 0.15);
    R.ctx.save();
    R.ctx.fillStyle = 'rgba(16,28,44,0.92)';
    R.ctx.fillRect(0, 0, W, headerH);
    R.ctx.fillStyle = '#3a6ea5';
    R.ctx.fillRect(0, headerH - 4, W, 4);
    R.ctx.restore();

    R.text('INVENTORY', Math.round(W * 0.5), Math.round(headerH * 0.42),
      'bold ' + Math.round(H * 0.06) + 'px sans-serif', '#eaf2ff', 'center');
    R.text('BULWARK — Deployed Roster & Stores', Math.round(W * 0.5), Math.round(headerH * 0.76),
      Math.round(H * 0.024) + 'px sans-serif', '#9fb8d6', 'center');

    // Inventory slots: leaders, artillery, structures/assets
    var slots = [
      { key: 'chaplaingunnerruthbellam', label: 'Chaplain Bellamy' },
      { key: 'envoylyra9theleaderofthe', label: 'Envoy Lyra-9' },
      { key: 'mothersporeilyaleaderoft', label: 'Mother Spore' },
      { key: 'tidepriestessmarenaleade', label: 'Tide Priestess' },
      { key: 'art8top', label: 'Unit A-8' },
      { key: 'art17top', label: 'Unit A-17' },
      { key: 'art23top', label: 'Unit A-23' },
      { key: 'art29top', label: 'Unit A-29' },
      { key: 'art34top', label: 'Unit A-34' },
      { key: 'topdownviewof4typesofsep', label: 'Structures' },
      { key: '4typeoftopdownviewofcomi', label: 'Assets' },
      { key: 'sheet', label: 'Sheet' }
    ];

    // Content grid area
    var gridTop = headerH + Math.round(H * 0.035);
    var gridBottom = H - Math.round(H * 0.155);
    var pad = Math.round(W * 0.05);
    var cols = 4, rows = 3;
    var gap = Math.round(W * 0.02);
    var cellW = (W - pad * 2 - gap * (cols - 1)) / cols;
    var cellH = (gridBottom - gridTop - gap * (rows - 1)) / rows;

    for (var i = 0; i < slots.length; i++) {
      var c = i % cols, r = Math.floor(i / cols);
      var x = pad + c * (cellW + gap);
      var y = gridTop + r * (cellH + gap);

      R.ctx.save();
      R.ctx.fillStyle = 'rgba(20,34,52,0.85)';
      R.roundRect(x, y, cellW, cellH, 8);
      R.ctx.fill();
      R.ctx.strokeStyle = 'rgba(90,140,200,0.5)';
      R.ctx.lineWidth = 1.5;
      R.roundRect(x, y, cellW, cellH, 8);
      R.ctx.stroke();
      R.ctx.restore();

      var sprPad = Math.round(cellW * 0.12);
      var sprW = cellW - sprPad * 2;
      var labelH = Math.round(cellH * 0.20);
      var sprH = cellH - sprPad * 2 - labelH;
      R.drawSpr(slots[i].key, x + sprPad, y + sprPad, sprW, sprH);

      R.text(slots[i].label, Math.round(x + cellW / 2),
        Math.round(y + cellH - cellH * 0.11),
        Math.round(cellH * 0.11) + 'px sans-serif', '#cfe0f5', 'center');
    }

    // Primary action: RETURN to MENU
    var btnW = Math.round(W * 0.42);
    var btnH = Math.round(H * 0.1);
    var btnX = Math.round((W - btnW) / 2);
    var btnY = H - Math.round(H * 0.125);

    R.addBtn(btnX, btnY, btnW, btnH, 'RETURN to MENU', function () {
      R.go((state.next && state.next.scr_ab5f1vj) || 'scr_ab5f1vj');
    }, { bg: '#3a6ea5', fg: '#ffffff', radius: 10, font: 'bold ' + Math.round(H * 0.036) + 'px sans-serif' });

    R.drawBtns();
  };
};
})();