(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.Store = function (state, config, game) {

  var TARGET_ID = 'scr_ab5f1vj';

  // ---- Resolve navigation target for "RETURN to MENU" from state.next ----
  // Tolerates string / array / object shapes; falls back to the declared id.
  function resolveMenuTarget() {
    var n = state && state.next;
    if (!n) return TARGET_ID;
    if (typeof n === 'string') return n;
    if (Object.prototype.toString.call(n) === '[object Array]') {
      for (var i = 0; i < n.length; i++) {
        var v = n[i];
        if (v === TARGET_ID) return v;
        if (v && typeof v === 'object') {
          var cand = v.to || v.target || v.id || v.name;
          if (cand === TARGET_ID) return cand;
        }
      }
      if (typeof n[0] === 'string') return n[0];
      if (n[0] && typeof n[0] === 'object') {
        return n[0].to || n[0].target || n[0].id || n[0].name || TARGET_ID;
      }
      return TARGET_ID;
    }
    if (typeof n === 'object') {
      if (typeof n[TARGET_ID] === 'string') return n[TARGET_ID];
      if (typeof n.menu === 'string') return n.menu;
      if (typeof n.MENU === 'string') return n.MENU;
      var k;
      for (k in n) if (n[k] === TARGET_ID) return TARGET_ID;
      for (k in n) if (typeof n[k] === 'string') return n[k];
    }
    return TARGET_ID;
  }

  // enabledWhen=always — this action is never gated.
  function isMenuEnabled() { return true; }

  function goMenu() {
    if (isMenuEnabled()) R.go(resolveMenuTarget());
  }

  // ---- One-time UI-scoped deterministic state (R.rand only, cached on game) ----
  function getUI() {
    if (game.ui_store) return game.ui_store;
    var items = [
      { key: 'art_1_palm',  name: 'COASTAL PALMS', tag: 'TERRAIN PACK', fallbackPrice: 240 },
      { key: 'art_2_rocks', name: 'ROCK COVER',    tag: 'TERRAIN PACK', fallbackPrice: 180 },
      { key: 'art_3_trees', name: 'FOREST LINE',   tag: 'TERRAIN PACK', fallbackPrice: 320 },
      { key: 'art_4_grass', name: 'GRASSLAND',     tag: 'TERRAIN PACK', fallbackPrice: 120 }
    ];
    for (var i = 0; i < items.length; i++) {
      items[i].tilt = (R.rand() - 0.5) * 0.03;
      items[i].shine = R.rand() * Math.PI * 2;
    }
    var motes = [];
    for (var d = 0; d < 22; d++) {
      motes.push({
        x: R.rand(), y: R.rand(),
        r: 0.6 + R.rand() * 1.5,
        p: R.rand() * Math.PI * 2,
        s: 0.004 + R.rand() * 0.01
      });
    }
    game.ui_store = { t: 0, items: items, motes: motes };
    return game.ui_store;
  }

  function price(item) {
    if (game && game.prices && game.prices[item.key] != null) return game.prices[item.key];
    return item.fallbackPrice;
  }

  function gold() {
    if (game && game.gold != null) return game.gold;
    if (game && game.score != null) return game.score;
    return 0;
  }

  // ---- drawing helpers ----
  function fillRounded(x, y, w, h, r, fill, stroke, lw) {
    var c = R.ctx;
    R.roundRect(x, y, w, h, r);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1; c.stroke(); }
  }

  function bracket(x, y, dx, dy, len, color, width) {
    var c = R.ctx;
    c.beginPath();
    c.moveTo(x + dx * len, y);
    c.lineTo(x, y);
    c.lineTo(x, y + dy * len);
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = 'square';
    c.stroke();
  }

  function rivets(x, y, w, h, pad) {
    var c = R.ctx;
    c.save();
    c.fillStyle = 'rgba(200,214,229,0.35)';
    var pts = [[x + pad, y + pad], [x + w - pad, y + pad], [x + pad, y + h - pad], [x + w - pad, y + h - pad]];
    for (var i = 0; i < pts.length; i++) {
      c.beginPath();
      c.arc(pts[i][0], pts[i][1], Math.max(1.5, pad * 0.28), 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  function coin(cx, cy, r) {
    var c = R.ctx;
    c.save();
    var g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
    g.addColorStop(0, '#ffe9a3');
    g.addColorStop(0.55, '#f2c14e');
    g.addColorStop(1, '#a8801f');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(90,64,10,0.85)';
    c.lineWidth = Math.max(1, r * 0.18);
    c.stroke();
    c.strokeStyle = 'rgba(255,244,200,0.7)';
    c.lineWidth = Math.max(1, r * 0.1);
    c.beginPath();
    c.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  function drawCard(item, x, y, w, h, t) {
    var c = R.ctx;
    c.save();
    c.translate(x + w / 2, y + h / 2);
    c.rotate(item.tilt);
    c.translate(-(x + w / 2), -(y + h / 2));

    // crate body
    var g = c.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, 'rgba(38,48,60,0.96)');
    g.addColorStop(1, 'rgba(22,29,38,0.96)');
    fillRounded(x, y, w, h, 8, null, null, 0);
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = 'rgba(122,148,172,0.7)';
    c.lineWidth = 2;
    R.roundRect(x, y, w, h, 8);
    c.stroke();
    rivets(x, y, w, h, 9);

    // artwork window — real art assets via R.drawSpr
    var pad = Math.round(w * 0.09);
    var aw = w - pad * 2;
    var ah = Math.round(h * 0.48);
    var ax = x + pad;
    var ay = y + pad;
    fillRounded(ax - 2, ay - 2, aw + 4, ah + 4, 6, 'rgba(10,14,20,0.9)', null, 0);
    c.save();
    R.roundRect(ax, ay, aw, ah, 5);
    c.clip();
    R.drawSpr('art_1_grass', ax, ay, aw, ah);
    R.drawSpr(item.key, ax + aw * 0.08, ay + ah * 0.02, aw * 0.84, ah * 0.96);
    // shimmer sweep (deterministic phase)
    var sweep = ((t * 0.012 + item.shine) % (Math.PI * 2)) / (Math.PI * 2);
    var sx = ax - aw * 0.4 + sweep * (aw * 1.8);
    var sg = c.createLinearGradient(sx, ay, sx + aw * 0.25, ay + ah);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.10)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = sg;
    c.fillRect(ax, ay, aw, ah);
    c.restore();

    // tag + name
    var ry = ay + ah + Math.round(h * 0.075);
    R.text(item.tag, x + w / 2, ry, 'bold ' + Math.max(8, Math.round(h * 0.06)) + 'px monospace', 'rgba(140,190,235,0.85)', 'center');
    R.text(item.name, x + w / 2, ry + Math.round(h * 0.11), 'bold ' + Math.max(10, Math.round(h * 0.08)) + 'px sans-serif', '#e8eef5', 'center');

    // price plate with coin
    var py = y + h - Math.round(h * 0.12);
    var plateW = Math.round(w * 0.64);
    fillRounded(x + (w - plateW) / 2, py - Math.round(h * 0.07), plateW, Math.round(h * 0.14), 6,
      'rgba(12,18,26,0.85)', 'rgba(242,193,78,0.55)', 1.5);
    var cr = Math.max(4.5, Math.round(h * 0.045));
    coin(x + (w - plateW) / 2 + cr + 8, py, cr);
    R.text(String(price(item)), x + w / 2 + cr * 0.7, py + cr * 0.6,
      'bold ' + Math.max(10, Math.round(h * 0.075)) + 'px monospace', '#f2c14e', 'center');

    c.restore();
  }

  // ---- per-frame render ----
  return function () {
    R.clearBtns();
    R.drawBg(state.cfg && state.cfg.asset, '#0b1118');

    var ui = getUI();
    ui.t = (ui.t + 1) % 1000000;
    var t = ui.t;
    var pulse = 0.5 + 0.5 * Math.sin(t * 0.05);

    var c = R.ctx;
    var W = R.W, H = R.H;
    var cx = W / 2;

    c.save();

    // ---- Readability scrim over backdrop ----
    var grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(6,10,16,0.72)');
    grad.addColorStop(0.45, 'rgba(6,10,16,0.55)');
    grad.addColorStop(1, 'rgba(6,10,16,0.82)');
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);

    // ---- Drifting motes (behind panel) ----
    for (var i = 0; i < ui.motes.length; i++) {
      var m = ui.motes[i];
      var yy = (m.y + t * m.s * 0.02) % 1;
      c.globalAlpha = Math.max(0.04, 0.10 + 0.10 * Math.sin(t * 0.03 + m.p));
      c.fillStyle = '#9fd8ff';
      c.beginPath();
      c.arc(m.x * W, yy * H, m.r, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    // ---- Central command panel ----
    var pw = Math.min(W * 0.9, 620);
    var ph = Math.min(H * 0.86, 500);
    var px = cx - pw / 2;
    var py = (H - ph) / 2;

    fillRounded(px + 5, py + 7, pw, ph, 16, 'rgba(0,0,0,0.40)', null, 0);            // shadow
    fillRounded(px, py, pw, ph, 16, 'rgba(15,22,28,0.88)', 'rgba(96,128,148,0.55)', 2); // body
    fillRounded(px + 7, py + 7, pw - 14, ph - 14, 11, null, 'rgba(70,96,112,0.35)', 1); // keyline

    // corner brackets (BULWARK military chrome)
    var bc = 'rgba(196,220,234,' + (0.55 + 0.25 * pulse).toFixed(3) + ')';
    bracket(px + 14, py + 14, 1, 1, 22, bc, 2);
    bracket(px + pw - 14, py + 14, -1, 1, 22, bc, 2);
    bracket(px + 14, py + ph - 14, 1, -1, 22, bc, 2);
    bracket(px + pw - 14, py + ph - 14, -1, -1, 22, bc, 2);

    // ---- Header plate ----
    var hh = Math.max(58, Math.min(72, ph * 0.16));
    var hx = px + 26, hw = pw - 52, hy = py + 22;
    fillRounded(hx, hy, hw, hh, 8, 'rgba(24,36,46,0.92)', 'rgba(120,158,180,0.5)', 1.5);

    // hazard-stripe accent along the header base
    c.save();
    c.beginPath();
    c.rect(hx + 6, hy + hh - 9, hw - 12, 5);
    c.clip();
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(214,178,84,0.55)';
    for (var sx2 = hx - 12; sx2 < hx + hw + 12; sx2 += 12) {
      c.beginPath();
      c.moveTo(sx2, hy + hh + 2);
      c.lineTo(sx2 + 10, hy + hh - 14);
      c.stroke();
    }
    c.restore();

    // kicker + glowing title
    R.text('BULWARK  //  REQUISITION DEPOT', cx, hy + 15, 'bold 11px monospace', 'rgba(150,200,235,' + (0.6 + 0.25 * pulse).toFixed(2) + ')', 'center');
    c.save();
    c.shadowColor = 'rgba(110,200,255,' + (0.35 + 0.25 * pulse).toFixed(3) + ')';
    c.shadowBlur = 12 + 8 * pulse;
    R.text('STORE', cx, hy + hh * 0.62, 'bold ' + Math.round(hh * 0.5) + 'px monospace', '#eaf6ff', 'center');
    c.restore();

    // ---- Gold chip (read-only, top-right of panel) ----
    var chipW = 96, chipH = 26;
    var chipX = px + pw - chipW - 30, chipY = hy + hh + 12;
    fillRounded(chipX, chipY, chipW, chipH, 13, 'rgba(12,18,26,0.85)', 'rgba(242,193,78,0.5)', 1.5);
    coin(chipX + 14, chipY + chipH / 2, 8);
    R.text(String(gold()), chipX + 30, chipY + chipH / 2 + 4, 'bold 13px monospace', '#f2c14e', 'left');

    // ---- Divider with diamond ----
    var dy = hy + hh + 12 + chipH / 2;
    c.beginPath();
    c.moveTo(px + 34, dy);
    c.lineTo(chipX - 14, dy);
    c.strokeStyle = 'rgba(110,142,160,0.35)';
    c.lineWidth = 1;
    c.stroke();
    c.beginPath();
    c.moveTo(px + 44, dy - 5);
    c.lineTo(px + 49, dy);
    c.lineTo(px + 44, dy + 5);
    c.lineTo(px + 39, dy);
    c.closePath();
    c.fillStyle = 'rgba(196,220,234,0.6)';
    c.fill();

    // ---- Showcase: terrain pack cards (display-only; sole control is RETURN) ----
    var rowTop = dy + 18;
    var bh = Math.max(48, Math.min(58, H * 0.09));
    var rowBottom = py + ph - bh - 54;
    var cardH = Math.max(120, rowBottom - rowTop);
    var gap = 12;
    var cols = ui.items.length;
    var cardW = Math.min(130, (pw - 60 - gap * (cols - 1)) / cols);
    var totalW = cardW * cols + gap * (cols - 1);
    var startX = cx - totalW / 2;
    for (var ci = 0; ci < cols; ci++) {
      drawCard(ui.items[ci], startX + ci * (cardW + gap), rowTop, cardW, cardH, t);
    }

    // ---- Guidance chevrons pointing to the primary action ----
    var chevY = rowTop + cardH + 10 + Math.sin(t * 0.08) * 3;
    c.save();
    c.strokeStyle = 'rgba(140,215,255,0.8)';
    c.lineWidth = 2.5;
    c.lineCap = 'round';
    for (var ch = 0; ch < 2; ch++) {
      var oy = chevY + ch * 10;
      c.globalAlpha = 0.85 - ch * 0.35;
      c.beginPath();
      c.moveTo(cx - 10, oy);
      c.lineTo(cx, oy + 7);
      c.lineTo(cx + 10, oy);
      c.stroke();
    }
    c.restore();

    c.restore();

    // ---- Sole control per spec: RETURN to MENU (enabledWhen=always) ----
    var bw = Math.min(340, pw - 80);
    var bx = cx - bw / 2;
    var by = py + ph - bh - 26;

    // glow halo marks it as THE action
    c.save();
    c.globalAlpha = 0.22 + 0.15 * pulse;
    c.fillStyle = 'rgba(110,200,255,1)';
    R.roundRect(bx - 6, by - 6, bw + 12, bh + 12, 14);
    c.fill();
    c.restore();

    R.addBtn(bx, by, bw, bh, 'RETURN TO MENU', goMenu, {
      primary: true,
      enabled: isMenuEnabled(),
      bg: '#123146',
      color: '#eaf6ff',
      border: '#7fd0ff',
      font: 'bold 20px monospace',
      radius: 12
    });

    R.drawBtns();
  };
};
})();