(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.Menu = function (state, config, game) {
  "use strict";

  var W = R.W, H = R.H, CX = W / 2;
  var frame = 0;

  // ---------- navigation resolution (targets come from state.next) ----------
  var TARGETS = {
    "CHOOSE CHARACTER": "scr_m8rpgxd",
    "PLAY":             "scr_u4678ee",
    "STORE":            "scr_rskt6dn",
    "INVENTORY":        "scr_ae09vxa",
    "SETTINGS":         "scr_er2mf9n", // layout target '-'; scr_er2mf9n is the remaining flow transition
    "LEADERBOARD":      "scr_wp1ium2"
  };

  function resolve(key) {
    var fallback = TARGETS[key];
    var n = state && state.next;
    if (n) {
      if (typeof n === "string") return n;
      if (Array.isArray(n)) {
        if (n.indexOf(fallback) >= 0) return fallback;
      } else if (typeof n === "object") {
        if (typeof n[key] === "string" && n[key] && n[key] !== "-") return n[key];
        if (typeof n[fallback] === "string" && n[fallback]) return n[fallback];
      }
    }
    return fallback;
  }
  function nav(key) {
    return function () {
      var dest = resolve(key);
      if (dest && dest !== "-") R.go(dest);
    };
  }

  // ---------- deterministic decor (seeded ONCE at init via R.rand) ----------
  var motes = [];
  (function seedMotes() {
    for (var i = 0; i < 36; i++) {
      motes.push({
        x: R.rand() * W,
        y: R.rand() * H * 0.55,
        s: 1 + R.rand() * 2,
        p: R.rand() * Math.PI * 2,
        v: 0.4 + R.rand() * 0.8
      });
    }
  })();

  var groundSpr = [];
  (function seedDecor() {
    var tufts = ["art_4_grass", "art_3_grass", "art_2_grass", "art_1_grass"];
    for (var i = 0; i < 10; i++) {
      var k = tufts[Math.floor(R.rand() * tufts.length) % tufts.length];
      groundSpr.push({
        key: k,
        x: 10 + R.rand() * (W - 80),
        y: H - 46 - R.rand() * 26,
        w: 34 + R.rand() * 26,
        h: 26 + R.rand() * 18,
        sway: R.rand() * Math.PI * 2
      });
    }
    groundSpr.push({ key: "art_1_palm",  x: W * 0.045, y: H - 190, w: 110, h: 160, sway: R.rand() * 6 });
    groundSpr.push({ key: "art_1_tall",  x: W * 0.86,  y: H - 210, w: 96,  h: 180, sway: R.rand() * 6 });
    groundSpr.push({ key: "art_3_trees", x: W * 0.73,  y: H - 150, w: 120, h: 120, sway: R.rand() * 6 });
    groundSpr.push({ key: "art_2_rocks", x: W * 0.19,  y: H - 92,  w: 90,  h: 62,  sway: 0 });
  })();

  // ---------- layout metrics ----------
  var panelW = Math.min(W * 0.82, 520);
  var panelX = CX - panelW / 2;
  var gap = Math.max(10, H * 0.018);
  var btnH = Math.max(44, Math.min(58, H * 0.075));
  var playH = Math.max(56, btnH * 1.25);
  var setH = Math.max(38, btnH * 0.85);
  var halfW = (panelW - gap) / 2;

  var titleY = Math.max(60, H * 0.13);
  var stackY = titleY + Math.min(72, H * 0.11);
  var stackH = playH + gap + btnH + gap + btnH + gap + setH;
  var padY = 20;
  if (stackY + stackH + padY > H - 46) stackY = Math.max(titleY + 50, H - 46 - stackH - padY);
  var panelTop = stackY - padY;
  var panelH = stackH + padY * 2;

  // ---------- drawing helpers ----------
  function fillRR(x, y, w, h, r, fill, stroke, lw) {
    var c = R.ctx;
    c.save();
    R.roundRect(x, y, w, h, r);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1.5; R.roundRect(x, y, w, h, r); c.stroke(); }
    c.restore();
  }

  function corners(x, y, w, h, len, col) {
    var c = R.ctx;
    c.save();
    c.strokeStyle = col;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x, y + len); c.lineTo(x, y); c.lineTo(x + len, y);
    c.moveTo(x + w - len, y); c.lineTo(x + w, y); c.lineTo(x + w, y + len);
    c.moveTo(x + w, y + h - len); c.lineTo(x + w, y + h); c.lineTo(x + w - len, y + h);
    c.moveTo(x + len, y + h); c.lineTo(x, y + h); c.lineTo(x, y + h - len);
    c.stroke();
    c.restore();
  }

  function hazardBar(x, y, w, h) {
    var c = R.ctx;
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    c.fillStyle = "rgba(20,24,20,0.9)";
    c.fillRect(x, y, w, h);
    c.fillStyle = "rgba(224,178,52,0.85)";
    for (var sx = x - h * 2; sx < x + w + h; sx += h * 2.4) {
      c.beginPath();
      c.moveTo(sx, y + h);
      c.lineTo(sx + h, y);
      c.lineTo(sx + h * 1.5, y);
      c.lineTo(sx + h * 0.5, y + h);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  function accentUnder(x, y, w, h, primary, pulse) {
    var c = R.ctx;
    c.save();
    c.fillStyle = primary
      ? "rgba(224,178,52," + (0.12 + 0.12 * pulse).toFixed(3) + ")"
      : "rgba(90,120,96,0.14)";
    R.roundRect(x - 4, y - 4, w + 8, h + 8, 10);
    c.fill();
    c.restore();
    corners(x - 4, y - 4, w + 8, h + 8, 12,
      primary ? "rgba(238,196,72," + (0.55 + 0.4 * pulse).toFixed(3) + ")" : "rgba(150,175,150,0.55)");
  }

  function chevron(cx, cy, s, alpha) {
    var c = R.ctx;
    c.save();
    c.globalAlpha = alpha;
    c.strokeStyle = "#ffd678";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(cx - s, cy - s * 0.5);
    c.lineTo(cx, cy + s * 0.5);
    c.lineTo(cx + s, cy - s * 0.5);
    c.stroke();
    c.restore();
  }

  // ---------- one frame ----------
  return function () {
    R.clearBtns();
    frame++;

    var c = R.ctx;
    var pulse = 0.5 + 0.5 * Math.sin(frame * 0.05);

    // 1. Backdrop
    R.drawBg(state.cfg && state.cfg.asset);

    // 2. Atmosphere: command dim top-to-bottom
    c.save();
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(6,10,8,0.62)");
    g.addColorStop(0.45, "rgba(6,10,8,0.32)");
    g.addColorStop(1, "rgba(4,8,6,0.72)");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.restore();

    // 3. Environmental sprite dressing (gentle sway, deterministic phases)
    var i, d, bob;
    for (i = 0; i < groundSpr.length; i++) {
      d = groundSpr[i];
      bob = d.sway ? Math.sin(frame * 0.025 + d.sway) * 2 : 0;
      R.drawSpr(d.key, d.x + bob * 0.5, d.y + Math.abs(bob) * 0.4, d.w, d.h);
    }

    // 4. Drifting motes (phase animation, no per-frame rand)
    c.save();
    for (i = 0; i < motes.length; i++) {
      var m = motes[i];
      c.globalAlpha = 0.16 + 0.2 * (0.5 + 0.5 * Math.sin(m.p + frame * 0.02 * m.v));
      c.fillStyle = "#cfe3c8";
      c.fillRect((m.x + frame * 0.12 * m.v) % W, m.y, m.s, m.s);
    }
    c.restore();

    // 5. Scanlines over the sky band
    c.save();
    c.globalAlpha = 0.05;
    c.fillStyle = "#000";
    for (var ly = 0; ly < H * 0.45; ly += 4) c.fillRect(0, ly, W, 1);
    c.restore();

    // 6. Title block
    c.save();
    c.shadowColor = "rgba(0,0,0,0.85)";
    c.shadowBlur = 12;
    c.shadowOffsetY = 3;
    R.text("BULWARK", CX, titleY,
      "bold " + Math.round(Math.min(60, W * 0.11)) + "px monospace", "#f2e6c8", "center");
    c.restore();
    R.text("T A C T I C A L   D E F E N S E   C O M M A N D",
      CX, titleY + Math.min(28, H * 0.042),
      "bold " + Math.max(10, Math.round(W * 0.018)) + "px monospace",
      "rgba(255,214,120," + (0.55 + 0.35 * pulse).toFixed(2) + ")", "center");
    hazardBar(CX - panelW * 0.42, titleY + Math.min(42, H * 0.063), panelW * 0.84, 6);

    // 7. Command panel
    fillRR(panelX - 16, panelTop - 6, panelW + 32, panelH + 12, 12,
      "rgba(10,16,12,0.7)", "rgba(224,178,52,0.35)", 1.5);
    fillRR(panelX - 11, panelTop - 1, panelW + 22, panelH + 2, 9,
      null, "rgba(150,175,150,0.16)", 1);
    corners(panelX - 16, panelTop - 6, panelW + 32, panelH + 12, 16, "rgba(238,196,72,0.8)");

    // 8. Controls — all six, exactly as specified
    var y = stackY;

    // PLAY — dominant primary deploy action with pulsing frame + chevrons
    accentUnder(panelX, y, panelW, playH, true, pulse);
    R.addBtn(panelX, y, panelW, playH, "PLAY", nav("PLAY"), {
      font: "bold " + Math.round(playH * 0.38) + "px monospace",
      primary: true
    });
    chevron(panelX + 26, y + playH / 2 - 3 + pulse * 2, 8, 0.9);
    chevron(panelX + panelW - 26, y + playH / 2 - 3 + pulse * 2, 8, 0.9);
    y += playH + gap;

    var secFont = "bold " + Math.max(12, Math.round(btnH * 0.28)) + "px monospace";

    // Row: CHOOSE CHARACTER | STORE
    accentUnder(panelX, y, halfW, btnH, false, pulse);
    R.addBtn(panelX, y, halfW, btnH, "CHOOSE CHARACTER", nav("CHOOSE CHARACTER"), { font: secFont });
    accentUnder(panelX + halfW + gap, y, halfW, btnH, false, pulse);
    R.addBtn(panelX + halfW + gap, y, halfW, btnH, "STORE", nav("STORE"), { font: secFont });
    y += btnH + gap;

    // Row: INVENTORY | LEADERBOARD
    accentUnder(panelX, y, halfW, btnH, false, pulse);
    R.addBtn(panelX, y, halfW, btnH, "INVENTORY", nav("INVENTORY"), { font: secFont });
    accentUnder(panelX + halfW + gap, y, halfW, btnH, false, pulse);
    R.addBtn(panelX + halfW + gap, y, halfW, btnH, "LEADERBOARD", nav("LEADERBOARD"), { font: secFont });
    y += btnH + gap;

    // SETTINGS — quiet full-width utility row
    accentUnder(panelX, y, panelW, setH, false, pulse);
    R.addBtn(panelX, y, panelW, setH, "SETTINGS", nav("SETTINGS"), {
      font: "bold " + Math.max(11, Math.round(setH * 0.32)) + "px monospace"
    });

    // 9. Footer status strip
    var gold = game && (game.gold != null ? game.gold : game.credits);
    var footer = "SECTOR COMMAND ONLINE" +
      (gold != null ? "  \u2022  RESERVES: " + gold : "") +
      "  \u2022  DETERMINISTIC CORE READY";
    hazardBar(0, H - 24, W, 6);
    R.text(footer, CX, H - 10, "10px monospace", "rgba(200,220,200,0.65)", "center");

    // 10. Vignette
    c.save();
    var vg = c.createRadialGradient(CX, H / 2, Math.min(W, H) * 0.45, CX, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.38)");
    c.fillStyle = vg;
    c.fillRect(0, 0, W, H);
    c.restore();

    R.drawBtns();
  };
};
})();