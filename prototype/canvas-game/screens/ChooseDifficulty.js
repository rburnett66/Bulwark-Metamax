(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
/* ChooseDifficulty — BULWARK
 * Merged screen module: strongest structure of C1 (exact control table, panel
 * discipline), richest presentation of C2 (difficulty cards, chevrons, pips,
 * denied-link feedback), plus C3's terrain art staging (only screen candidate
 * that actually uses the listed art assets).
 *
 * Controls implemented EXACTLY as the layout lists, in order:
 *   #1 PLAY -> scr_zc7dhlv   (always enabled)
 *   #2 PLAY -> "-"           (always enabled; unroutable => safe no-op + flash)
 *   #3 PLAY -> scr_zc7dhlv   (always enabled)
 *   #4 PLAY -> scr_zc7dhlv   (always enabled)
 */
MMKit.screens.ChooseDifficulty = function (state, config, game) {

  // ---- per-card plan: control order matches layout order exactly ----------
  var CARDS = [
    { label: 'PLAY', target: 'scr_zc7dhlv', name: 'RECRUIT', desc: 'Lighter waves. Learn the line.',
      base: 'art_1_grass', feature: 'art_1_palm',  pips: 1, color: '#4fc26b',
      tint: 'rgba(64,160,96,0.26)',  recommended: true },
    { label: 'PLAY', target: '-',           name: 'VETERAN', desc: 'Standard engagement pressure.',
      base: 'art_2_grass', feature: 'art_2_rocks', pips: 2, color: '#e8b23a',
      tint: 'rgba(150,140,90,0.26)' },
    { label: 'PLAY', target: 'scr_zc7dhlv', name: 'ELITE',   desc: 'Dense waves. Sharper counters.',
      base: 'art_3_grass', feature: 'art_3_trees', pips: 3, color: '#e8792e',
      tint: 'rgba(190,110,60,0.26)' },
    { label: 'PLAY', target: 'scr_zc7dhlv', name: 'BULWARK', desc: 'Maximum threat. Hold or fall.',
      base: 'art_4_grass', feature: 'art_1_tall',  pips: 4, color: '#e04747',
      tint: 'rgba(170,60,60,0.30)' }
  ];

  var t = 0;              // frame counter (deterministic pulse; no randomness)
  var deniedAt = -9999;   // frame when the unrouted control was pressed
  var deniedIdx = -1;

  // ---- navigation resolution (targets come from state.next) ----------------
  function resolveTarget(id) {
    if (!id || id === '-') {
      var nx0 = state && state.next;
      if (nx0 && typeof nx0 === 'object' &&
          Object.prototype.toString.call(nx0) !== '[object Array]' && nx0['-']) {
        return nx0['-']; // honor a runtime wiring of '-' if one exists
      }
      return null;
    }
    var nx = state && state.next;
    if (!nx) return id;
    if (typeof nx === 'string') return nx;
    if (Object.prototype.toString.call(nx) === '[object Array]') {
      for (var i = 0; i < nx.length; i++) if (nx[i] === id) return id;
      return nx.length ? nx[0] : id;
    }
    if (typeof nx === 'object') {
      if (nx[id]) return nx[id];
      for (var k in nx) if (nx[k] === id) return id;
      for (var k2 in nx) return nx[k2];
    }
    return id;
  }

  function makeHandler(idx) {
    return function () {
      game.ui_chosenDifficulty = CARDS[idx].name; // UI-scoped shared-state key
      var dest = resolveTarget(CARDS[idx].target);
      if (dest) {
        R.go(dest);
      } else {
        // '-' target: control stays enabled per spec, press acknowledged visually
        deniedAt = t;
        deniedIdx = idx;
      }
    };
  }

  // ---- drawing helpers ------------------------------------------------------
  function drawChevrons(c, cx, cy, n, size, color) {
    c.save();
    c.fillStyle = color;
    var step = size * 0.9;
    var startY = cy + ((n - 1) * step) / 2;
    for (var k = 0; k < n; k++) {
      var y = startY - k * step;
      c.beginPath();
      c.moveTo(cx - size, y + size * 0.35);
      c.lineTo(cx, y - size * 0.35);
      c.lineTo(cx + size, y + size * 0.35);
      c.lineTo(cx + size, y + size * 0.05);
      c.lineTo(cx, y - size * 0.65);
      c.lineTo(cx - size, y + size * 0.05);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  function drawPips(c, x0, y, count, total, r, color, pulse) {
    c.save();
    for (var i = 0; i < total; i++) {
      var px = x0 + i * (r * 2 + 6);
      c.beginPath();
      c.moveTo(px, y - r);
      c.lineTo(px + r, y);
      c.lineTo(px, y + r);
      c.lineTo(px - r, y);
      c.closePath();
      if (i < count) {
        c.globalAlpha = 0.72 + 0.28 * pulse;
        c.fillStyle = color;
        c.fill();
        c.globalAlpha = 1;
        c.strokeStyle = 'rgba(20,14,6,0.9)';
      } else {
        c.fillStyle = 'rgba(30,34,40,0.75)';
        c.fill();
        c.strokeStyle = 'rgba(140,150,164,0.5)';
      }
      c.lineWidth = 1.5;
      c.stroke();
    }
    c.restore();
  }

  // ---- frame renderer -------------------------------------------------------
  return function () {
    t++;
    R.clearBtns();
    R.drawBg(state.cfg && state.cfg.asset);

    var c = R.ctx, W = R.W, H = R.H;
    var pulse = 0.5 + 0.5 * Math.sin(t * 0.06);

    // readability scrim over the staged backdrop
    var scrim = c.createLinearGradient(0, 0, 0, H);
    scrim.addColorStop(0, 'rgba(5,10,16,0.70)');
    scrim.addColorStop(0.45, 'rgba(5,10,16,0.42)');
    scrim.addColorStop(1, 'rgba(3,6,10,0.84)');
    c.fillStyle = scrim;
    c.fillRect(0, 0, W, H);

    // ---- header ----
    var titleY = Math.round(H * 0.105);
    var titleSize = Math.max(22, Math.round(Math.min(W * 0.055, 42)));
    var titleFont = '900 ' + titleSize + 'px "Arial Black", Arial, sans-serif';
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.85)';
    c.shadowBlur = 10;
    R.text('CHOOSE DIFFICULTY', W / 2, titleY, titleFont, '#f2f6fa', 'center');
    c.restore();

    // header rule with center notch (C2)
    var ruleY = titleY + titleSize * 0.5;
    c.save();
    c.strokeStyle = 'rgba(140,165,190,0.55)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(W * 0.08, ruleY); c.lineTo(W / 2 - 14, ruleY);
    c.moveTo(W / 2 + 14, ruleY); c.lineTo(W * 0.92, ruleY);
    c.stroke();
    c.fillStyle = 'rgba(255,196,64,' + (0.55 + 0.35 * pulse).toFixed(3) + ')';
    c.beginPath();
    c.moveTo(W / 2, ruleY - 5); c.lineTo(W / 2 + 5, ruleY);
    c.lineTo(W / 2, ruleY + 5); c.lineTo(W / 2 - 5, ruleY);
    c.closePath();
    c.fill();
    c.restore();

    R.text('SELECT AN ENGAGEMENT TIER, THEN PRESS PLAY', W / 2,
      ruleY + Math.max(16, H * 0.028),
      '600 ' + Math.max(10, Math.round(titleSize * 0.34)) + 'px Arial, sans-serif',
      'rgba(195,208,222,0.92)', 'center');

    // ---- card grid geometry (responsive: 1x4 wide, 2x2 narrow) ----
    var wide = W >= 620;
    var cols = wide ? 4 : 2;
    var rows = wide ? 1 : 2;
    var marginX = Math.round(W * 0.05);
    var gap = Math.max(10, Math.round(W * 0.022));
    var areaTop = Math.round(H * 0.215);
    var areaBot = Math.round(H * 0.955);
    var cw = Math.floor((W - marginX * 2 - gap * (cols - 1)) / cols);
    var ch = Math.floor((areaBot - areaTop - gap * (rows - 1)) / rows);
    ch = Math.min(ch, Math.round(H * 0.62));
    var gridH = ch * rows + gap * (rows - 1);
    var y0 = areaTop + Math.max(0, Math.floor((areaBot - areaTop - gridH) / 2));

    var btnH = Math.max(36, Math.min(52, Math.round(ch * 0.16)));
    var pad = Math.max(8, Math.round(cw * 0.06));
    var nameFont = Math.max(13, Math.round(cw * 0.105));
    var descFont = Math.max(9, Math.round(cw * 0.058));

    for (var i = 0; i < CARDS.length; i++) {
      var d = CARDS[i];
      var col = i % cols, row = Math.floor(i / cols);
      var x = marginX + col * (cw + gap);
      var y = y0 + row * (ch + gap);

      // -- card panel --
      c.save();
      c.fillStyle = 'rgba(12,17,25,0.88)';
      R.roundRect(x, y, cw, ch, 10);
      c.fill();
      if (d.recommended) {
        c.strokeStyle = 'rgba(120,220,150,' + (0.45 + 0.45 * pulse).toFixed(3) + ')';
        c.lineWidth = 2.5;
      } else {
        c.strokeStyle = 'rgba(255,196,64,0.35)';
        c.lineWidth = 1.5;
      }
      R.roundRect(x, y, cw, ch, 10);
      c.stroke();

      // denied flash on the unrouted control (C2)
      if (i === deniedIdx && t - deniedAt < 40) {
        var da = 1 - (t - deniedAt) / 40;
        c.strokeStyle = 'rgba(224,71,71,' + (da * 0.9).toFixed(3) + ')';
        c.lineWidth = 3;
        R.roundRect(x, y, cw, ch, 10);
        c.stroke();
      }

      // faction-color accent stripe
      c.fillStyle = d.color;
      R.roundRect(x + 3, y + 6, 4, ch - 12, 2);
      c.fill();
      c.restore();

      // -- terrain art window (C3: real staged art assets) --
      var artX = x + pad, artY = y + pad;
      var artW = cw - pad * 2;
      var artH = ch - pad * 3 - btnH - Math.round(ch * 0.30);
      c.save();
      R.roundRect(artX, artY, artW, artH, 7);
      c.clip();
      var tile = Math.max(48, Math.floor(artW / 2));
      for (var ty = artY; ty < artY + artH; ty += tile) {
        for (var tx = artX; tx < artX + artW; tx += tile) {
          R.drawSpr(d.base, tx, ty, tile, tile);
        }
      }
      // feature sprite ground-anchored on the terrain
      var fw = Math.round(artW * 0.62);
      var fh = Math.round(artH * 0.78);
      R.drawSpr(d.feature, artX + Math.round((artW - fw) / 2), artY + artH - fh - 4, fw, fh);
      // threat tint + bottom shade
      c.fillStyle = d.tint;
      c.fillRect(artX, artY, artW, artH);
      var gv = c.createLinearGradient(0, artY + artH * 0.5, 0, artY + artH);
      gv.addColorStop(0, 'rgba(6,10,16,0)');
      gv.addColorStop(1, 'rgba(6,10,16,0.65)');
      c.fillStyle = gv;
      c.fillRect(artX, artY + artH * 0.5, artW, artH * 0.5);
      c.restore();
      // window frame
      c.save();
      c.lineWidth = 1.5;
      c.strokeStyle = 'rgba(200,205,215,0.35)';
      R.roundRect(artX, artY, artW, artH, 7);
      c.stroke();
      c.restore();

      // rank chevrons on the art window corner
      drawChevrons(c, artX + 14, artY + 16, d.pips, 7, d.color);

      // -- tier name + description --
      var nameY = artY + artH + Math.max(14, Math.round(ch * 0.075));
      R.text(d.name, x + cw / 2, nameY,
        '900 ' + nameFont + 'px "Arial Black", Arial, sans-serif', '#f2f6fa', 'center');
      R.text(d.desc, x + cw / 2, nameY + Math.max(12, Math.round(ch * 0.055)),
        '500 ' + descFont + 'px Arial, sans-serif', 'rgba(178,192,206,0.95)', 'center');

      // -- threat pips (I–IV grading) --
      var pipR = Math.max(4, Math.round(cw * 0.03));
      var pipsW = 3 * (pipR * 2 + 6);
      drawPips(c, x + cw / 2 - pipsW / 2,
        nameY + Math.max(24, Math.round(ch * 0.105)), d.pips, 4, pipR, d.color, pulse);

      // recommended tag
      if (d.recommended) {
        R.text('RECOMMENDED', x + cw / 2, artY + artH - 6,
          'bold ' + Math.max(8, descFont - 1) + 'px Arial, sans-serif',
          'rgba(140,230,170,' + (0.7 + 0.3 * pulse).toFixed(3) + ')', 'center');
      }

      // denied caption
      if (i === deniedIdx && t - deniedAt < 40) {
        var da2 = 1 - (t - deniedAt) / 40;
        R.text('// LINK OFFLINE', x + cw / 2, y + ch - btnH - pad - 4,
          'bold ' + descFont + 'px Arial, sans-serif',
          'rgba(240,110,110,' + da2.toFixed(3) + ')', 'center');
      }

      // -- PLAY button (interactive control, exactly per layout) --
      var bw = Math.round(cw * 0.78);
      var bx = x + Math.round((cw - bw) / 2);
      var by = y + ch - pad - btnH;
      R.addBtn(bx, by, bw, btnH, d.label, makeHandler(i), {
        fill: '#1e3a4c',
        stroke: d.color,
        color: '#f2f6fa',
        font: 'bold ' + Math.max(14, Math.round(btnH * 0.42)) + 'px Arial, sans-serif',
        radius: 9
      });
    }

    // brief global acknowledgement flash for the unrouted ('-') press
    if (deniedIdx >= 0 && t - deniedAt < 14) {
      c.fillStyle = 'rgba(255,196,64,' + (0.06 * (1 - (t - deniedAt) / 14)).toFixed(3) + ')';
      c.fillRect(0, 0, W, H);
    }

    R.drawBtns();
  };
};
})();