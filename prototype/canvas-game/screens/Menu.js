(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.Menu = function (state, config, game) {
  return function () {
    R.clearBtns();
    R.drawBg(state.cfg && state.cfg.asset, '#0d1420');

    var W = R.W, H = R.H;
    var next = state.next || {};

    // Dim overlay for legibility over backdrop art
    R.ctx.save();
    R.ctx.globalAlpha = 0.5;
    R.ctx.fillStyle = '#05080e';
    R.ctx.fillRect(0, 0, W, H);
    R.ctx.restore();

    // Title banner
    R.ctx.save();
    R.ctx.globalAlpha = 0.55;
    R.ctx.fillStyle = '#0c1119';
    R.roundRect(W * 0.5 - 280, 20, 560, 92, 14);
    R.ctx.fill();
    R.ctx.restore();

    R.text('BULWARK', W * 0.5, 66, 'bold 54px sans-serif', '#f4e6b8', 'center');
    R.text('SCOUT · FORTIFY · DEFEND', W * 0.5, 98, '16px sans-serif', '#9fb3c8', 'center');

    // Faction leader showcase strip
    var showcase = [
      'mothersporeilyaleaderoft',
      'chaplaingunnerruthbellam',
      'tidepriestessmarenaleade',
      'envoylyra9theleaderofthe'
    ];
    var sw = Math.min(112, W * 0.16);
    var sh = sw * 1.25;
    var gap = 16;
    var totalW = showcase.length * sw + (showcase.length - 1) * gap;
    var sx0 = W * 0.5 - totalW / 2;
    var sy = 126;
    for (var i = 0; i < showcase.length; i++) {
      var sx = sx0 + i * (sw + gap);
      R.ctx.save();
      R.ctx.globalAlpha = 0.85;
      R.ctx.fillStyle = '#10161f';
      R.roundRect(sx - 4, sy - 4, sw + 8, sh + 8, 8);
      R.ctx.fill();
      R.ctx.restore();
      R.drawSpr(showcase[i], sx, sy, sw, sh);
    }

    // Decorative top-down tile accents flanking the menu
    var tileW = 64, tileH = 64;
    var tileY = sy + sh + 24;
    R.drawSpr('4typeoftopdownviewofcomi', W * 0.5 - 200 - tileW, tileY, tileW, tileH);
    R.drawSpr('topdownviewof4typesofsep', W * 0.5 + 200, tileY, tileW, tileH);

    // Menu buttons — single clear vertical column, PLAY emphasized
    var controls = [
      { label: 'PLAY',             target: next.scr_u4678ee || 'scr_u4678ee', primary: true },
      { label: 'CHOOSE CHARACTER', target: next.scr_m8rpgxd || 'scr_m8rpgxd' },
      { label: 'STORE',            target: next.scr_rskt6dn || 'scr_rskt6dn' },
      { label: 'INVENTORY',        target: next.scr_ae09vxa || 'scr_ae09vxa' },
      { label: 'LEADERBOARD',      target: next.scr_wp1ium2 || 'scr_wp1ium2' },
      { label: 'SETTINGS',         target: (next.settings != null ? next.settings : '-') }
    ];

    var bw = Math.min(340, W * 0.6);
    var bh = 52;
    var bgap = 14;
    var startY = tileY + tileH + 24;
    var x = (W - bw) / 2;

    for (var j = 0; j < controls.length; j++) {
      var c = controls[j];
      var y = startY + j * (bh + bgap);
      (function (ctrl) {
        R.addBtn(x, y, bw, bh, ctrl.label, function () {
          // All controls enabledWhen=always
          var t = ctrl.target;
          if (t && t !== '-') R.go(t);
        }, { primary: !!ctrl.primary });
      })(c);
    }

    R.drawBtns();
  };
};
})();