(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.LoadingScreen = function (state, config, game) {
  return function () {
    R.clearBtns();
    R.drawBg(state.cfg && state.cfg.asset, '#0a0e18');

    var W = R.W, H = R.H;
    var cx = W / 2;

    // ---- Progress state (deterministic, UI-scoped) ----
    if (typeof game._loadProgress !== 'number') game._loadProgress = 0;
    if (game._loadProgress < 1) {
      game._loadProgress = Math.min(1, game._loadProgress + 0.011 + R.rand() * 0.009);
    }
    var p = game._loadProgress;
    var ready = p >= 1;

    var target = (state.next && (state.next.scr_ab5f1vj ||
      (Object.keys(state.next).length ? state.next[Object.keys(state.next)[0]] : null))) || 'scr_ab5f1vj';

    // ---- Dim overlay for readability ----
    R.ctx.save();
    R.ctx.fillStyle = 'rgba(5,8,16,0.5)';
    R.ctx.fillRect(0, 0, W, H);
    R.ctx.restore();

    // ---- Background environment tile band (subtle, top-down world flavor) ----
    var envKeys = [
      'topdownviewof4typesofsep', // multiple staged variants share the sanitized key
      'art8top', 'art17top', 'art23top', 'art29top', 'art34top'
    ];
    var tW = Math.min(W * 0.14, 96);
    var tH = tW * 0.7;
    var tGap = 8;
    var tTotal = envKeys.length * tW + (envKeys.length - 1) * tGap;
    var tX = cx - tTotal / 2;
    var tY = H * 0.045;
    R.ctx.save();
    R.ctx.globalAlpha = 0.32;
    for (var e = 0; e < envKeys.length; e++) {
      R.drawSpr(envKeys[e], tX + e * (tW + tGap), tY, tW, tH);
    }
    R.ctx.restore();

    // ---- Central emblem art ----
    var artW = Math.min(W * 0.42, 300);
    var artH = artW * 0.6;
    var artX = cx - artW / 2;
    var artY = tY + tH + H * 0.02;
    R.drawSpr('4typeoftopdownviewofcomi', artX, artY, artW, artH);

    // sprite sheet reference (small corner detail)
    R.ctx.save();
    R.ctx.globalAlpha = 0.25;
    var shW = Math.min(W * 0.1, 64);
    R.drawSpr('sheet', W - shW - 12, H - shW - 12, shW, shW);
    R.ctx.restore();

    // ---- Title / brand ----
    R.text('BULWARK', cx, artY + artH + H * 0.075,
      'bold ' + Math.round(H * 0.085) + 'px sans-serif', '#e8eef8', 'center');
    R.text('HOLD THE LINE', cx, artY + artH + H * 0.075 + Math.round(H * 0.04),
      'bold ' + Math.round(H * 0.026) + 'px sans-serif', '#7fa6d8', 'center');

    // ---- Faction leader portraits strip ----
    var leaders = [
      'chaplaingunnerruthbellam',
      'mothersporeilyaleaderoft',
      'tidepriestessmarenaleade',
      'envoylyra9theleaderofthe'
    ];
    var chars = [
      'chars_1_chaplain',
      'chars_1_mother',
      'chars_1_tide',
      'chars_2_mother'
    ];
    var lw = Math.min(84, W * 0.16);
    var lh = lw;
    var gap = 14;
    var totalW = leaders.length * lw + (leaders.length - 1) * gap;
    var lx = cx - totalW / 2;
    var ly = artY + artH + H * 0.135;
    for (var i = 0; i < leaders.length; i++) {
      var gx = lx + i * (lw + gap);
      R.ctx.save();
      R.ctx.globalAlpha = 0.92;
      R.drawSpr(leaders[i], gx, ly, lw, lh);
      // small inset character sprite badge
      R.ctx.globalAlpha = 0.85;
      R.drawSpr(chars[i], gx + lw * 0.62, ly + lh * 0.62, lw * 0.4, lh * 0.4);
      R.ctx.restore();
      R.ctx.save();
      R.ctx.strokeStyle = 'rgba(143,164,196,0.4)';
      R.ctx.lineWidth = 1.5;
      R.roundRect(gx, ly, lw, lh, 8);
      R.ctx.stroke();
      R.ctx.restore();
    }

    // ---- Progress bar ----
    var barW = Math.min(W * 0.62, 480);
    var barH = Math.max(16, H * 0.028);
    var barX = cx - barW / 2;
    var barY = ly + lh + H * 0.06;

    // status label above bar
    var steps = [
      'Booting deterministic core…',
      'Loading balance workbook…',
      'Composing sprite stacks…',
      'Deploying tactical grid…',
      'Warming fog & radar…'
    ];
    var si = Math.min(steps.length - 1, Math.floor(p * steps.length));
    R.text(ready ? 'Ready.' : steps[si], cx, barY - H * 0.03,
      Math.round(H * 0.025) + 'px sans-serif', ready ? '#9fe8c8' : '#9fb4d0', 'center');

    // track
    R.ctx.save();
    R.ctx.fillStyle = 'rgba(20,28,44,0.9)';
    R.roundRect(barX, barY, barW, barH, barH / 2);
    R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(120,160,210,0.5)';
    R.ctx.lineWidth = 1.5;
    R.roundRect(barX, barY, barW, barH, barH / 2);
    R.ctx.stroke();
    R.ctx.restore();

    // fill
    var fillW = Math.max(barH, barW * p);
    R.ctx.save();
    var grad = R.ctx.createLinearGradient(barX, 0, barX + barW, 0);
    if (ready) {
      grad.addColorStop(0, '#3fd07a');
      grad.addColorStop(1, '#5fe0c0');
    } else {
      grad.addColorStop(0, '#3fa9f5');
      grad.addColorStop(1, '#5fe0c0');
    }
    R.ctx.fillStyle = grad;
    R.roundRect(barX, barY, fillW, barH, barH / 2);
    R.ctx.fill();
    R.ctx.restore();

    // percent
    R.text(Math.floor(p * 100) + '%', cx, barY + barH + H * 0.045,
      'bold ' + Math.round(H * 0.03) + 'px sans-serif', '#cfe0f5', 'center');

    // ---- Continue control (only when ready) ----
    if (ready) {
      var bw = Math.min(W * 0.5, 300);
      var bh = Math.max(48, H * 0.09);
      R.addBtn(cx - bw / 2, barY + barH + H * 0.09, bw, bh, 'CONTINUE', function () {
        game._loadProgress = 0;
        R.go(target);
      }, { bg: '#4de08a', fg: '#06121a', text: '#06121a',
           font: 'bold ' + Math.round(H * 0.034) + 'px sans-serif',
           radius: bh / 2, r: bh / 2 });
    }

    R.drawBtns();
  };
};
})();