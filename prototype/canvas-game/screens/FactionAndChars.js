(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.FactionAndChars = function (state, config, game) {

  var MENU_ID = "scr_ab5f1vj";

  function resolveMenuTarget() {
    var n = state && state.next;
    if (!n) return MENU_ID;
    if (typeof n === "string") return n;
    if (Object.prototype.toString.call(n) === "[object Array]") {
      for (var i = 0; i < n.length; i++) { if (n[i] === MENU_ID) return n[i]; }
      return n.length ? n[0] : MENU_ID;
    }
    if (typeof n === "object") {
      if (typeof n[MENU_ID] === "string") return n[MENU_ID];
      if (n[MENU_ID]) return MENU_ID;
      if (typeof n.menu === "string") return n.menu;
      var k;
      for (k in n) {
        if (Object.prototype.hasOwnProperty.call(n, k)) {
          return (typeof n[k] === "string") ? n[k] : k;
        }
      }
    }
    return MENU_ID;
  }

  var FACTIONS = [
    {
      name: "MOTHER",
      tag: "BROOD DIRECTIVE",
      accent: "#e0a63c",
      glow: "rgba(224,166,60,0.16)",
      mono: "M",
      chars: ["chars_1_mother", "chars_2_mother", "chars_3_mother",
              "chars_4_mother", "chars_5_mother", "chars_6_mother"]
    },
    {
      name: "CHAPLAIN",
      tag: "IRON CREED",
      accent: "#8a7bd8",
      glow: "rgba(138,123,216,0.16)",
      mono: "C",
      chars: ["chars_1_chaplain", "chars_2_chaplain", "chars_3_chaplain"]
    },
    {
      name: "TIDE",
      tag: "DEEP CURRENT",
      accent: "#3fb2a6",
      glow: "rgba(63,178,166,0.16)",
      mono: "T",
      chars: ["chars_1_tide", "chars_2_tide", "chars_3_tide"]
    }
  ];

  function rr(ctx, x, y, w, h, r) {
    var rad = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.arcTo(x + w, y, x + w, y + rad, rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
    ctx.lineTo(x + rad, y + h);
    ctx.arcTo(x, y + h, x, y + h - rad, rad);
    ctx.lineTo(x, y + rad);
    ctx.arcTo(x, y, x + rad, y, rad);
    ctx.closePath();
  }

  function charIndex(key) {
    var m = /chars_(\d+)_/.exec(key);
    return m ? m[1] : "?";
  }

  function drawCard(ctx, x, y, w, h, key, fac, scale) {
    // card plate
    rr(ctx, x, y, w, h, 6 * scale);
    ctx.fillStyle = "#12181f";
    ctx.fill();
    ctx.lineWidth = Math.max(1, 1.5 * scale);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.stroke();

    var pad = Math.max(3, 4 * scale);
    var labelH = Math.max(14, 17 * scale);
    var px = x + pad, py = y + pad;
    var pw = w - pad * 2, ph = h - pad * 2 - labelH;

    // portrait well
    ctx.save();
    rr(ctx, px, py, pw, ph, 4 * scale);
    ctx.clip();
    var g = ctx.createLinearGradient(px, py, px, py + ph);
    g.addColorStop(0, "#1b232c");
    g.addColorStop(1, "#0c1116");
    ctx.fillStyle = g;
    ctx.fillRect(px, py, pw, ph);
    // faint faction wash + monogram fallback behind sprite
    ctx.fillStyle = fac.glow;
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.font = "bold " + Math.floor(ph * 0.62) + "px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(fac.mono, px + pw / 2, py + ph * 0.55);
    ctx.textBaseline = "alphabetic";
    R.drawSpr(key, px, py, pw, ph);
    // top sheen
    var sheen = ctx.createLinearGradient(px, py, px, py + ph * 0.35);
    sheen.addColorStop(0, "rgba(255,255,255,0.09)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(px, py, pw, ph * 0.35);
    ctx.restore();

    // portrait frame in faction accent
    rr(ctx, px, py, pw, ph, 4 * scale);
    ctx.lineWidth = Math.max(1, 1.2 * scale);
    ctx.strokeStyle = fac.accent;
    ctx.globalAlpha = 0.85;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // label strip
    var ly = py + ph + labelH * 0.72;
    var fs = Math.max(9, Math.floor(10 * scale));
    R.text(fac.name + " " + ("0" + charIndex(key)).slice(-2),
           x + w / 2, ly, "bold " + fs + "px 'Segoe UI', Arial, sans-serif",
           "#cdd6de", "center");
    // tier pips (decorative rank marks, deterministic by index)
    var idx = parseInt(charIndex(key), 10) || 1;
    var pips = ((idx - 1) % 3) + 1;
    var pipR = Math.max(1.4, 1.8 * scale);
    var pxc = x + w / 2 - (pips - 1) * pipR * 2.4;
    for (var p = 0; p < pips; p++) {
      ctx.beginPath();
      ctx.arc(pxc + p * pipR * 4.8, y + h - pad * 0.9 - pipR, pipR, 0, Math.PI * 2);
      ctx.fillStyle = fac.accent;
      ctx.fill();
    }
  }

  function drawSection(ctx, x, y, w, h, fac, scale) {
    // panel
    rr(ctx, x, y, w, h, 10 * scale);
    ctx.fillStyle = "rgba(13,18,24,0.86)";
    ctx.fill();
    ctx.lineWidth = Math.max(1, 1.5 * scale);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.stroke();
    // accent spine
    ctx.fillStyle = fac.accent;
    ctx.fillRect(x, y + 8 * scale, Math.max(2, 3 * scale), h - 16 * scale);

    var headH = Math.max(24, 30 * scale);
    var pad = Math.max(8, 12 * scale);
    var nameFs = Math.max(13, Math.floor(17 * scale));
    var tagFs = Math.max(9, Math.floor(10 * scale));

    R.text(fac.name, x + pad + 4 * scale, y + headH * 0.72,
           "bold " + nameFs + "px 'Segoe UI', Arial, sans-serif", fac.accent, "left");
    R.text(fac.tag + "  ·  " + fac.chars.length + " HEROES",
           x + w - pad, y + headH * 0.72,
           tagFs + "px 'Segoe UI', Arial, sans-serif", "#7d8892", "right");
    // divider
    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + pad, y + headH);
    ctx.lineTo(x + w - pad, y + headH);
    ctx.stroke();

    // cards
    var n = fac.chars.length;
    var gap = Math.max(6, 10 * scale);
    var innerW = w - pad * 2;
    var innerY = y + headH + gap * 0.8;
    var innerH = y + h - gap * 0.9 - innerY;
    var cw = (innerW - gap * (n - 1)) / n;
    var ch = innerH;
    var maxCw = ch * 0.82;
    if (cw > maxCw) cw = maxCw;
    var totalW = cw * n + gap * (n - 1);
    var startX = x + (w - totalW) / 2;
    for (var i = 0; i < n; i++) {
      drawCard(ctx, startX + i * (cw + gap), innerY, cw, ch, fac.chars[i], fac, scale);
    }
  }

  return function () {
    R.clearBtns();
    R.drawBg(state.cfg && state.cfg.asset);

    var ctx = R.ctx, W = R.W, H = R.H;
    var scale = Math.max(0.6, Math.min(W / 960, H / 540));

    // readability scrim over backdrop
    var scrim = ctx.createLinearGradient(0, 0, 0, H);
    scrim.addColorStop(0, "rgba(6,9,12,0.72)");
    scrim.addColorStop(0.5, "rgba(6,9,12,0.55)");
    scrim.addColorStop(1, "rgba(6,9,12,0.78)");
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, W, H);

    // ---- header ----
    var headerH = H * 0.13;
    ctx.fillStyle = "rgba(10,14,19,0.85)";
    ctx.fillRect(0, 0, W, headerH);
    ctx.fillStyle = "#e0a63c";
    ctx.fillRect(0, headerH - Math.max(2, 3 * scale), W, Math.max(2, 3 * scale));
    // chevrons
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "#e0a63c";
    ctx.lineWidth = 2 * scale;
    var cvY = headerH * 0.5, cvS = 9 * scale;
    for (var c = 0; c < 3; c++) {
      var cx = W * 0.035 + c * cvS * 1.6;
      ctx.beginPath();
      ctx.moveTo(cx, cvY - cvS);
      ctx.lineTo(cx + cvS, cvY);
      ctx.lineTo(cx, cvY + cvS);
      ctx.stroke();
    }
    ctx.restore();

    var titleFs = Math.max(18, Math.floor(28 * scale));
    R.text("FACTION AND CHARS", W / 2, headerH * 0.52,
           "bold " + titleFs + "px 'Segoe UI', Arial, sans-serif", "#f2f5f7", "center");
    R.text("HERO ROSTER · 3 FACTIONS · 12 CHARACTERS", W / 2, headerH * 0.86,
           Math.max(9, Math.floor(11 * scale)) + "px 'Segoe UI', Arial, sans-serif",
           "#8f9aa4", "center");

    // ---- content ----
    var footH = H * 0.135;
    var top = headerH + H * 0.018;
    var contentH = H - footH - top - H * 0.012;
    var mx = W * 0.045;
    var cw = W - mx * 2;
    var vGap = Math.max(8, 12 * scale);

    // MOTHER: full-width strip (6 heroes)
    var motherH = contentH * 0.52 - vGap / 2;
    drawSection(ctx, mx, top, cw, motherH, FACTIONS[0], scale);

    // CHAPLAIN / TIDE: side-by-side (3 heroes each)
    var rowY = top + motherH + vGap;
    var rowH = contentH - motherH - vGap;
    var hGap = Math.max(8, 12 * scale);
    var halfW = (cw - hGap) / 2;
    drawSection(ctx, mx, rowY, halfW, rowH, FACTIONS[1], scale);
    drawSection(ctx, mx + halfW + hGap, rowY, halfW, rowH, FACTIONS[2], scale);

    // ---- footer ----
    ctx.fillStyle = "rgba(10,14,19,0.85)";
    ctx.fillRect(0, H - footH, W, footH);
    ctx.fillStyle = "rgba(224,166,60,0.55)";
    ctx.fillRect(0, H - footH, W, Math.max(1, 2 * scale));

    var btnW = Math.min(320, Math.max(180, W * 0.30));
    var btnH = Math.min(52, Math.max(36, footH * 0.58));
    var btnX = (W - btnW) / 2;
    var btnY = H - footH + (footH - btnH) / 2;

    R.addBtn(btnX, btnY, btnW, btnH, "RETURN TO MENU", function () {
      R.go(resolveMenuTarget());
    });

    R.drawBtns();
  };
};
})();