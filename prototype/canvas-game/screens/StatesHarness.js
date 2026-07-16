(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.StatesHarness = function (state, config, game) {

  // ---- palette (BULWARK dark-ops presentation, high-contrast hierarchy) ----
  var COL = {
    scrim:  'rgba(6,10,14,0.6)',
    ink:    '#e8eef2',
    dim:    'rgba(160,178,190,0.85)',
    faint:  'rgba(150,168,180,0.75)',
    accent: '#f2b632',
    ok:     'rgba(111,211,168,0.9)'
  };

  // ---- static row model: the 12 staged character-state sprites -----------
  var ROWS = [
    {
      name: 'MOTHER',
      tag: 'HEAVY LINE / ORGANIC',
      accent: '#f2b632',
      keys: ['chars_1_mother', 'chars_2_mother', 'chars_3_mother',
             'chars_4_mother', 'chars_5_mother', 'chars_6_mother']
    },
    {
      name: 'CHAPLAIN',
      tag: 'SUPPORT / ORGANIC',
      accent: '#7fb2d8',
      keys: ['chars_1_chaplain', 'chars_2_chaplain', 'chars_3_chaplain']
    },
    {
      name: 'TIDE',
      tag: 'SWARM / ORGANIC',
      accent: '#6fd3a8',
      keys: ['chars_1_tide', 'chars_2_tide', 'chars_3_tide']
    }
  ];

  var CYCLE = 42; // frames per highlighted state step (deterministic)
  var FALLBACK_NEXT = 'scr_er2mf9n'; // sole declared transition out

  // ---- resolve the single transition-out target from state.next ----------
  function navTarget() {
    var n = state && state.next;
    if (!n) return FALLBACK_NEXT;
    if (typeof n === 'string') return n;
    if (Object.prototype.toString.call(n) === '[object Array]') {
      return (typeof n[0] === 'string' && n[0]) ? n[0] : FALLBACK_NEXT;
    }
    if (typeof n === 'object') {
      if (typeof n[FALLBACK_NEXT] === 'string' && n[FALLBACK_NEXT]) return n[FALLBACK_NEXT];
      for (var k in n) {
        if (Object.prototype.hasOwnProperty.call(n, k)) {
          var v = n[k];
          if (typeof v === 'string' && v) return v;
          return k;
        }
      }
    }
    return FALLBACK_NEXT;
  }

  function pad2(v) { return (v < 10 ? '0' : '') + v; }

  function drawPanel(px, py, pw, ph, row, t) {
    var ctx = R.ctx;
    var n = row.keys.length;
    var active = Math.floor(t / CYCLE) % n;
    var frac = (t % CYCLE) / CYCLE;

    // panel plate
    ctx.save();
    ctx.fillStyle = 'rgba(10,16,22,0.85)';
    R.roundRect(px, py, pw, ph, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,140,155,0.45)';
    ctx.lineWidth = 1.5;
    R.roundRect(px, py, pw, ph, 10);
    ctx.stroke();

    // header strip
    var hh = Math.max(24, ph * 0.16);
    ctx.fillStyle = 'rgba(20,30,40,0.9)';
    R.roundRect(px, py, pw, hh, 10);
    ctx.fill();
    ctx.fillStyle = row.accent;
    ctx.fillRect(px + 8, py + hh * 0.28, 4, hh * 0.44);
    ctx.restore();

    var hFont = 'bold ' + Math.round(hh * 0.5) + 'px monospace';
    var sFont = 'bold ' + Math.round(hh * 0.36) + 'px monospace';
    R.text(row.name, px + 20, py + hh * 0.52, hFont, COL.ink, 'left');
    R.text(row.tag, px + 20 + row.name.length * hh * 0.34 + 14, py + hh * 0.55, sFont, COL.dim, 'left');
    R.text('STATE ' + pad2(active + 1) + '/' + pad2(n), px + pw - 14, py + hh * 0.55, sFont, row.accent, 'right');

    // cycle progress tick under header
    ctx.save();
    ctx.fillStyle = 'rgba(60,75,88,0.6)';
    ctx.fillRect(px + 12, py + hh + 3, pw - 24, 2);
    ctx.fillStyle = row.accent;
    ctx.fillRect(px + 12, py + hh + 3, (pw - 24) * ((active + frac) / n), 2);
    ctx.restore();

    // cells
    var ip = Math.max(8, pw * 0.012);
    var cy0 = py + hh + 10;
    var ch = ph - hh - 10 - ip;
    var cw = (pw - ip * (n + 1)) / n;

    for (var i = 0; i < n; i++) {
      var cx = px + ip + i * (cw + ip);
      var isActive = (i === active);

      ctx.save();
      ctx.fillStyle = isActive ? 'rgba(26,38,48,0.95)' : 'rgba(14,20,26,0.9)';
      R.roundRect(cx, cy0, cw, ch, 6);
      ctx.fill();
      if (isActive) {
        ctx.shadowColor = row.accent;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = row.accent;
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = 'rgba(90,108,120,0.35)';
        ctx.lineWidth = 1;
      }
      R.roundRect(cx, cy0, cw, ch, 6);
      ctx.stroke();
      ctx.restore();

      // ground anchor line (visual system: units sit on a ground anchor)
      ctx.save();
      ctx.strokeStyle = 'rgba(120,140,155,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + 6, cy0 + ch - 16);
      ctx.lineTo(cx + cw - 6, cy0 + ch - 16);
      ctx.stroke();
      ctx.restore();

      // sprite (breathing bob on the active cell, deterministic)
      var m = Math.max(6, cw * 0.1);
      var sw = cw - m * 2;
      var sh = ch - m - 22;
      var bob = isActive ? Math.sin(frac * Math.PI * 2) * 2 : 0;
      var grow = isActive ? 3 : 0;
      R.drawSpr(row.keys[i], cx + m - grow, cy0 + m * 0.6 - grow + bob, sw + grow * 2, sh + grow * 2);

      // state label
      var lFont = 'bold ' + Math.round(Math.max(9, ch * 0.09)) + 'px monospace';
      R.text('S' + (i + 1), cx + cw / 2, cy0 + ch - 7, lFont,
        isActive ? row.accent : COL.faint, 'center');
    }
  }

  // ---- per-frame render ---------------------------------------------------
  return function () {
    R.clearBtns();

    // backdrop: state.cfg.asset when present (real staged image), else fallback
    R.drawBg(state.cfg && state.cfg.asset);

    var ctx = R.ctx;
    var W = R.W, H = R.H;
    var m = Math.min(W, H);
    var pad = Math.max(10, m * 0.03);

    // UI-scoped deterministic frame counter (write only UI-scoped keys)
    game.ui_statesHarness_t = (game.ui_statesHarness_t || 0) + 1;
    var t = game.ui_statesHarness_t;

    // readability scrim so the harness reads over any backdrop
    ctx.save();
    ctx.fillStyle = COL.scrim;
    ctx.fillRect(0, 0, W, H);
    // faint grid in header band
    ctx.strokeStyle = 'rgba(120,140,155,0.08)';
    ctx.lineWidth = 1;
    for (var gx = 0; gx < W; gx += Math.max(24, W / 32)) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H * 0.12); ctx.stroke();
    }
    ctx.restore();

    // ---- header ----
    var titleFont = 'bold ' + Math.round(m * 0.055) + 'px monospace';
    var subFont = 'bold ' + Math.round(m * 0.024) + 'px monospace';
    R.text('STATES HARNESS', pad, H * 0.055, titleFont, COL.ink, 'left');
    R.text('SPRITE-STATE REVIEW // C12 UNIT SPRITE STACK — READ-ONLY',
      pad, H * 0.105, subFont, COL.dim, 'left');
    R.text('TICK ' + pad2(Math.floor(t / 100) % 100) + ':' + pad2(t % 100),
      W - pad, H * 0.055, subFont, COL.accent, 'right');
    R.text('DET-CORE SYNC OK', W - pad, H * 0.095, subFont, COL.ok, 'right');

    // header rule
    ctx.save();
    ctx.strokeStyle = 'rgba(242,182,50,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad, H * 0.125);
    ctx.lineTo(W - pad, H * 0.125);
    ctx.stroke();
    ctx.restore();

    // ---- panels: MOTHER (6 states) full width; CHAPLAIN + TIDE side by side ----
    var top = H * 0.145;
    var bottom = H * 0.84;
    var contentH = bottom - top;
    var gap = Math.max(8, contentH * 0.035);

    var h1 = contentH * 0.53 - gap / 2;
    var h2 = contentH * 0.47 - gap / 2;

    drawPanel(pad, top, W - pad * 2, h1, ROWS[0], t);

    var halfW = (W - pad * 3) / 2;
    drawPanel(pad, top + h1 + gap, halfW, h2, ROWS[1], t);
    drawPanel(pad * 2 + halfW, top + h1 + gap, halfW, h2, ROWS[2], t);

    // ---- footer / the ONE transition out ----
    var bw = Math.min(280, W * 0.4);
    var bh = Math.max(40, H * 0.075);
    var bx = W / 2 - bw / 2;
    var by = H * 0.865;

    R.text('TRANSITION OUT', W / 2, by - Math.max(6, H * 0.012),
      'bold ' + Math.round(m * 0.02) + 'px monospace', 'rgba(160,178,190,0.7)', 'center');

    R.addBtn(bx, by, bw, bh, 'CONTINUE ▶', function () {
      R.go(navTarget());
    }, { primary: true, accent: COL.accent, color: COL.accent });

    R.drawBtns();
  };
};
})();