(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.Inventory = function (state, config, game) {
  // ---- static, deterministic item catalogue (display-only; uses staged art) ----
  var ITEMS = [
    { spr: 'art_1_tall',  name: 'TALL PINE STAND',  cls: 'TERRAIN' },
    { spr: 'art_1_palm',  name: 'PALM GROVE',       cls: 'TERRAIN' },
    { spr: 'art_1_grass', name: 'LOWLAND GRASS',    cls: 'TERRAIN' },
    { spr: 'art_1_ocean', name: 'COASTAL SHALLOWS', cls: 'MARINE'  },
    { spr: 'art_2_rocks', name: 'ROCK OUTCROP',     cls: 'TERRAIN' },
    { spr: 'art_2_grass', name: 'STEPPE GRASS',     cls: 'TERRAIN' },
    { spr: 'art_2_ocean', name: 'DEEP WATER',       cls: 'MARINE'  },
    { spr: 'art_3_trees', name: 'FOREST CANOPY',    cls: 'TERRAIN' },
    { spr: 'art_3_grass', name: 'HIGHLAND GRASS',   cls: 'TERRAIN' },
    { spr: 'art_4_grass', name: 'TUNDRA GRASS',     cls: 'TERRAIN' }
  ];

  // deterministic per-session serial tags (R.rand only, cached so frames don't flicker)
  if (!game.__invUI) {
    var serials = [];
    for (var i0 = 0; i0 < ITEMS.length; i0++) {
      serials.push('QM-' + String(100 + Math.floor(R.rand() * 900)));
    }
    game.__invUI = { serials: serials };
  }

  // ---- resolve navigation target for RETURN to MENU (from state.next) ----
  function resolveMenuTarget() {
    var n = state && state.next;
    var id = 'scr_ab5f1vj';
    if (!n) return id;
    if (typeof n === 'string') return n;
    if (Object.prototype.toString.call(n) === '[object Array]') {
      for (var i = 0; i < n.length; i++) {
        var v = n[i];
        if (typeof v === 'string' && v.indexOf('ab5f1vj') >= 0) return v;
        if (v && typeof v === 'object') {
          var t = v.target || v.to || v.id || v.name;
          if (typeof t === 'string' && t.indexOf('ab5f1vj') >= 0) return t;
        }
      }
      var f = n[0];
      if (typeof f === 'string') return f;
      if (f && typeof f === 'object') return f.target || f.to || f.id || f.name || id;
      return id;
    }
    if (typeof n === 'object') {
      if (n[id]) return typeof n[id] === 'string' ? n[id] : id;
      var keys = [], k;
      for (k in n) { if (Object.prototype.hasOwnProperty.call(n, k)) keys.push(k); }
      for (var j = 0; j < keys.length; j++) {
        if (keys[j].indexOf('ab5f1vj') >= 0) return keys[j];
        var vv = n[keys[j]];
        if (typeof vv === 'string' && vv.indexOf('ab5f1vj') >= 0) return vv;
      }
      for (var j2 = 0; j2 < keys.length; j2++) {
        if (keys[j2].toLowerCase().indexOf('menu') >= 0) {
          var mv = n[keys[j2]];
          return typeof mv === 'string' ? mv : keys[j2];
        }
      }
      if (keys.length) {
        var v0 = n[keys[0]];
        return typeof v0 === 'string' ? v0 : keys[0];
      }
    }
    return id;
  }
  var MENU_TARGET = resolveMenuTarget();

  // ---- palette (BULWARK military presentation language) ----
  var COL = {
    steelLite: '#243544',
    amber: 'rgba(255,178,64,0.9)',
    amberDim: 'rgba(255,178,64,0.45)',
    text: '#d8e4ee'
  };

  function panel(ctx, x, y, w, h, r, fill, stroke, lw) {
    ctx.fillStyle = fill;
    R.roundRect(x, y, w, h, r);
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = lw || 1;
      ctx.strokeStyle = stroke;
      R.roundRect(x, y, w, h, r);
      ctx.stroke();
    }
  }

  function bracket(ctx, x, y, s, dx, dy, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + dx * s, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * s);
    ctx.stroke();
  }

  return function () {
    R.clearBtns();
    R.drawBg(state.cfg && state.cfg.asset);

    var ctx = R.ctx;
    var W = R.W, H = R.H;
    var sc = Math.min(W / 960, H / 640);
    if (sc <= 0) sc = 1;

    // ---- atmospheric dim over backdrop (military ops-room feel) ----
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(6,10,16,0.72)');
    grad.addColorStop(0.5, 'rgba(8,13,20,0.55)');
    grad.addColorStop(1, 'rgba(4,7,12,0.78)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // faint scanlines
    ctx.fillStyle = 'rgba(120,160,190,0.035)';
    var step = Math.max(4, Math.round(6 * sc));
    for (var sy0 = 0; sy0 < H; sy0 += step * 2) ctx.fillRect(0, sy0, W, step);

    // ---- header ----
    var headH = Math.round(74 * sc);
    panel(ctx, 0, 0, W, headH, 0, 'rgba(10,16,24,0.85)', null, 0);
    ctx.fillStyle = COL.amber;
    ctx.fillRect(0, headH - 3, W, 3);

    R.text('INVENTORY', W / 2, Math.round(headH * 0.44),
      '700 ' + Math.round(30 * sc) + 'px "Segoe UI", Arial, sans-serif', '#f2e8d0', 'center');
    R.text('BULWARK  //  QUARTERMASTER MANIFEST', W / 2, Math.round(headH * 0.78),
      Math.round(12 * sc) + 'px "Segoe UI", Arial, sans-serif', 'rgba(160,190,210,0.85)', 'center');

    // header corner brackets
    var bs = Math.round(16 * sc);
    bracket(ctx, Math.round(14 * sc), Math.round(12 * sc), bs, 1, 1, 'rgba(255,178,64,0.7)');
    bracket(ctx, W - Math.round(14 * sc), Math.round(12 * sc), bs, -1, 1, 'rgba(255,178,64,0.7)');

    // ---- main manifest panel ----
    var footH = Math.round(96 * sc);
    var pad = Math.round(24 * sc);
    var px = pad, py = headH + Math.round(14 * sc);
    var pw = W - pad * 2;
    var ph = H - footH - py - Math.round(10 * sc);
    panel(ctx, px, py, pw, ph, Math.round(10 * sc),
      'rgba(14,22,32,0.82)', 'rgba(110,150,175,0.35)', 1.5);

    // panel title strip
    var stripH = Math.round(30 * sc);
    panel(ctx, px + 6, py + 6, pw - 12, stripH, Math.round(6 * sc), 'rgba(24,36,50,0.9)', null, 0);
    R.text('SECURED HOLDINGS — ' + ITEMS.length + ' LOTS CATALOGUED',
      px + Math.round(18 * sc), py + 6 + stripH * 0.62,
      '600 ' + Math.round(12 * sc) + 'px "Segoe UI", Arial, sans-serif',
      'rgba(255,206,120,0.95)', 'left');
    R.text('READ-ONLY // C6 CORE',
      px + pw - Math.round(18 * sc), py + 6 + stripH * 0.62,
      Math.round(11 * sc) + 'px "Segoe UI", Arial, sans-serif',
      'rgba(140,170,190,0.7)', 'right');

    // ---- item grid (display-only; no interactive slots per layout spec) ----
    var cols = (W > H * 1.15) ? 5 : ((W > H * 0.8) ? 4 : 2);
    var rows = Math.ceil(ITEMS.length / cols);
    var gx = px + Math.round(14 * sc);
    var gy = py + stripH + Math.round(18 * sc);
    var gw = pw - Math.round(28 * sc);
    var gh = ph - stripH - Math.round(30 * sc);
    var gap = Math.round(10 * sc);
    var cw = (gw - gap * (cols - 1)) / cols;
    var ch = (gh - gap * (rows - 1)) / rows;
    if (ch < 40 * sc) ch = 40 * sc;

    var serials = game.__invUI.serials;

    for (var n = 0; n < ITEMS.length; n++) {
      var it = ITEMS[n];
      var cc = n % cols, rr = Math.floor(n / cols);
      var sx = gx + cc * (cw + gap);
      var syy = gy + rr * (ch + gap);

      // slot chassis
      panel(ctx, sx, syy, cw, ch, Math.round(6 * sc),
        'rgba(20,30,42,0.9)', 'rgba(90,125,150,0.4)', 1);

      // art window
      var awPad = Math.round(6 * sc);
      var labelH = Math.round(34 * sc);
      var aw = cw - awPad * 2;
      var ah = ch - labelH - awPad * 2;
      if (ah < 10) ah = 10;
      ctx.fillStyle = 'rgba(8,13,20,0.9)';
      ctx.fillRect(sx + awPad, syy + awPad, aw, ah);
      R.drawSpr(it.spr, sx + awPad, syy + awPad, aw, ah);
      // window frame + glint
      ctx.strokeStyle = 'rgba(255,178,64,0.28)';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx + awPad + 0.5, syy + awPad + 0.5, aw - 1, ah - 1);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(sx + awPad, syy + awPad, aw, Math.max(2, ah * 0.18));

      // class chip
      var chipW = Math.round(52 * sc), chipH = Math.round(14 * sc);
      ctx.fillStyle = (it.cls === 'MARINE') ? 'rgba(64,140,200,0.85)' : 'rgba(120,150,80,0.85)';
      ctx.fillRect(sx + awPad + 2, syy + awPad + 2, chipW, chipH);
      R.text(it.cls, sx + awPad + 2 + chipW / 2, syy + awPad + 2 + chipH * 0.72,
        '600 ' + Math.round(9 * sc) + 'px "Segoe UI", Arial, sans-serif', '#0b1218', 'center');

      // label block
      var ly = syy + ch - labelH;
      R.text(it.name, sx + cw / 2, ly + labelH * 0.42,
        '600 ' + Math.round(11 * sc) + 'px "Segoe UI", Arial, sans-serif', '#e8e2d0', 'center');
      R.text(serials[n], sx + cw / 2, ly + labelH * 0.82,
        Math.round(9 * sc) + 'px "Segoe UI", Arial, sans-serif', 'rgba(150,180,200,0.65)', 'center');
    }

    // panel corner brackets
    bracket(ctx, px + 3, py + 3, bs, 1, 1, 'rgba(160,200,225,0.5)');
    bracket(ctx, px + pw - 3, py + ph - 3, bs, -1, -1, 'rgba(160,200,225,0.5)');

    // ---- footer: the ONE action — RETURN to MENU (unmissable primary CTA) ----
    ctx.fillStyle = 'rgba(10,16,24,0.85)';
    ctx.fillRect(0, H - footH, W, footH);
    ctx.fillStyle = COL.amberDim;
    ctx.fillRect(0, H - footH, W, 2);

    var bw = Math.min(Math.round(320 * sc), W * 0.6);
    var bh = Math.min(Math.round(52 * sc), footH - Math.round(24 * sc));
    if (bh < 36) bh = 36;
    var bx = W / 2 - bw / 2;
    var by = H - footH / 2 - bh / 2;

    // focus glow bed behind the button so "what to do next" is obvious
    ctx.save();
    ctx.shadowColor = 'rgba(255,178,64,0.5)';
    ctx.shadowBlur = Math.round(18 * sc);
    R.roundRect(bx - 5, by - 5, bw + 10, bh + 10, Math.round(10 * sc));
    ctx.fillStyle = 'rgba(255,178,64,0.14)';
    ctx.fill();
    ctx.restore();

    R.addBtn(bx, by, bw, bh, 'RETURN TO MENU', function () {
      R.go(MENU_TARGET);
    }, {
      font: 'bold ' + Math.round(17 * sc) + 'px "Segoe UI", Arial, sans-serif',
      bg: COL.steelLite,
      color: COL.text,
      border: COL.amber,
      radius: Math.round(8 * sc)
    });

    // button corner ticks (military HUD framing)
    var ts = Math.round(10 * sc);
    bracket(ctx, bx - 4, by - 4, ts, 1, 1, COL.amberDim);
    bracket(ctx, bx + bw + 4, by - 4, ts, -1, 1, COL.amberDim);
    bracket(ctx, bx - 4, by + bh + 4, ts, 1, -1, COL.amberDim);
    bracket(ctx, bx + bw + 4, by + bh + 4, ts, -1, -1, COL.amberDim);

    R.drawBtns();
  };
};
})();